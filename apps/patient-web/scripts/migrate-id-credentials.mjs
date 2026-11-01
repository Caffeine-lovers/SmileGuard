#!/usr/bin/env node
/**
 * One-time move of PWD / Senior Citizen IDs out of the PUBLIC "avatars" bucket
 * into the private "ID Credentials" bucket (created by migration 038).
 *
 *   1. For every profile whose pwd_id_url points into "avatars":
 *        copy the file to  ID Credentials/<patient id>/<file>,
 *        set profiles.pwd_id_path, clear profiles.pwd_id_url,
 *        delete the public copy.
 *   2. Delete leftover public ID photos (avatars/<user>/pwd_id_*) from earlier
 *      re-submissions that no profile points to any more.
 *   Profile pictures (avatars/<user>/avatar.*) are never touched.
 *
 * Usage (from apps/patient-web, after running migration 038):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-id-credentials.mjs          # dry run
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-id-credentials.mjs --apply  # do it
 * Values are also read from .env.local if not set in the environment.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const FROM_BUCKET = 'avatars';
const TO_BUCKET = 'ID Credentials';
const ID_FILE = /^pwd_id_/;

function loadEnvLocal() {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** ".../storage/v1/object/public/avatars/<uid>/pwd_id_1.jpg?x" -> "<uid>/pwd_id_1.jpg" */
export function avatarsPathFromUrl(url) {
  const m = String(url || '').match(/\/storage\/v1\/object\/(?:public|sign)\/avatars\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or apps/patient-web/.env.local).');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log(APPLY ? '⚙️  APPLY mode — changes will be made.\n' : '🔍 DRY RUN — nothing will change. Re-run with --apply.\n');

  // Make sure migration 038 ran
  const { data: buckets, error: bErr } = await db.storage.listBuckets();
  if (bErr) throw bErr;
  const target = buckets.find((b) => b.id === TO_BUCKET);
  if (!target) throw new Error(`Bucket "${TO_BUCKET}" not found — run migration 038 first.`);
  if (target.public) throw new Error(`Bucket "${TO_BUCKET}" is PUBLIC — it must be private. Aborting.`);

  // ── 1. Move referenced IDs ──────────────────────────────────────────
  const { data: profiles, error: pErr } = await db
    .from('profiles')
    .select('id, name, pwd_id_url, pwd_id_path')
    .not('pwd_id_url', 'is', null);
  if (pErr) throw pErr;

  const stillReferenced = new Set();
  let moved = 0;
  let failed = 0;

  for (const p of profiles) {
    const src = avatarsPathFromUrl(p.pwd_id_url);
    if (!src) {
      console.log(`- ${p.id}: pwd_id_url is not an avatars link, skipping (${p.pwd_id_url})`);
      continue;
    }
    const fileName = src.split('/').pop();
    const dest = `${p.id}/${fileName}`;
    console.log(`→ ${p.id}: avatars/${src}  ⇒  ${TO_BUCKET}/${dest}`);
    if (!APPLY) {
      moved++;
      continue;
    }

    try {
      const { data: blob, error: dErr } = await db.storage.from(FROM_BUCKET).download(src);
      if (dErr) throw new Error(`download: ${dErr.message}`);
      const { error: uErr } = await db.storage
        .from(TO_BUCKET)
        .upload(dest, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (uErr) throw new Error(`upload: ${uErr.message}`);
      const { error: upErr } = await db.from('profiles').update({ pwd_id_path: dest, pwd_id_url: null }).eq('id', p.id);
      if (upErr) throw new Error(`profile update: ${upErr.message}`);
      const { error: rmErr } = await db.storage.from(FROM_BUCKET).remove([src]);
      if (rmErr) console.warn(`  ! moved, but could not delete public copy: ${rmErr.message}`);
      moved++;
    } catch (e) {
      failed++;
      stillReferenced.add(src); // never delete a file we failed to move
      console.error(`  ✗ ${e.message}`);
    }
  }

  // ── 2. Delete orphaned public ID photos ─────────────────────────────
  const { data: folders, error: fErr } = await db.storage.from(FROM_BUCKET).list('', { limit: 10000 });
  if (fErr) throw fErr;
  const orphans = [];
  for (const folder of folders.filter((f) => !f.id)) { // folders have no id
    const { data: files } = await db.storage.from(FROM_BUCKET).list(folder.name, { limit: 1000 });
    for (const f of files || []) {
      const path = `${folder.name}/${f.name}`;
      if (ID_FILE.test(f.name) && !stillReferenced.has(path)) orphans.push(path);
    }
  }
  // In dry-run, the files referenced in step 1 are still there and listed again — exclude them
  const referencedInDryRun = new Set(profiles.map((p) => avatarsPathFromUrl(p.pwd_id_url)).filter(Boolean));
  const toDelete = APPLY ? orphans : orphans.filter((p) => !referencedInDryRun.has(p));
  for (const path of toDelete) console.log(`🗑  orphaned public ID photo: avatars/${path}`);
  if (APPLY && toDelete.length) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const { error } = await db.storage.from(FROM_BUCKET).remove(toDelete.slice(i, i + 100));
      if (error) console.error(`  ✗ delete batch failed: ${error.message}`);
    }
  }

  console.log(`\nIDs ${APPLY ? 'moved' : 'to move'}: ${moved}  |  failed: ${failed}  |  orphaned public ID photos ${APPLY ? 'deleted' : 'to delete'}: ${toDelete.length}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Migration failed:', e.message || e);
  process.exit(1);
});
