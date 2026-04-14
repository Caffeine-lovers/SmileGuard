import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Comprehensive debugging tool to diagnose Supabase auth issues
 * Run this after login to check if bearer token is being sent
 */
export async function debugAuthSession() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          SUPABASE AUTH DEBUG REPORT                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Check current session
    console.log('📋 STEP 1: Checking current session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
    }
    
    if (!session) {
      console.error('❌ NO SESSION FOUND!');
      console.log('   This means you are NOT logged in or session is not being restored from AsyncStorage');
      return;
    }

    console.log('✅ Session found!');
    console.log('   User ID:', session.user?.id);
    console.log('   Email:', session.user?.email);
    console.log('   Provider:', session.user?.app_metadata?.provider);

    // 2. Check access token
    console.log('\n🔑 STEP 2: Checking access token...');
    if (!session.access_token) {
      console.error('❌ NO ACCESS TOKEN! This is why RLS checks fail.');
      return;
    }

    console.log('✅ Access token exists');
    const tokenLength = session.access_token.length;
    console.log(`   Token length: ${tokenLength} characters`);
    console.log(`   Token preview: ${session.access_token.substring(0, 50)}...${session.access_token.substring(tokenLength - 20)}`);

    // 3. Decode JWT token
    console.log('\n🔐 STEP 3: Decoding JWT token to inspect claims...');
    try {
      const parts = session.access_token.split('.');
      if (parts.length !== 3) {
        console.error('❌ Invalid JWT format! Expected 3 parts, got', parts.length);
        return;
      }

      const decoded = JSON.parse(atob(parts[1]));
      
      console.log('✅ JWT Claims:');
      console.log('   sub (user UUID):', decoded.sub);
      console.log('   aud (audience):', decoded.aud);
      console.log('   role (JWT role):', decoded.role);
      console.log('   iat (issued at):', new Date(decoded.iat * 1000).toISOString());
      console.log('   exp (expires at):', new Date(decoded.exp * 1000).toISOString());
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        console.error('❌ TOKEN IS EXPIRED!');
        console.log('   Current time:', new Date(now * 1000).toISOString());
        console.log('   Expired at:', new Date(decoded.exp * 1000).toISOString());
      } else {
        const secondsUntilExpiry = decoded.exp - now;
        console.log(`✅ Token is valid for ${Math.round(secondsUntilExpiry / 60)} more minutes`);
      }

      // Verify sub claim exists
      if (!decoded.sub) {
        console.error('❌ TOKEN HAS NO "sub" CLAIM! auth.id() will be NULL');
      } else {
        console.log('✅ Token has "sub" claim - auth.id() should work in RLS');
      }

    } catch (e) {
      console.error('❌ Failed to decode JWT:', e);
    }

    // 4. Check refresh token
    console.log('\n🔄 STEP 4: Checking refresh token...');
    if (!session.refresh_token) {
      console.error('❌ NO REFRESH TOKEN!');
    } else {
      console.log('✅ Refresh token exists');
      console.log(`   Token length: ${session.refresh_token.length} characters`);
    }

    // 5. Check AsyncStorage persistence
    console.log('\n💾 STEP 5: Checking AsyncStorage persistence...');
    try {
      const storageSession = await AsyncStorage.getItem('supabase.auth.token');
      if (storageSession) {
        console.log('✅ Session found in AsyncStorage');
        const storedData = JSON.parse(storageSession);
        console.log('   Stored user ID:', storedData?.user?.id);
      } else {
        console.warn('⚠️  No session in AsyncStorage (may be OK if using in-memory session)');
      }
    } catch (e) {
      console.error('❌ Error reading AsyncStorage:', e);
    }

    // 6. Test a simple query
    console.log('\n🧪 STEP 6: Testing a simple authenticated query...');
    try {
      const { data, error } = await supabase
        .from('dummy_accounts')
        .select('id, patient_name')
        .limit(1);
      
      if (error) {
        console.error('❌ Query failed:', error.message);
        console.error('   Error code:', error.code);
        console.error('   Error details:', error);
      } else if (data && data.length > 0) {
        console.log('✅ Query successful! Can read dummy_accounts');
        console.log('   Sample record:', data[0]);
      } else {
        console.log('⚠️  Query returned 0 rows (might be RLS filtering or empty table)');
      }
    } catch (e) {
      console.error('❌ Query exception:', e);
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              END DEBUG REPORT                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Debug function error:', error);
  }
}

/**
 * Quick check - just verify if we have a valid session with access token
 */
export async function quickAuthCheck() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ NOT LOGGED IN - No session');
    return false;
  }

  if (!session.access_token) {
    console.error('❌ NO ACCESS TOKEN in session');
    return false;
  }

  console.log('✅ Logged in with valid access token for:', session.user?.email);
  return true;
}

/**
 * Deep dive into AsyncStorage to see what's actually saved
 */
export async function debugAsyncStorage() {
  console.log('\n📦 DEBUGGING ASYNCSTORAGE...');
  
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default || m);
    
    // List all keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('🔑 All AsyncStorage keys:', allKeys);
    
    // Check for Supabase session specifically
    const sessionKey = 'supabase.auth.token';
    const session = await AsyncStorage.getItem(sessionKey);
    
    if (session) {
      console.log('✅ Found session in AsyncStorage at key:', sessionKey);
      try {
        const parsed = JSON.parse(session);
        console.log('📋 Session structure:');
        console.log('  - has access_token:', !!parsed.currentSession?.access_token);
        console.log('  - has refresh_token:', !!parsed.currentSession?.refresh_token);
        console.log('  - user.id:', parsed.currentSession?.user?.id);
        console.log('  - Full keys:', Object.keys(parsed.currentSession || {}));
      } catch (e) {
        console.log('   Raw session:', session.substring(0, 100) + '...');
      }
    } else {
      console.error('❌ NO SESSION in AsyncStorage at key:', sessionKey);
    }
    
  } catch (e) {
    console.error('❌ Error debugging AsyncStorage:', e);
  }
}
