'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@smileguard/shared-hooks';

export default function SignupPage() {
  const { signInWithGoogle, loading, error: authError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGoogleSignup = async () => {
    setLocalError(null);
    try {
      console.log('[GOOGLE] Initiating Google OAuth sign-in...');
      await signInWithGoogle('/auth/callback');
    } catch (err) {
      console.error('[GOOGLE] Sign-in error:', err);
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">Create Account</h2>
      <p className="text-center text-text-secondary mb-8">Sign up to get started</p>

      {(authError || localError) && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {authError || localError}
        </div>
      )}

      {/* Google OAuth Sign-in */}
      <div className="space-y-4">
        <p className="text-text-secondary text-center mb-6">
          Sign up with your Google account to get started
        </p>
        
        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin h-5 w-5 border-b-2 border-gray-700"></div>
              Signing in...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-card"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-bg-surface text-text-secondary">or</span>
          </div>
        </div>

        <p className="text-center text-text-secondary text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-primary font-semibold hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
