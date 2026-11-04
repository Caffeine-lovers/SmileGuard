'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@smileguard/supabase-client';
import { Mail, ArrowLeft, ShieldAlert, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer to prevent rapid resend spam (which triggers email spam filters)
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const sendResetEmail = async (targetEmail: string) => {
    setErrorLocal(null);

    // 1. Sanitize and normalize email address (caters to all types of input: case variations, trailing spaces, plus-addressing)
    const normalizedEmail = targetEmail.trim().toLowerCase();

    // 2. Validate email syntax supporting standard, subdomains, plus-tags, and international TLDs
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      setErrorLocal('Please enter a valid email address (e.g., patient@example.com).');
      return;
    }

    setLoading(true);
    try {
      // 3. Resolve canonical public base URL and route through Supabase authentication gateway
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || 'https://patient-web-mu.vercel.app');

      // The reset URL calls the official Supabase authentication callback so PKCE / session exchange completes properly
      const redirectTo = `${baseUrl}/auth/callback?next=/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (error) throw error;

      setSentEmail(normalizedEmail);
      setMessage(`A password reset link has been dispatched to ${normalizedEmail}.`);
      setCooldown(60); // 60s cooldown to protect IP sender reputation and avoid spam flagging
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Failed to send reset email. Please verify your address and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetEmail(email);
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading || !sentEmail) return;
    await sendResetEmail(sentEmail);
  };

  return (
    <div className="skeuo-panel p-5 sm:p-8 border-2 border-slate-300 max-w-md mx-auto">
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-3 inline-flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" />
          Account Security
        </span>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
          Password Recovery
        </h2>
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Verify identity via authorized clinical email
        </p>
      </div>

      {errorLocal && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorLocal}</span>
        </div>
      )}

      {!message ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed text-center">
            Enter the email address registered with your SmileGuard patient account. We will send you an authorized recovery link to set a new password.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                spellCheck={false}
                className="skeuo-input w-full text-sm pl-10"
                placeholder="patient@example.com"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports all standard email providers (Gmail, Outlook, Yahoo, iCloud, custom domains).
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="skeuo-btn-primary w-full py-2.5 text-sm uppercase tracking-wider font-bold mt-2"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Sending Recovery Link...
              </span>
            ) : (
              'Send Password Reset Link'
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 p-4 rounded-sm text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Recovery Link Dispatched</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              An authorized recovery link has been sent to: <strong className="font-mono text-emerald-950">{sentEmail}</strong>
            </p>
          </div>

          {/* Critical Anti-Spam / Junk Guidance for all email providers */}
          <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-sm text-xs space-y-2">
            <p className="font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              Prevent Link From Being Filtered
            </p>
            <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-1 leading-relaxed">
              <li>
                Automated security emails may occasionally land in your <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> folder.
              </li>
              <li>
                If you find it in Spam or Junk, click <strong>&quot;Report Not Spam&quot;</strong> or <strong>&quot;Looks Safe&quot;</strong> to activate the link.
              </li>
              <li>
                The recovery link is valid for 1 hour from issuance.
              </li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              className="skeuo-btn-secondary w-full py-2 text-xs uppercase font-bold flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>
                {cooldown > 0 ? `Resend Link in ${cooldown}s` : 'Resend Recovery Email'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMessage('');
                setErrorLocal(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline text-center py-1"
            >
              Enter a different email address
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t-2 border-slate-200 text-center">
        <Link
          href="/login"
          className="text-emerald-700 hover:text-emerald-900 font-bold uppercase tracking-wider text-xs inline-flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Clinic Sign In</span>
        </Link>
      </div>
    </div>
  );
}
