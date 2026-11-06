'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { checkEmailContext, isEmailInUse, isStaffEmail } from '@/lib/email-context';
import { AlertCircle, LogIn } from 'lucide-react';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';
import { Eye, EyeOff, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';

export default function SignupRegisterPage() {
  const router = useRouter();
  const {
    formData,
    setFormData,
    updateFormField,
    isOAuthFlow,
    setIsOAuthFlow,
    setCurrentAuthUser,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    purgeIncompleteRegistration,
    verificationMethod,
    verificationEmail,
  } = useSignup();

  const [localError, setLocalError] = useState<string | null>(null);
  const [actionLink, setActionLink] = useState<{ text: string; href: string } | null>(null);
  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  const oauthInitializedRef = useRef(false);

  const checkPasswordStrength = (password: string) => {
    return {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      length: password.length >= 8,
    };
  };

  // Initialize and persist password strength feedback from formData
  useEffect(() => {
    if (formData.password) {
      setPasswordCheck(checkPasswordStrength(formData.password));
    } else {
      setPasswordCheck({
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
        hasSpecialChar: false,
        length: false,
      });
    }
  }, [formData.password]);

  // Check for OAuth flow on mount ONCE (never overwrite user's edits)
  useEffect(() => {
    if (oauthInitializedRef.current) return;
    oauthInitializedRef.current = true;

    const checkOAuthFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      const isOauthParam = params.get('oauth') === 'true';
      const isOauthStorage = typeof window !== 'undefined' && localStorage.getItem('oauth_signup_flow') === 'true';

      if (isOauthParam || isOauthStorage) {
        setIsOAuthFlow(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setCurrentAuthUser(user);
          setIsOAuthFlow(true);

          setFormData((prev) => {
            const currentEmail = prev.email || user.email || '';
            // If the user already has a name typed or stored, PRESERVE it completely!
            if (prev.name && prev.name.trim().length > 0) {
              return { ...prev, email: currentEmail };
            }
            // Only set a default if empty
            const googleFullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
            const fallbackName = googleFullName || (user.email ? user.email.split('@')[0] : '');
            return {
              ...prev,
              email: currentEmail,
              name: fallbackName,
            };
          });
        }
      }
    };

    if (verificationEmail && !formData.email) {
      updateFormField('email', verificationEmail);
    }
    checkOAuthFlow();
  }, [setCurrentAuthUser, setIsOAuthFlow, setFormData, verificationEmail, formData.email, updateFormField]);

  const handlePasswordChange = (newPassword: string) => {
    updateFormField('password', newPassword);
    setPasswordCheck(checkPasswordStrength(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setActionLink(null);

    // Confirm email context: Check if email is already registered with completed medical intake
    if (formData.email) {
      try {
        const context = await checkEmailContext(formData.email);
        if (isEmailInUse(context)) {
          setLocalError(
            isStaffEmail(context)
              ? 'This email is already used by a clinic staff account. Please use a different email.'
              : 'This email is already registered. Please sign in to your account.'
          );
          setActionLink({ text: 'Sign In to Account', href: '/login' });
          return;
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Could not check this email. Please try again.');
        return;
      }
    }

    const trimmedName = (formData.name || '').trim();
    if (!trimmedName) {
      setLocalError('Please enter your full legal name');
      return;
    }
    // Auto-trim leading and trailing whitespaces
    updateFormField('name', trimmedName);

    if (!formData.password) {
      setLocalError('Please enter a password');
      return;
    }

    if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
      setLocalError('Password does not meet clinical security requirements');
      return;
    }

    // Strict password match verification
    if (!formData.confirmPassword) {
      setLocalError('Please confirm your password');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match. Please verify your confirm password.');
      return;
    }

    router.push('/signup/medical');
  };

  const handleCancelToLogin = async () => {
    try {
      await purgeIncompleteRegistration();
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="skeuo-panel p-8 border-2 border-slate-300 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Profile Credentials
        </h2>
      </div>

      {localError && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 rounded-sm mb-6 text-sm font-semibold space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{localError}</span>
          </div>
          {actionLink && (
            <div className="pt-2 border-t border-red-200">
              <Link
                href={actionLink.href}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:underline bg-white px-3 py-1.5 rounded border border-slate-300 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{actionLink.text}</span>
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleNext} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            id="fullLegalName"
            name="name"
            value={formData.name || ''}
            onChange={(e) => updateFormField('name', e.target.value)}
            required
            className="skeuo-input w-full text-sm"
            placeholder="e.g. Maria Santos"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateFormField('email', e.target.value)}
            required
            readOnly={Boolean(isOAuthFlow || verificationMethod === 'email' || verificationEmail)}
            className={`skeuo-input w-full text-sm ${Boolean(isOAuthFlow || verificationMethod === 'email' || verificationEmail) ? 'bg-slate-50 text-slate-700 cursor-not-allowed' : ''}`}
          />
        </div>

        {isOAuthFlow && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-sm px-3 py-2 text-xs font-medium text-emerald-800">
            Connected with Google
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className="skeuo-input w-full text-sm pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
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
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => updateFormField('confirmPassword', e.target.value)}
              required
              className="skeuo-input w-full text-sm pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
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

          <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-sm text-xs space-y-1.5">
            <p className="font-semibold text-slate-700 text-xs mb-1">Password requirements:</p>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.length ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.length ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasUpperCase ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasUpperCase ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>Uppercase letter (A-Z)</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasLowerCase ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasLowerCase ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>Lowercase letter (a-z)</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>Number (0-9)</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${passwordCheck.hasSpecialChar ? 'text-emerald-700' : 'text-slate-500'}`}>
              {passwordCheck.hasSpecialChar ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <span>Special character (!@#$%...)</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancelToLogin}
            className="skeuo-btn-secondary flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            className="skeuo-btn-primary flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
