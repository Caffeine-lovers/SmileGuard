import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Look for .env.local in patient-web app to get API keys
const envPath = path.resolve(__dirname, '../../apps/patient-web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\n]+)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error("Could not find keys");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Profile columns:', Object.keys(data[0]));
    } else {
      console.log('No profiles found to inspect.');
    }
  }
}

run();
