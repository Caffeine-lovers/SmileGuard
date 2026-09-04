'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';
import { Eye, EyeOff, Check, X, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SignupRegisterPage() {
  const router = useRouter();
  const {
    formData,
    updateFormField,
    isOAuthFlow,
    setCurrentAuthUser,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
  } = useSignup();

  const [localError, setLocalError] = useState<string | null>(null);
  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  // Check for OAuth flow on mount
  useEffect(() => {
    const checkOAuthFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('oauth') === 'true') {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setCurrentAuthUser(user);
          updateFormField('email', user.email || '');
          updateFormField('name', user.user_metadata?.full_name || user.email?.split('@')[0] || '');
        }
      }
    };

    checkOAuthFlow();
  }, [setCurrentAuthUser, updateFormField]);

  const checkPasswordStrength = (password: string) => {
    return {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      length: password.length >= 8,
    };
  };

  const handlePasswordChange = (newPassword: string) => {
    updateFormField('password', newPassword);
    setPasswordCheck(checkPasswordStrength(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.name) {
      setLocalError('Please enter your full legal name');
      return;
    }

    if (!isOAuthFlow) {
      if (!formData.password) {
        setLocalError('Please enter a password');
        return;
      }

      if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
        setLocalError('Password does not meet clinical security requirements');
        return;
      }
    } else {
      if (!formData.password) {
        setLocalError('Please set a password for future logins');
        return;
      }

      if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
        setLocalError('Password does not meet clinical security requirements');
        return;
      }
    }

    router.push('/signup/medical');
  };

  return (
    <div className="skeuo-panel p-8 border-2 border-slate-300 max-w-md mx-auto">
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Step 2 of 3
        </span>
        <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
          Profile Credentials
        </h2>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Set your legal name and clinic portal credentials
        </p>
      </div>

      {localError && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-sm font-semibold">
          {localError}
        </div>
      )}

      <form onSubmit={handleNext} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Full Legal Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateFormField('name', e.target.value)}
            required
            className="skeuo-input w-full text-sm"
            placeholder="e.g. Maria Santos"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Registered Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateFormField('email', e.target.value)}
            required
            readOnly={Boolean(isOAuthFlow)}
            className="skeuo-input w-full text-sm bg-slate-50 text-slate-700 cursor-not-allowed"
          />
        </div>

        {isOAuthFlow && (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-sm p-3 mb-2">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              Credential Setup Required
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Set a portal password so you can sign in directly without Google in the future.
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            {isOAuthFlow ? 'Set Portal Password' : 'Password'}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className="skeuo-input w-full text-sm pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-sm text-xs space-y-1.5">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">Password Requirements:</p>
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
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.length ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.length ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least 8 characters in length</span>
            </div>
          </div>
        </div>

        {!isOAuthFlow && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => updateFormField('confirmPassword', e.target.value)}
                required
                className="skeuo-input w-full text-sm pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="skeuo-btn-secondary flex-1 py-2.5 text-xs uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            className="skeuo-btn-primary flex-1 py-2.5 text-xs uppercase tracking-wider"
          >
            <span>Proceed to Medical Intake</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
