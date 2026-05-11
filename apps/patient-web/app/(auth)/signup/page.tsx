'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';

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
      // Mark as OAuth SIGNUP (not signin) - persist in localStorage
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
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Create Account
      </h2>
      <p className="text-center text-text-secondary mb-8">
        Choose how you'd like to verify your identity
      </p>

      {localError && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {localError}
        </div>
      )}

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => handleChooseMethod('email')}
          className="w-full flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-3 px-4 rounded-lg transition"
        >
          ✉️ Verify with Email
        </button>

        <button
          type="button"
          onClick={() => handleChooseMethod('phone')}
          className="w-full flex items-center justify-center gap-3 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-3 px-4 rounded-lg transition"
        >
          📱 Verify with Phone
        </button>
      </div>

      <div className="mt-6 text-center text-sm">
        <span className="text-text-secondary">Already have an account? </span>
        <a href="/login" className="text-brand-primary hover:underline font-medium">
          Sign in
        </a>
      </div>
    </div>
  );
}
