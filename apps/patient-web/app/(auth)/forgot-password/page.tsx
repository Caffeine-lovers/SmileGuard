'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@smileguard/shared-hooks';

export default function ForgotPasswordPage() {
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    setMessage('');

    if (!email) {
      setErrorLocal('Please enter your email address.');
      return;
    }

    try {
      const res = await resetPassword(email);
      if (res.success) {
        setMessage('Password reset email sent! Please check your inbox.');
      }
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Failed to send reset email. Please try again.'
      );
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-8 text-text-primary">
        Reset Password
      </h2>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {message}
        </div>
      )}

      {errorLocal && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6">
          {errorLocal}
        </div>
      )}

      {!message ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-text-secondary mb-4 text-center">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-text-secondary mb-6">
            If an account exists for {email}, you will receive a password reset link shortly.
          </p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="text-text-link font-medium hover:underline">
          Return to Login
        </Link>
      </div>
    </div>
  );
}