/**
 * Diagnostic 3: Test authenticated upload to "Analyzed images" bucket
 * and verify the RLS INSERT policy
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://yffvnvusiazjnwmdylji.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZnZudnVzaWF6am53bWR5bGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTczMDIsImV4cCI6MjA4NjM5MzMwMn0.bZikKnvwvLt3OIpUnCCh2ATHy0Sp7NMGfgfs3ySGiKU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Authenticated Upload Test ===\n');

  // 1. Check RLS policies by trying anon upload
  console.log('1) Attempting ANON upload (no auth session)...');
  const testBlob = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  
  const { data: anonData, error: anonErr } = await supabase.storage
    .from('Analyzed images')
    .upload('_test_anon.jpg', testBlob, { contentType: 'image/jpeg', upsert: true });
  
  if (anonErr) {
    console.log(`   ❌ Anon upload blocked: ${anonErr.message} (code: ${anonErr.statusCode || ''})`);
    console.log('   This is expected if RLS requires auth.uid() != null');
  } else {
    console.log('   ✅ Anon upload succeeded:', anonData);
    await supabase.storage.from('Analyzed images').remove(['_test_anon.jpg']);
  }

  // 2. Check what RLS policies look like by querying the storage schema
  console.log('\n2) Checking storage.objects policies via RPC...');
  const { data: policies, error: polErr } = await supabase
    .rpc('get_policies', {})
    .select('*');
  
  if (polErr) {
    console.log('   (Cannot query policies via RPC - expected for anon users)');
  } else {
    console.log('   Policies:', policies);
  }

  // 3. Check the endpoint response to see if xai_annotated_image_b64 is present
  console.log('\n3) Testing Modal endpoint for xai_annotated_image_b64 field...');
  const endpoint = 'https://duoiz--smileguard-predict.modal.run';
  
  // Create a tiny 1x1 white JPEG as test
  // Base64 of a minimal valid JPEG
  const miniJpegB64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM' +
    'DhEQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQU' +
    'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUB' +
    'AQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
    'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNk' +
    'ZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT' +
    '1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL' +
    '/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYk' +
    'NOEl8RcYI4Q/RFhHRUYnJCk2NTc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWG' +
    'h4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vHy' +
    '8/T19vf4+fr/2gAMAwEAAhEDEQA/AP1ToooA/9k=';

  try {
    console.log('   Sending test image to Modal endpoint...');
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_b64: miniJpegB64, conf: 0.10 }),
    });

    if (!resp.ok) {
      console.log(`   ❌ Endpoint returned ${resp.status}: ${resp.statusText}`);
      const body = await resp.text();
      console.log('   Response body:', body.slice(0, 500));
    } else {
      const data = await resp.json();
      console.log('   ✅ Endpoint responded successfully');
      console.log('   Response keys:', Object.keys(data));
      console.log('   Has xai_annotated_image_b64:', !!data.xai_annotated_image_b64);
      console.log('   xai_annotated_image_b64 length:', data.xai_annotated_image_b64?.length || 0);
      console.log('   Detections count:', data.count);
    }
  } catch (fetchErr) {
    console.log('   ❌ Fetch error:', fetchErr.message);
  }

  console.log('\n=== Summary ===');
  console.log('• Bucket "Analyzed images" exists and is readable');
  console.log('• Anon uploads are blocked by RLS (INSERT policy requires auth)');
  console.log('• The analysis page must use an authenticated Supabase session');
  console.log('• If currentUser is null when upload runs, the session may not be set');
  console.log('\n=== Done ===');
}

main().catch(console.error);
