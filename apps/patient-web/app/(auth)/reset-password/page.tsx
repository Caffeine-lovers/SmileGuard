'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('🔄 Reset password component mounted');
    
    // Try to get hash parameters from URL (for email recovery link)
    const hash = typeof globalThis !== 'undefined' && 'location' in globalThis 
      ? (globalThis as unknown as { location: { hash: string } }).location.hash 
      : '';
    console.log('📍 Current hash:', hash);
    
    if (hash && hash.includes('access_token')) {
      console.log('✅ Found access_token in hash, parsing...');
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      
      console.log('📋 Parsed recovery params:', { hasAccessToken: !!accessToken, type, hasRefreshToken: !!refreshToken });
      
      if (accessToken) {
        console.log('🔐 Setting session from recovery token...');
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        }).then(() => {
          console.log('✅ Session set, verifying...');
          verifySession();
        }).catch((error) => {
          console.error('❌ Error setting session:', error);
          setMessage(`Error: ${error.message}`);
          setReady(true);
        });
        return;
      }
    }

    // If no hash found, just verify existing session
    verifySession();
  }, []);

  const verifySession = async () => {
    console.log('🔍 Verifying session...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('📊 Session status:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        error: error?.message,
      });
      
      if (session?.user) {
        console.log('✅ Valid session found, ready to reset password');
        setReady(true);
      } else {
        console.warn('❌ No session found!');
        setMessage('This reset link is invalid or has expired. Please request a new one.');
        setReady(true);
      }
    } catch (error) {
      console.error('❌ Error verifying session:', error);
      setMessage('Error retrieving session. Please try again.');
      setReady(true);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('✅ Password updated! Redirecting...');
      setTimeout(() => router.replace('/login'), 1500);
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
        🔐 Set New Password
      </h2>

      {message && (
        <div className={`px-4 py-3 rounded mb-6 text-center font-medium ${
          message.includes('✅') || message.includes('updated')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : message.includes('Error') || message.includes('invalid')
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          {message}
        </div>
      )}

      {!message.includes('✅') && !message.includes('invalid') && (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          Return to Login
        </Link>
      </div>
    </div>
  );
}
