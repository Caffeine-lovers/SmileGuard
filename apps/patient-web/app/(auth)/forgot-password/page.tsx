'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@smileguard/supabase-client';
import { checkEmailContext } from '@/lib/email-context';
import { ArrowLeft, UserPlus, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [actionLink, setActionLink] = useState<{ text: string; href: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    setMessage('');
    setActionLink(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorLocal('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      // 1. Confirm email context before dispatching reset email
      const context = await checkEmailContext(normalizedEmail);

      // Case A: Email is not registered at all
      if (!context.exists && !context.has_profile) {
        setErrorLocal('This email is not registered with SmileGuard. Please check your email or create an account.');
        setActionLink({ text: 'Create an Account', href: '/signup' });
        setLoading(false);
        return;
      }

      // Case B: Profile exists but registration is incomplete (missing medical intake)
      if (context.has_profile && !context.has_medical_intake) {
        setErrorLocal('This account has not completed registration yet (medical intake missing). Please complete your registration first.');
        setActionLink({ text: 'Complete Registration', href: '/signup' });
        setLoading(false);
        return;
      }

      // Case C: Valid registered account with medical intake
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });
      if (error) throw error;
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Failed to send reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-text-primary">
        Reset Password
      </h2>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6 text-sm">
          {message}
        </div>
      )}

      {errorLocal && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorLocal}</span>
          </div>
          {actionLink && (
            <div className="pt-2 border-t border-brand-danger/20">
              <Link
                href={actionLink.href}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline bg-white px-3 py-1.5 rounded border border-border-card shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{actionLink.text}</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {!message ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs sm:text-sm text-text-secondary mb-4 text-center">
            Enter your registered email address and we&apos;ll send you a link to reset your password.
          </p>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorLocal) {
                  setErrorLocal(null);
                  setActionLink(null);
                }
              }}
              required
              className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary text-sm"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition text-sm cursor-pointer"
          >
            {loading ? 'Confirming Email...' : 'Send Reset Link'}
          </button>
        </form>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-text-secondary text-sm mb-6">
            If an account exists for {email}, you will receive a password reset link shortly.
          </p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="inline-flex items-center gap-1 text-text-link text-xs font-semibold hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Login</span>
        </Link>
      </div>
    </div>
  );
}
