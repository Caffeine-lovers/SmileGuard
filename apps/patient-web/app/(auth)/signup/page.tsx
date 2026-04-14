'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { EMPTY_MEDICAL_INTAKE } from '@smileguard/shared-types';

export default function SignupPage() {
  const router = useRouter();
  const { register, loading, error: authError } = useAuth();
  const [step, setStep] = useState(1); // 1: Basic, 2: SMS, 3: OTP Code, 4: Medical, 5: Password
  const [localError, setLocalError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpRequestTimes, setOtpRequestTimes] = useState<number[]>([]);
  const [nextAvailableTime, setNextAvailableTime] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    service: 'General',
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
  });

  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  // Helper function to check password strength
  const checkPasswordStrength = (password: string) => {
    return {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      length: password.length >= 8,
    };
  };

  // Countdown timer for OTP cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Check soft lock and update next available time
  useEffect(() => {
    if (otpRequestTimes.length === 0) {
      setNextAvailableTime(null);
      return;
    }

    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour in milliseconds
    const recentRequests = otpRequestTimes.filter(time => time > oneHourAgo);

    if (recentRequests.length >= 5) {
      // User has hit the limit, calculate when they can try again
      const oldestRequest = Math.min(...recentRequests);
      const nextAvailable = oldestRequest + 3600000; // 1 hour after oldest request
      setNextAvailableTime(nextAvailable);
    } else {
      setNextAvailableTime(null);
    }
  }, [otpRequestTimes]);

  const handlePasswordChange = (newPassword: string) => {
    setFormData({ ...formData, password: newPassword });
    setPasswordCheck(checkPasswordStrength(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Step 1: Collect Name, Email & Phone
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phone || !formData.password) {
        setLocalError('Please fill in all fields');
        return;
      }

      if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
        setLocalError('Password does not meet requirements');
        return;
      }

      setStep(2);
      return;
    }

    // Step 2: Send SMS OTP with soft lock (5 per hour)
    if (step === 2) {
      const now = Date.now();

      // Check soft lock
      if (nextAvailableTime && now < nextAvailableTime) {
        const minutesRemaining = Math.ceil((nextAvailableTime - now) / 60000);
        setLocalError(`Too many requests. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`);
        return;
      }

      // Track request and move to OTP entry
      const newRequestTimes = [...otpRequestTimes, now];
      setOtpRequestTimes(newRequestTimes);
      setStep(3);
      setOtpCooldown(60);
      return;
    }

    // Step 3: Verify OTP
    if (step === 3) {
      if (!otpCode) {
        setLocalError('Please enter the verification code');
        return;
      }
      // TODO: Verify OTP with backend
      // For now, just proceed
      setStep(4);
      return;
    }

    // Step 4: Medical Details
    if (step === 4) {
      if (!formData.name) {
        setLocalError('Please fill in your full name');
        return;
      }

      setStep(5);
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await register(
        {
          ...formData,
          doctorAccessCode: '',
        },
        'patient'
      );
      router.push('/login?registered=true');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create account');
    }
  };

  const getStepTitle = () => {
    switch(step) {
      case 1: return 'Create Account';
      case 2: return 'Verify Phone';
      case 3: return 'Enter Code';
      case 4: return 'Medical Details';
      case 5: return 'Set Password';
      default: return 'Create Account';
    }
  };

  const getStepSubtitle = () => {
    switch(step) {
      case 1: return 'Step 1 of 5: Enter your details';
      case 2: return `Step 2 of 5: Verification code will be sent to ${formData.phone}`;
      case 3: return 'Step 3 of 5: Enter the code from your text';
      case 4: return 'Step 4 of 5: Your medical history';
      case 5: return 'Step 5 of 5: Secure your account';
      default: return '';
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        {getStepTitle()}
      </h2>
      <p className="text-center text-text-secondary mb-8">
        {getStepSubtitle()}
      </p>

        {(authError || localError) && (
          <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
            {authError || localError}
          </div>
        )}

      {/* Step 1: Basic Info - Name, Email, Phone, Password */}
      {step === 1 && (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="mt-2 text-sm space-y-1">
              <p className={`${passwordCheck.hasUpperCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Uppercase letter
              </p>
              <p className={`${passwordCheck.hasLowerCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Lowercase letter
              </p>
              <p className={`${passwordCheck.hasNumber ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Number
              </p>
              <p className={`${passwordCheck.hasSpecialChar ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Special character
              </p>
              <p className={`${passwordCheck.length ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ At least 8 characters
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'Next: Verify Phone'}
          </button>
        </form>
      )}

      {/* Step 2: Send SMS OTP */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary mb-4">
            We'll send a verification code to <strong>{formData.phone}</strong>
          </p>
          <button
            type="button"
            disabled={nextAvailableTime ? Date.now() < nextAvailableTime : false}
            onClick={() => {
              const now = Date.now();
              const newRequestTimes = [...otpRequestTimes, now];
              setOtpRequestTimes(newRequestTimes);
              setStep(3);
              setOtpCooldown(60);
            }}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            {nextAvailableTime && Date.now() < nextAvailableTime
              ? `Try again in ${Math.ceil((nextAvailableTime - Date.now()) / 60000)}m`
              : 'Send Verification Code'}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
          >
            Back
          </button>
        </div>
      )}

      {/* Step 3: Enter OTP Code */}
      {step === 3 && (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Verification Code
            </label>
            <p className="text-sm text-text-secondary mb-3">
              Enter the 6-digit code sent to <strong>{formData.phone}</strong>
            </p>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required
              maxLength={6}
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-center text-2xl tracking-widest"
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
          >
            Back
          </button>
        </form>
      )}

      {/* Step 4: Medical Details */}
      {step === 4 && (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Service Type
            </label>
            <select
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
            >
              <option value="General">General Checkup</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Whitening">Whitening</option>
              <option value="Aligners">Aligners</option>
              <option value="Root Canal">Root Canal</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.medicalIntake.has_diabetes || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalIntake: {
                      ...formData.medicalIntake,
                      has_diabetes: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4"
              />
              <span className="ml-2 text-text-primary">I have diabetes</span>
            </label>
          </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.medicalIntake.has_heart_disease || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalIntake: {
                        ...formData.medicalIntake,
                        has_heart_disease: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="ml-2 text-text-primary">I have heart disease</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Allergies
              </label>
              <textarea
                value={formData.medicalIntake.allergies || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalIntake: {
                      ...formData.medicalIntake,
                      allergies: e.target.value,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="List any allergies..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Loading...' : 'Next: Set Password'}
              </button>
            </div>
        </form>
      )}

      {/* Step 5: Set Password */}
      {step === 5 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="mt-2 text-sm space-y-1">
              <p className={`${passwordCheck.hasUpperCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Uppercase letter
              </p>
              <p className={`${passwordCheck.hasLowerCase ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Lowercase letter
              </p>
              <p className={`${passwordCheck.hasNumber ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Number
              </p>
              <p className={`${passwordCheck.hasSpecialChar ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ Special character
              </p>
              <p className={`${passwordCheck.length ? 'text-green-600' : 'text-text-secondary'}`}>
                ✓ At least 8 characters
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 text-center">
        <p className="text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="text-text-link font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
