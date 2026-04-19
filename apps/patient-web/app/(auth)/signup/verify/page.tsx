'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';

export default function SignupVerifyPage() {
  const router = useRouter();
  const {
    verificationMethod,
    verificationEmail,
    setVerificationEmail,
    verificationPhone,
    setVerificationPhone,
    verificationCode,
    setVerificationCode,
    countryCode,
    setCountryCode,
    otpSentAt,
    setOtpSentAt,
    resendAttempts,
    setResendAttempts,
    resendCooldownEnd,
    setResendCooldownEnd,
  } = useSignup();

  const [verificationLoading, setVerificationLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Handle cooldown timer
  useEffect(() => {
    if (!resendCooldownEnd) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((resendCooldownEnd - now) / 1000));
      setCooldownRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        setResendCooldownEnd(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldownEnd, setResendCooldownEnd]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setVerificationLoading(true);

    try {
      if (verificationMethod === 'email') {
        const { data, error } = await supabase.auth.signInWithOtp({
          email: verificationEmail,
          options: {
            shouldCreateUser: true,
          },
        });

        if (error) {
          setLocalError(`Failed to send verification code: ${error.message}`);
        } else {
          setOtpSentAt(Date.now());
        }
      } else if (verificationMethod === 'phone') {
        const cleanedPhone = verificationPhone.replace(/\D/g, '');

        if (cleanedPhone.length < 7) {
          setLocalError('Phone number must be at least 7 digits');
          setVerificationLoading(false);
          return;
        }

        const fullPhone = `${countryCode}${cleanedPhone}`;

        const { data, error } = await supabase.auth.signInWithOtp({
          phone: fullPhone,
        });

        if (error) {
          if (error.message?.includes('SMS')) {
            setLocalError('SMS not configured. Please use email instead.');
          } else {
            setLocalError(`Failed to send SMS code: ${error.message}`);
          }
        } else {
          setOtpSentAt(Date.now());
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setVerificationLoading(true);

    try {
      if (verificationMethod === 'email') {
        const { data, error } = await supabase.auth.verifyOtp({
          email: verificationEmail,
          token: verificationCode.toString(),
          type: 'email',
        });

        if (error) {
          setLocalError(`Verification failed: ${error.message}`);
        } else {
          setVerificationSuccess(true);
          setTimeout(() => {
            router.push('/signup/register');
          }, 1500);
        }
      } else if (verificationMethod === 'phone') {
        const cleanedPhone = verificationPhone.replace(/\D/g, '');
        const fullPhone = `${countryCode}${cleanedPhone}`;

        const { data, error } = await supabase.auth.verifyOtp({
          phone: fullPhone,
          token: verificationCode.toString(),
          type: 'sms',
        });

        if (error) {
          setLocalError(`Verification failed: ${error.message}`);
        } else {
          setVerificationSuccess(true);
          setTimeout(() => {
            router.push('/signup/register');
          }, 1500);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLocalError(null);

    const timeSinceLastOTP = otpSentAt ? Date.now() - otpSentAt : null;
    if (timeSinceLastOTP && timeSinceLastOTP < 60000) {
      const secondsRemaining = Math.ceil((60000 - timeSinceLastOTP) / 1000);
      setLocalError(`Please wait ${secondsRemaining} seconds before requesting a new code.`);
      return;
    }

    if (resendCooldownEnd && Date.now() < resendCooldownEnd) {
      setLocalError(`Please wait ${cooldownRemaining} seconds before resending`);
      return;
    }

    const newAttempts = resendAttempts + 1;
    setResendAttempts(newAttempts);

    if (newAttempts >= 2) {
      const cooldownEnd = Date.now() + 60 * 1000;
      setResendCooldownEnd(cooldownEnd);
      setLocalError('Code resent. You can resend again in 60 seconds.');
      return;
    }

    setVerificationLoading(true);

    try {
      if (verificationMethod === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email: verificationEmail,
          options: {
            shouldCreateUser: true,
          },
        });

        if (error) {
          setLocalError(`Failed to resend code: ${error.message}`);
        } else {
          setOtpSentAt(Date.now());
          setVerificationCode('');
          alert('Verification code resent to your email!');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
    } finally {
      setVerificationLoading(false);
    }
  };

  // Show input form if not sent yet, otherwise show code entry
  const otpSent = otpSentAt !== null;

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        {otpSent ? 'Verify Code' : 'Enter ' + (verificationMethod === 'email' ? 'Email' : 'Phone')}
      </h2>
      <p className="text-center text-text-secondary mb-8">
        {otpSent
          ? `Enter the 6-digit code sent to your ${verificationMethod}`
          : `We'll send a verification code to your ${verificationMethod}`}
      </p>

      {localError && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {localError}
        </div>
      )}

      {verificationSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center space-y-4 shadow-xl">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold text-text-primary">Verification Successful! ✓</h3>
            <p className="text-text-secondary">Your {verificationMethod} has been verified.</p>
            <p className="text-sm text-text-secondary">Proceeding to registration...</p>
          </div>
        </div>
      )}

      {!otpSent ? (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          {verificationMethod === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Email Address</label>
              <input
                type="email"
                value={verificationEmail}
                onChange={(e) => setVerificationEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="you@example.com"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Phone Number</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-2 py-2 border border-border-card rounded-md bg-white text-xs w-20"
                >
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+91">+91 (IN)</option>
                </select>
                <input
                  type="tel"
                  value={verificationPhone}
                  onChange={(e) => setVerificationPhone(e.target.value)}
                  required
                  className="flex-1 px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="(555) 000-0000"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={verificationLoading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {verificationLoading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Verification Code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                setVerificationCode(val);
                if (val.length >= 6 && !verificationLoading) {
                  setTimeout(() => {
                    const form = e.currentTarget?.closest('form');
                    if (form) form.requestSubmit();
                  }, 100);
                }
              }}
              required
              className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none text-center text-2xl tracking-widest font-bold transition ${
                verificationCode.length >= 6 && !verificationLoading
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-border-card'
              }`}
              placeholder="000000"
              maxLength={8}
              inputMode="numeric"
            />
            <p className="text-xs text-text-secondary mt-2">
              {verificationCode.length === 0
                ? 'Enter the 6-digit code'
                : verificationCode.length < 6
                  ? `${6 - verificationCode.length} more digit${6 - verificationCode.length !== 1 ? 's' : ''} needed`
                  : '✓ Code ready - verifying...'}
            </p>

            <div className="mt-4 pt-4 border-t border-border-card">
              <p className="text-xs text-text-secondary mb-2">Didn't receive the code?</p>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={verificationLoading || (resendCooldownEnd && Date.now() < resendCooldownEnd)}
                className="text-xs text-brand-primary hover:text-brand-primary/80 disabled:text-text-secondary underline font-medium"
              >
                {resendCooldownEnd && Date.now() < resendCooldownEnd
                  ? `Resend in ${cooldownRemaining}s`
                  : `Resend code (${resendAttempts}/2)`}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setOtpSentAt(null);
                setVerificationCode('');
                setResendAttempts(0);
                setResendCooldownEnd(null);
              }}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={verificationLoading || verificationCode.length < 6}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {verificationLoading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
