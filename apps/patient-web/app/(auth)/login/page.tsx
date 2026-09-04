'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { Lock, Mail, LogIn, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.hash.includes('access_token') || window.location.hash.includes('error='))) {
      router.replace(`/auth/callback${window.location.hash}`);
      return;
    }

    if (!loading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, loading, router]);

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
      localStorage.removeItem('oauth_signup_flow');

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
    <div className="skeuo-panel p-8 border-2 border-slate-300">
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-3">SmileGuard Clinic Portal</span>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
          Patient Authentication
        </h2>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Access your digital health chart & appointments
        </p>
      </div>

      {(error || localError) && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-sm font-semibold flex items-center gap-2">
          <span>{error || localError}</span>
        </div>
      )}

      {/* OAuth Sign-in Option */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || oauthLoading}
        className="skeuo-btn-secondary w-full py-2.5 px-4 mb-5 text-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span>{oauthLoading ? 'Authenticating with Google...' : 'Sign in with Google'}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-slate-300"></div>
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">or sign in with email</span>
        <div className="flex-1 h-px bg-slate-300"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-emerald-600" />
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="skeuo-input w-full text-sm"
            placeholder="patient@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="skeuo-input w-full text-sm"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="skeuo-btn-primary w-full py-3 text-sm tracking-wide mt-2"
        >
          <LogIn className="w-4 h-4" />
          <span>{loading ? 'Verifying Credentials...' : 'Secure Sign In'}</span>
        </button>
      </form>

      <div className="mt-6 text-center space-y-3">
        <p className="text-xs font-semibold">
          <Link href="/forgot-password" className="text-emerald-700 hover:text-emerald-900 underline">
            Forgot your password?
          </Link>
        </p>
        <div className="pt-4 border-t-2 border-slate-200">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">New Clinic Patient?</p>
          <Link
            href="/signup"
            className="skeuo-btn-secondary w-full py-2.5 text-xs tracking-wider uppercase text-emerald-800"
          >
            <span>Register New Patient Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
