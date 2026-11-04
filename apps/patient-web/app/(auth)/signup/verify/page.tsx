'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';
import { showAlert } from '@/components/ui/AppDialog';
import { Mail, ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function SignupVerifyPage() {
  const router = useRouter();
  const {
    verificationEmail,
    setVerificationEmail,
    verificationCode,
    setVerificationCode,
    otpSentAt,
    setOtpSentAt,
    resendAttempts,
    setResendAttempts,
    resendCooldownEnd,
    setResendCooldownEnd,
    setVerificationMethod,
  } = useSignup();

  const [verificationLoading, setVerificationLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Always enforce email verification
  useEffect(() => {
    setVerificationMethod('email');
  }, [setVerificationMethod]);

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

    const normalizedEmail = verificationEmail.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      setLocalError('Please enter a valid email address (e.g., patient@example.com).');
      return;
    }

    setVerificationLoading(true);

    try {
      setVerificationEmail(normalizedEmail);
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setLocalError(`Failed to send verification code: ${error.message}`);
      } else {
        setOtpSentAt(Date.now());
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

    const normalizedEmail = verificationEmail.trim().toLowerCase();

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: verificationCode.toString().trim(),
        type: 'email',
      });

      if (error) {
        setLocalError(`Verification failed: ${error.message}`);
      } else {
        setVerificationSuccess(true);
        setTimeout(() => {
          router.push('/signup/register');
        }, 1200);
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
      setLocalError(`Please wait ${cooldownRemaining} seconds before resending.`);
      return;
    }

    const newAttempts = resendAttempts + 1;
    setResendAttempts(newAttempts);

    if (newAttempts >= 2) {
      const cooldownEnd = Date.now() + 60 * 1000;
      setResendCooldownEnd(cooldownEnd);
      setLocalError('Code resent. You can resend again in 60 seconds.');
    }

    setVerificationLoading(true);

    try {
      const normalizedEmail = verificationEmail.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setLocalError(`Failed to resend code: ${error.message}`);
      } else {
        setOtpSentAt(Date.now());
        setVerificationCode('');
        showAlert('A new verification code has been dispatched to your email!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
    } finally {
      setVerificationLoading(false);
    }
  };

  const otpSent = otpSentAt !== null;

  return (
    <div className="skeuo-panel p-5 sm:p-8 border-2 border-slate-300 max-w-md mx-auto">
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-3 inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Clinical Identity Verification
        </span>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
          {otpSent ? 'Enter Security Code' : 'Verify Email Address'}
        </h2>
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          {otpSent
            ? `Enter the verification code sent to ${verificationEmail}`
            : 'We will send a one-time security code to your email'}
        </p>
      </div>

      {otpSent && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-3 rounded-sm mb-6 text-xs flex items-start gap-2 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold uppercase tracking-wider text-[11px] text-amber-950 mb-0.5">
              Email Delivery & Spam Notice
            </strong>
            <span>
              If you don&apos;t see the message in your Inbox within a minute, check your <strong>Spam or Junk folder</strong> and click <strong>&quot;Report Not Spam&quot;</strong> or <strong>&quot;Looks Safe&quot;</strong>.
            </span>
          </div>
        </div>
      )}

      {localError && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}

      {verificationSuccess && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="skeuo-panel p-8 max-w-sm w-full text-center space-y-4 border-2 border-emerald-500 bg-white">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Email Verified</h3>
            <p className="text-xs text-slate-600 font-semibold">Your identity has been authenticated.</p>
            <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider animate-pulse">Loading registration intake...</p>
          </div>
        </div>
      )}

      {!otpSent ? (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={verificationEmail}
                onChange={(e) => setVerificationEmail(e.target.value)}
                required
                autoComplete="email"
                spellCheck={false}
                className="skeuo-input w-full text-sm pl-10"
                placeholder="you@example.com"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports Gmail, Yahoo, Outlook, iCloud, and custom clinical email domains.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/signup')}
              className="skeuo-btn-secondary flex-1 py-2.5 text-xs uppercase font-bold flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="submit"
              disabled={verificationLoading}
              className="skeuo-btn-primary flex-1 py-2.5 text-xs uppercase font-bold"
            >
              {verificationLoading ? 'Sending Code...' : 'Send Security Code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 text-center">
              Security Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                setVerificationCode(val);
                if (val.length >= 6 && !verificationLoading) {
                  // Let user see 6 or 8 digits
                }
              }}
              required
              autoFocus
              className={`skeuo-input w-full text-center text-2xl tracking-[0.3em] font-mono font-bold transition py-3 ${
                verificationCode.length >= 6 && !verificationLoading
                  ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                  : ''
              }`}
              placeholder="••••••••"
              maxLength={8}
              inputMode="numeric"
            />
            <p className="text-[11px] text-slate-500 text-center mt-2">
              {verificationCode.length === 0
                ? 'Enter the 6 to 8-digit code sent to your email'
                : verificationCode.length < 6
                  ? `${6 - verificationCode.length} more digit${6 - verificationCode.length !== 1 ? 's' : ''} needed (min 6 digits)`
                  : `${verificationCode.length} digits entered. Click Verify below.`}
            </p>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
              <p className="text-xs text-slate-500 mb-1.5">Didn&apos;t receive your code?</p>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={verificationLoading || (resendCooldownEnd !== null && Date.now() < resendCooldownEnd)}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold uppercase tracking-wider underline disabled:text-slate-400 inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${verificationLoading ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldownEnd && Date.now() < resendCooldownEnd
                    ? `Resend in ${cooldownRemaining}s`
                    : `Resend code (${resendAttempts}/2)`}
                </span>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setOtpSentAt(null);
                setVerificationCode('');
                setResendAttempts(0);
                setResendCooldownEnd(null);
              }}
              className="skeuo-btn-secondary flex-1 py-2.5 text-xs uppercase font-bold flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Email</span>
            </button>
            <button
              type="submit"
              disabled={verificationLoading || verificationCode.length < 6}
              className="skeuo-btn-primary flex-1 py-2.5 text-xs uppercase font-bold disabled:opacity-50"
            >
              {verificationLoading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
