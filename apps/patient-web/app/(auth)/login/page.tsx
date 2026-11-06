'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { clearPatientUserCookie } from '@/lib/auth-cookie';
import { Lock, Mail, LogIn, ArrowRight, ShieldCheck } from 'lucide-react';
import LegalModal, { type LegalDoc } from '@/components/legal/LegalModal';
import { LEGAL_EFFECTIVE_DATE } from '@/components/legal/LegalContent';

// Versioned by effective date so users are asked again whenever the documents change
const TERMS_ACCEPTED_KEY = `smileguard_terms_accepted_${LEGAL_EFFECTIVE_DATE}`;
const LOGIN_RATE_LIMIT_KEY = 'smileguard_login_rate_limit';
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState<number>(0);

  // 15-minute soft limit timer for failed login attempts (3x max)
  useEffect(() => {
    const checkLockout = () => {
      try {
        const stored = localStorage.getItem(LOGIN_RATE_LIMIT_KEY);
        if (!stored) {
          setLockoutSecondsRemaining(0);
          return;
        }
        const data = JSON.parse(stored);
        if (data.lockedUntil) {
          const diffMs = data.lockedUntil - Date.now();
          if (diffMs > 0) {
            setLockoutSecondsRemaining(Math.ceil(diffMs / 1000));
          } else {
            localStorage.removeItem(LOGIN_RATE_LIMIT_KEY);
            setLockoutSecondsRemaining(0);
          }
        }
      } catch {
        setLockoutSecondsRemaining(0);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset loading states when mounting or restored from BFCache (e.g. browser Back button)
  useEffect(() => {
    setOauthLoading(false);
    setSubmitting(false);

    const handlePageShow = () => {
      setOauthLoading(false);
      setSubmitting(false);
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Remember the user's agreement on this device for the current version of the documents
  useEffect(() => {
    try {
      if (localStorage.getItem(TERMS_ACCEPTED_KEY)) setAgreedToTerms(true);
    } catch { }
  }, []);

  const handleAgreeChange = (checked: boolean) => {
    setAgreedToTerms(checked);
    if (checked) setLocalError(null);
    try {
      if (checked) localStorage.setItem(TERMS_ACCEPTED_KEY, new Date().toISOString());
      else localStorage.removeItem(TERMS_ACCEPTED_KEY);
    } catch { }
  };

  const requireAgreement = () => {
    if (agreedToTerms) return true;
    setLocalError('Please check the box to agree to the Terms and Conditions and Privacy Policy before continuing.');
    return false;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';

      // If an OAuth error is present, display it on /login instead of bouncing to /auth/callback (which causes infinite loop)
      if (hash.includes('error=') || search.includes('error=')) {
        const params = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : search);
        const errDesc = params.get('error_description') || params.get('error') || 'Google sign-in was cancelled or encountered an error.';
        const cleanMsg = decodeURIComponent(errDesc.replace(/\+/g, ' '));
        setLocalError(`Google sign-in: ${cleanMsg}`);
        setOauthLoading(false);
        // Clear error fragments from address bar so Back/Forward does not re-trigger
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      if (search.includes('reset=success')) {
        setResetSuccess(true);
        supabase.auth.signOut().catch(() => { });
        clearPatientUserCookie();
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      if (hash.includes('access_token')) {
        // Forward token to /auth/callback and clear hash from /login
        window.history.replaceState(null, '', window.location.pathname);
        router.replace(`/auth/callback${hash}`);
        return;
      }
    }

    // Always purge any abandoned signup cache when arriving on the login page
    try {
      localStorage.removeItem('smileguard_signup_data');
      localStorage.removeItem('oauth_signup_flow');
    } catch { }

    // Only redirect to dashboard if verified patient to prevent dashboard-login loop
    if (!loading && currentUser) {
      if (currentUser.role === 'patient') {
        router.replace('/dashboard');
      } else {
        // Incomplete or non-patient session: purge session and cookie
        supabase.auth.signOut().catch(() => { });
        clearPatientUserCookie();
      }
    }
  }, [currentUser, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (lockoutSecondsRemaining > 0) {
      const mins = Math.floor(lockoutSecondsRemaining / 60);
      const secs = lockoutSecondsRemaining % 60;
      setLocalError(`Too many failed login attempts (${MAX_LOGIN_ATTEMPTS}). Please wait ${mins}m ${secs}s before trying again.`);
      return;
    }

    if (!requireAgreement()) return;
    setSubmitting(true);

    try {
      await login(email, password, 'patient');
      try {
        localStorage.removeItem(LOGIN_RATE_LIMIT_KEY);
      } catch { }
      router.push('/dashboard');
    } catch (err) {
      let currentAttempts = 1;
      try {
        const stored = localStorage.getItem(LOGIN_RATE_LIMIT_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          currentAttempts = (data.attempts || 0) + 1;
        }
      } catch { }

      if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        try {
          localStorage.setItem(LOGIN_RATE_LIMIT_KEY, JSON.stringify({
            attempts: currentAttempts,
            lockedUntil,
          }));
        } catch { }
        setLockoutSecondsRemaining(Math.ceil(LOCKOUT_DURATION_MS / 1000));
        setLocalError(
          `Too many failed login attempts (${MAX_LOGIN_ATTEMPTS}). Login is temporarily locked for security. Please wait 15 minutes before trying again.`
        );
      } else {
        try {
          localStorage.setItem(LOGIN_RATE_LIMIT_KEY, JSON.stringify({
            attempts: currentAttempts,
            lockedUntil: null,
          }));
        } catch { }
        const remainingTries = MAX_LOGIN_ATTEMPTS - currentAttempts;
        setLocalError(
          `Invalid login credentials. ${remainingTries} attempt${remainingTries === 1 ? '' : 's'} remaining before a 15-minute lockout.`
        );
      }
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!requireAgreement()) return;
    setOauthLoading(true);
    setLocalError(null);

    // Defensive timeout to reset button if browser navigation is cancelled or abandoned
    const safetyTimer = setTimeout(() => {
      setOauthLoading(false);
    }, 15000);

    try {
      localStorage.setItem('oauth_signup_flow', 'true');

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      });
      if (oauthError) {
        clearTimeout(safetyTimer);
        setLocalError(`Google sign-in failed: ${oauthError.message}`);
        setOauthLoading(false);
      }
    } catch (err) {
      clearTimeout(safetyTimer);
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
      setOauthLoading(false);
    }
  };

  return (
    <div className="skeuo-panel p-5 sm:p-8 border-2 border-slate-300">
      <div className="text-center mb-6">
        <p className="text-sm font-semibold text-slate-600">
          Access your digital health chart &amp; appointments
        </p>
      </div>

      {resetSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-800 px-4 py-3 rounded-sm mb-6 text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Your password has been reset successfully. Please sign in with your new password.</span>
        </div>
      )}

      {(error || localError) && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-sm font-semibold flex items-center gap-2">
          <span>{error || localError}</span>
        </div>
      )}

      {/* Registration — first thing new patients see */}
      <div className="mb-5">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 text-center">New Clinic Patient?</p>
        <RestrictedTooltip restricted={!agreedToTerms}>
          <Link
            href="/signup"
            onClick={(e) => {
              if (!requireAgreement()) e.preventDefault();
            }}
            aria-disabled={!agreedToTerms}
            title={agreedToTerms ? undefined : 'Please agree to the Terms and Conditions and Privacy Policy first'}
            className={`skeuo-btn-primary w-full py-3 text-xs tracking-wider uppercase ${agreedToTerms ? '' : 'opacity-50'
              }`}
          >
            <span>Register New Patient Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </RestrictedTooltip>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-slate-300"></div>
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Already registered?</span>
        <div className="flex-1 h-px bg-slate-300"></div>
      </div>

      {/* OAuth Sign-in Option */}
      <RestrictedTooltip restricted={!agreedToTerms} className="mb-5">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || oauthLoading || lockoutSecondsRemaining > 0}
          aria-disabled={!agreedToTerms}
          title={agreedToTerms ? undefined : 'Please agree to the Terms and Conditions and Privacy Policy first'}
          className={`skeuo-btn-secondary w-full py-2.5 px-4 text-sm ${agreedToTerms ? '' : 'opacity-50'
            }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          <span>{oauthLoading ? 'Authenticating with Google...' : 'Sign in with Google'}</span>
        </button>
      </RestrictedTooltip>

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

        <RestrictedTooltip restricted={!agreedToTerms} className="mt-2">
          <button
            type="submit"
            disabled={submitting || oauthLoading}
            aria-disabled={!agreedToTerms}
            title={agreedToTerms ? undefined : 'Please agree to the Terms and Conditions and Privacy Policy first'}
            className={`skeuo-btn-primary w-full py-3 text-sm tracking-wide ${agreedToTerms ? '' : 'opacity-50'
              }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{lockoutSecondsRemaining > 0 ? `Locked (${Math.floor(lockoutSecondsRemaining / 60)}m ${lockoutSecondsRemaining % 60}s)` : submitting ? 'Verifying Credentials...' : 'Secure Sign In'}</span>
          </button>
        </RestrictedTooltip>
      </form>

      <div className="mt-6 text-center space-y-3">
        <p className="text-xs font-semibold">
          <Link href="/forgot-password" className="text-emerald-700 hover:text-emerald-900 underline">
            Forgot your password?
          </Link>
        </p>
      </div>

      {/* Terms & Privacy attestation — minimal, required before any sign-in or registration */}
      <label className="mt-5 flex items-start justify-center gap-2 cursor-pointer select-none text-[11px] text-slate-500 leading-snug">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => handleAgreeChange(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
        />
        <span>
          I agree to the{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc('terms'); }} className="font-semibold text-emerald-700 underline cursor-pointer">
            Terms
          </button>{' '}
          and{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc('privacy'); }} className="font-semibold text-emerald-700 underline cursor-pointer">
            Privacy Policy
          </button>
          .
        </span>
      </label>
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}


function RestrictedTooltip({
  restricted,
  children,
  className = '',
}: {
  restricted: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative group ${className}`}>
      {children}
      {restricted && (
        <div
          role="tooltip"
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-40 hidden group-hover:flex group-focus-within:flex flex-col items-center w-72 p-2.5 bg-slate-900 text-white rounded-md shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 select-none text-center"
        >
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Agreement Required</span>
          </div>
          <p className="text-[11px] text-slate-200 leading-snug">
            Please check the box to agree to the Terms and Conditions and Privacy Policy before continuing.
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
