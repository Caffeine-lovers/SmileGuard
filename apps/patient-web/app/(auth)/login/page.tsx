'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      await login(email, password, 'patient');
      router.push('/dashboard');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    setLocalError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      });
      if (oauthError) {
        setLocalError(`Google sign-in failed: ${oauthError.message}`);
        setOauthLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
      setOauthLoading(false);
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-8 text-text-primary">
        Patient Login
      </h2>

      {(error || localError) && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {error || localError}
        </div>
      )}

      {/* OAuth Sign-in Option */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || oauthLoading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-border-card text-text-primary font-medium py-2 px-4 rounded-lg transition mb-4"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <g transform="translate(1 1)">
            <path d="M11 11.5v4.5h6.5m-6.5-9v-4.5h6.5M5.5 11H0M11 0v4.5" stroke="currentColor" strokeWidth="2" />
          </g>
        </svg>
        <span>{oauthLoading ? 'Signing in...' : 'Sign in with Google'}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border-card"></div>
        <span className="text-text-secondary text-sm">or continue with email</span>
        <div className="flex-1 h-px bg-border-card"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          Don't have an account?{' '}
          <Link href="/signup" className="text-text-link font-medium hover:underline">
            Sign up
          </Link>
        </p>
        <p className="text-sm text-text-secondary mt-2">
          <Link href="/forgot-password" className="text-text-link hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
