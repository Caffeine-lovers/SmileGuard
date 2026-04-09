'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

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

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-8 text-text-primary">
        Patient Login
      </h2>

      {(error || localError) && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6">
          {error || localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          Don't have an account?{' '}
          <Link href="/signup" className="text-text-link font-medium hover:underline">
            Sign up
          </Link>
        </p>
        <p className="text-sm text-text-secondary mt-2">
          <Link href="/forgot-password" className="text-text-link hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
