'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { clearPatientUserCookie } from '@/lib/auth-cookie';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const hasExchangedRef = useRef(false);

  const cleanUrl = () => {
    if (typeof window !== 'undefined' && (window.location.search || window.location.hash)) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('next');
        url.searchParams.delete('type');
        const newSearch = url.searchParams.toString();
        const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState(null, '', newUrl);
      } catch { }
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    // Listen to Supabase auth events (especially PASSWORD_RECOVERY and SIGNED_IN)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[reset-password] Auth event:', event, 'Has session:', Boolean(session?.user));
      if (!isSubscribed) return;

      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setSessionValid(true);
        setReady(true);
        cleanUrl();
      }
    });

    const initRecovery = async () => {
      console.log('[reset-password] Verifying recovery state...');

      // 1. Check if session is already established
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[reset-password] getSession error:', sessionError.message);
        }

        if (session?.user) {
          console.log('[reset-password] Active session already found for user:', session.user.id);
          if (isSubscribed) {
            setSessionValid(true);
            setReady(true);
            cleanUrl();
          }
          return;
        }
      } catch (err) {
        console.warn('[reset-password] Initial session check exception:', err);
      }

      // 2. Check for PKCE ?code= parameter
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code && !hasExchangedRef.current) {
          hasExchangedRef.current = true;
          console.log('[reset-password] Exchanging PKCE auth code...');

          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.warn('[reset-password] Code exchange error:', error.message);
            } else if (data?.session?.user) {
              console.log('[reset-password] Successfully exchanged code for session');
              if (isSubscribed) {
                setSessionValid(true);
                setReady(true);
                cleanUrl();
              }
              return;
            }
          } catch (exchangeErr) {
            console.warn('[reset-password] Code exchange exception:', exchangeErr);
          }

          // Fallback: Check if detectSessionInUrl / GoTrueClient already exchanged the code in background
          try {
            const { data: fallbackData } = await supabase.auth.getSession();
            if (fallbackData?.session?.user) {
              console.log('[reset-password] Fallback session detected after code exchange');
              if (isSubscribed) {
                setSessionValid(true);
                setReady(true);
                cleanUrl();
              }
              return;
            }
          } catch { }
        }
      }

      // 3. Check for legacy hash fragment (#access_token=...)
      const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
      if (hash && hash.includes('access_token')) {
        console.log('[reset-password] Found access_token in hash, parsing...');
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            if (!error && data?.session?.user) {
              console.log('[reset-password] Session established from hash tokens');
              if (isSubscribed) {
                setSessionValid(true);
                setReady(true);
                cleanUrl();
              }
              return;
            }
          } catch (hashErr) {
            console.warn('[reset-password] Error setting session from hash:', hashErr);
          }
        }
      }

      // 4. If after checks no active session was established, wait briefly before declaring invalid
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (isSubscribed) {
        const { data: finalCheck } = await supabase.auth.getSession();
        if (finalCheck?.session?.user) {
          setSessionValid(true);
          setReady(true);
          cleanUrl();
        } else {
          console.warn('[reset-password] No valid session established');
          setSessionValid(false);
          setStatus('error');
          setStatusMessage('This password reset link is invalid or has expired. Please request a new one.');
          setReady(true);
        }
      }
    };

    initRecovery();

    return () => {
      isSubscribed = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');
    setStatusMessage(null);

    if (newPassword.length < 8) {
      setStatus('error');
      setStatusMessage('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setStatusMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);

    try {
      // Confirm current session is active before updating
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setStatus('error');
        setStatusMessage('Your password reset session has expired. Please request a new reset link.');
        setSessionValid(false);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setStatus('error');
        setStatusMessage(error.message);
        setLoading(false);
        return;
      }

      setStatus('success');
      setStatusMessage('Password updated successfully! Redirecting to login...');

      try {
        localStorage.removeItem('smileguard_auth_recovery_flow');
      } catch { }

      // Sign out of the recovery session so user can log in fresh with the new password
      await supabase.auth.signOut().catch(() => { });
      clearPatientUserCookie();

      setTimeout(() => {
        router.replace('/login?reset=success');
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password. Please try again.';
      setStatus('error');
      setStatusMessage(msg);
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="bg-bg-surface rounded-lg shadow-lg p-8 text-center border border-border-card max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
        <p className="text-text-secondary mt-4 font-medium text-sm">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-6 sm:p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-text-primary flex items-center justify-center gap-2">
        <Lock className="w-6 h-6 text-brand-primary" />
        <span>Set New Password</span>
      </h2>

      <div className="mb-6 p-3 bg-amber-50 border border-amber-300 rounded-sm text-xs text-amber-900 leading-relaxed space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <span>⚠️</span> Email Security &amp; Delivery Advisory:
        </p>
        <p className="text-[11px] text-amber-800">
          Password recovery links are occasionally flagged by email filters (&quot;This message might be dangerous&quot;) or routed to Spam/Junk. If a warning appears in your inbox, click &quot;Report not spam&quot; or &quot;Looks safe&quot; to authorize the reset request.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`px-4 py-3 rounded mb-6 text-sm flex items-start gap-2.5 ${
            status === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-brand-danger/10 border border-brand-danger text-brand-danger'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {sessionValid && status !== 'success' && (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setStatusMessage(null);
                  }
                }}
                required
                className="w-full px-3.5 py-2 pr-10 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary text-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setStatusMessage(null);
                  }
                }}
                required
                className="w-full px-3.5 py-2 pr-10 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition bg-bg-surface text-text-primary text-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card disabled:cursor-not-allowed text-text-on-avatar font-medium py-2.5 px-4 rounded-lg transition text-sm cursor-pointer shadow-xs"
          >
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      )}

      {!sessionValid && status !== 'success' && (
        <div className="text-center pt-2">
          <Link
            href="/forgot-password"
            className="inline-block bg-brand-primary hover:bg-brand-primary/90 text-text-on-avatar font-medium py-2 px-4 rounded-lg transition text-sm"
          >
            Request New Reset Link
          </Link>
        </div>
      )}

      <div className="mt-6 text-center pt-4 border-t border-border-card/50">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-text-link text-xs font-semibold hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Login</span>
        </Link>
      </div>
    </div>
  );
}
