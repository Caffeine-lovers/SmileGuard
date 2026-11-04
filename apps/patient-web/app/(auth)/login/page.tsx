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

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

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
    } catch {}
  }, []);

  const handleAgreeChange = (checked: boolean) => {
    setAgreedToTerms(checked);
    if (checked) setLocalError(null);
    try {
      if (checked) localStorage.setItem(TERMS_ACCEPTED_KEY, new Date().toISOString());
      else localStorage.removeItem(TERMS_ACCEPTED_KEY);
    } catch {}
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
    } catch {}

    // Only redirect to dashboard if verified patient to prevent dashboard-login loop
    if (!loading && currentUser) {
      if (currentUser.role === 'patient') {
        router.replace('/dashboard');
      } else {
        // Incomplete or non-patient session: purge session and cookie
        supabase.auth.signOut().catch(() => {});
        clearPatientUserCookie();
      }
    }
  }, [currentUser, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!requireAgreement()) return;
    setSubmitting(true);

    try {
      await login(email, password, 'patient');
      router.push('/dashboard');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      );
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
        <span className="skeuo-badge skeuo-badge-mint mb-3">SmileGuard Clinic Portal</span>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
          Patient Authentication
        </h2>
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Access your digital health chart & appointments
        </p>
      </div>

      {(error || localError) && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-sm font-semibold flex items-center gap-2">
          <span>{error || localError}</span>
        </div>
      )}

      {/* Terms & Privacy attestation — required before any sign-in or registration */}
      <div
        className={`mb-5 p-3.5 rounded-sm border-2 transition ${
          agreedToTerms ? 'border-emerald-300 bg-emerald-50/60' : 'border-amber-300 bg-amber-50/70'
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Terms &amp; Privacy
        </p>
        <p className="text-xs text-slate-600 leading-relaxed mb-2.5">
          SmileGuard stores your personal and medical information under the Data Privacy Act of 2012 (RA 10173).
          Please read our{' '}
          <button type="button" onClick={() => setLegalDoc('terms')} className="font-semibold text-emerald-700 underline cursor-pointer">
            Terms and Conditions
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => setLegalDoc('privacy')} className="font-semibold text-emerald-700 underline cursor-pointer">
            Privacy Policy
          </button>
          .
        </p>
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => handleAgreeChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-800 leading-relaxed">
            I have read and agree to the Terms and Conditions and Privacy Policy.
          </span>
        </label>
      </div>

      {/* OAuth Sign-in Option */}
      <RestrictedTooltip restricted={!agreedToTerms} className="mb-5">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || oauthLoading}
          aria-disabled={!agreedToTerms}
          title={agreedToTerms ? undefined : 'Please agree to the Terms and Conditions and Privacy Policy first'}
          className={`skeuo-btn-secondary w-full py-2.5 px-4 text-sm ${
            agreedToTerms ? '' : 'opacity-50'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
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
            className={`skeuo-btn-primary w-full py-3 text-sm tracking-wide ${
              agreedToTerms ? '' : 'opacity-50'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{submitting ? 'Verifying Credentials...' : 'Secure Sign In'}</span>
          </button>
        </RestrictedTooltip>
      </form>

      <div className="mt-6 text-center space-y-3">
        <p className="text-xs font-semibold">
          <Link href="/forgot-password" className="text-emerald-700 hover:text-emerald-900 underline">
            Forgot your password?
          </Link>
        </p>
        <div className="pt-4 border-t-2 border-slate-200">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">New Clinic Patient?</p>
          <RestrictedTooltip restricted={!agreedToTerms}>
            <Link
              href="/signup"
              onClick={(e) => {
                if (!requireAgreement()) e.preventDefault();
              }}
              aria-disabled={!agreedToTerms}
              title={agreedToTerms ? undefined : 'Please agree to the Terms and Conditions and Privacy Policy first'}
              className={`skeuo-btn-secondary w-full py-2.5 text-xs tracking-wider uppercase text-emerald-800 ${
                agreedToTerms ? '' : 'opacity-50'
              }`}
            >
              <span>Register New Patient Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </RestrictedTooltip>
        </div>
      </div>
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
