'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { EMPTY_MEDICAL_INTAKE, checkPasswordStrength, isPasswordStrong } from '@smileguard/shared-types';

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
    setPasswordCheck(checkPasswordStrength(newPassword));
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

      if (!isPasswordStrong(passwordCheck)) {
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
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">
        Create Account
      </h2>
      <p className="text-center text-gray-500 mb-8">
        Step {step} of 2
      </p>

      {(authError || localError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm">
          {authError || localError}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type
            </label>
            <select
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
            <div className="mt-2 text-sm space-y-1">
              <p className={`${passwordCheck.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                ✓ Uppercase letter
              </p>
              <p className={`${passwordCheck.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                ✓ Lowercase letter
              </p>
              <p className={`${passwordCheck.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                ✓ Number
              </p>
              <p className={`${passwordCheck.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                ✓ Special character
              </p>
              <p className={`${passwordCheck.length ? 'text-green-600' : 'text-gray-500'}`}>
                ✓ At least 8 characters
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
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
              <span className="ml-2 text-gray-700">I have diabetes</span>
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
              <span className="ml-2 text-gray-700">I have heart disease</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="List any allergies..."
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
