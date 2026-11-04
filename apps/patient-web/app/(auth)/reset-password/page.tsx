'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { Lock, Eye, EyeOff, Check, X, ShieldCheck, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1. Check for PKCE query parameter ?code= (standard Supabase email link)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        supabase.auth.exchangeCodeForSession(code)
          .then(({ error }) => {
            if (error) {
              setErrorLocal(`Recovery verification error: ${error.message}`);
              setReady(true);
            } else {
              verifySession();
            }
          })
          .catch((err) => {
            setErrorLocal(`Unexpected recovery error: ${err.message}`);
            setReady(true);
          });
        return;
      }
    }

    // 2. Try to get hash parameters from URL (for legacy hash recovery links)
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        }).then(() => {
          verifySession();
        }).catch((error) => {
          setErrorLocal(`Error setting recovery session: ${error.message}`);
          setReady(true);
        });
        return;
      }
    }

    // 3. If session was already established by /auth/callback gateway, verify it directly
    verifySession();
  }, []);

  const verifySession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setErrorLocal(error.message);
        setReady(true);
        return;
      }
      if (session?.user) {
        setReady(true);
      } else {
        setErrorLocal('This password reset link is invalid, expired, or has already been used.');
        setReady(true);
      }
    } catch {
      setErrorLocal('Error retrieving authenticated session. Please request a new reset link.');
      setReady(true);
    }
  };

  const passwordCheck = {
    length: newPassword.length >= 8,
    hasUpperCase: /[A-Z]/.test(newPassword),
    hasLowerCase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
  };

  const isPasswordValid = Object.values(passwordCheck).every(Boolean);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    if (!isPasswordValid) {
      setErrorLocal('Please satisfy all password complexity requirements before proceeding.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorLocal('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setErrorLocal(error.message);
      } else {
        setMessage('Password successfully updated! Redirecting to sign in...');
        setTimeout(() => {
          router.replace('/login');
        }, 1600);
      }
    } catch (err) {
      setErrorLocal(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="skeuo-panel p-8 text-center max-w-md mx-auto border-2 border-slate-300">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-b-emerald-600 mx-auto mb-4"></div>
        <span className="skeuo-badge skeuo-badge-mint mb-2">Security Handshake</span>
        <p className="text-slate-800 font-bold text-sm tracking-wide mt-2">Verifying authorized recovery session...</p>
      </div>
    );
  }

  return (
    <div className="skeuo-panel p-5 sm:p-8 border-2 border-slate-300 max-w-md mx-auto">
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-3 inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Credentials Update
        </span>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
          Set New Password
        </h2>
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Create a secure password for your clinical record
        </p>
      </div>

      {errorLocal && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorLocal}</span>
        </div>
      )}

      {message && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 p-4 rounded-sm text-xs space-y-1 mb-6">
          <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Success</span>
          </div>
          <p className="text-emerald-800">{message}</p>
        </div>
      )}

      {!message && (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="skeuo-input w-full text-sm pl-10 pr-10"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="skeuo-input w-full text-sm pl-10 pr-10"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] font-semibold text-red-600 mt-1">Passwords do not match.</p>
            )}
          </div>

          {/* Password Requirements Checklist */}
          <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-sm text-xs space-y-1.5">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Password Requirements:
            </p>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.length ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.length ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least 8 characters in length</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasUpperCase ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasUpperCase ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least one uppercase letter (A-Z)</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasLowerCase ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasLowerCase ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least one lowercase letter (a-z)</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least one number (0-9)</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasSpecialChar ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasSpecialChar ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least one special character (!@#$%...)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid || newPassword !== confirmPassword}
            className="skeuo-btn-primary w-full py-2.5 text-sm uppercase tracking-wider font-bold mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
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
