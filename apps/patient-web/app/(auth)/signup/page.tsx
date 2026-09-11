'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';
import { Mail, Phone, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SignupMethodPage() {
  const router = useRouter();
  const { setVerificationMethod, setOtpSentAt, setResendAttempts, setResendCooldownEnd, setIsOAuthFlow } = useSignup();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChooseMethod = (method: 'email' | 'phone') => {
    setVerificationMethod(method);
    setOtpSentAt(null);
    setResendAttempts(0);
    setResendCooldownEnd(null);
    router.push('/signup/verify');
  };

  const handleGoogleSignUp = async () => {
    setOauthLoading(true);
    setLocalError(null);
    try {
      setIsOAuthFlow(true);
      localStorage.setItem('oauth_signup_flow', 'true');
      
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      });
      if (oauthError) {
        setLocalError(`Google sign-up failed: ${oauthError.message}`);
        setOauthLoading(false);
        setIsOAuthFlow(false);
        localStorage.removeItem('oauth_signup_flow');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
      setOauthLoading(false);
      setIsOAuthFlow(false);
      localStorage.removeItem('oauth_signup_flow');
    }
  };

  return (
    <div className="skeuo-panel p-8 border-2 border-slate-300 max-w-md mx-auto">
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Patient Intake
        </span>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
          Create Patient Account
        </h2>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Select verification channel for clinical identity
        </p>
      </div>

      {localError && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-sm font-semibold">
          {localError}
        </div>
      )}

      {/* Google OAuth Option */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={oauthLoading}
        className="skeuo-btn-secondary w-full py-2.5 px-4 mb-5 text-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span>{oauthLoading ? 'Initiating Google Registration...' : 'Quick Register with Google'}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-slate-300"></div>
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">or verify directly</span>
        <div className="flex-1 h-px bg-slate-300"></div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleChooseMethod('email')}
          className="skeuo-btn-primary w-full py-3 px-4 text-sm"
        >
          <Mail className="w-4 h-4" />
          <span>Verify with Email Address</span>
        </button>

        <button
          type="button"
          onClick={() => handleChooseMethod('phone')}
          className="skeuo-btn-secondary w-full py-3 px-4 text-sm"
        >
          <Phone className="w-4 h-4 text-slate-700" />
          <span>Verify with Mobile Number</span>
        </button>
      </div>

      <div className="mt-8 pt-4 border-t-2 border-slate-200 text-center text-xs">
        <span className="text-slate-500 font-semibold uppercase tracking-wider">Already have a clinic profile? </span>
        <Link href="/login" className="text-emerald-700 hover:text-emerald-900 font-bold uppercase tracking-wider underline inline-flex items-center gap-1 ml-1">
          <span>Sign In</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
