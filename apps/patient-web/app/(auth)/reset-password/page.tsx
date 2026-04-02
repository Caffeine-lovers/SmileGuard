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
      <div className="bg-bg-surface rounded-lg shadow-lg p-8 text-center border border-border-card">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
        <p className="text-text-secondary mt-4">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-8 text-text-primary">
        🔐 Set New Password
      </h2>

      {message && (
        <div className={`px-4 py-3 rounded mb-6 text-center font-medium ${
          message.includes('✅') || message.includes('updated')
            ? 'bg-green-50 border border-green-200 text-green-700'
            : message.includes('Error') || message.includes('invalid')
            ? 'bg-brand-danger/10 border border-brand-danger text-brand-danger'
            : 'bg-brand-primary/10 border border-brand-primary text-brand-primary'
        }`}>
          {message}
        </div>
      )}

      {!message.includes('✅') && !message.includes('invalid') && (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary"
              placeholder="••••••••"
            />
            <p className="text-xs text-text-secondary mt-1">Must be at least 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="text-text-link font-medium hover:underline">
          Return to Login
        </Link>
      </div>
    </div>
  );
}
