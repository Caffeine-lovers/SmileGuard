'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { EMPTY_MEDICAL_INTAKE, checkPasswordStrengthDetailed, isPasswordStrongDetailed } from '@smileguard/shared-types';

export default function SignupPage() {
  const router = useRouter();
  const { register, loading, error: authError } = useAuth();
  const [step, setStep] = useState(1); // 1: Basic, 2: Medical, 3: Confirm
  const [localError, setLocalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
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

  const handlePasswordChange = (newPassword: string) => {
    setFormData({ ...formData, password: newPassword });
    setPasswordCheck(checkPasswordStrengthDetailed(newPassword));
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        setLocalError('Please fill in all fields');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }

      if (!isPasswordStrongDetailed(passwordCheck)) {
        setLocalError('Password does not meet strength requirements');
        return;
      }

      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

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
      setLocalError(
        err instanceof Error ? err.message : 'Registration failed. Please try again.'
      );
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Create Account
      </h2>
      <p className="text-center text-text-secondary mb-8">
        Step {step} of 2
      </p>

      {(authError || localError) && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {authError || localError}
        </div>
      )}

      {step === 1 ? (
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
            <label className="block text-sm font-medium text-text-primary mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="••••••••"
            />
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
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            Next: Medical Information
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
              onClick={() => setStep(1)}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Creating...' : 'Create Account'}
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
