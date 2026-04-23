'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignup } from '@/lib/signup-context';

interface ValidationErrors {
  [key: string]: string;
}

export default function SignupMedicalPage() {
  const router = useRouter();
  const { formData, updateMedicalField } = useSignup();
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);

  // Validation helper functions
  const validateDateOfBirth = (date: string): string | null => {
    if (!date) {
      return 'Date of birth is required';
    }

    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();



    if (age > 120) {
      return 'Please enter a valid date of birth';
    }

    return null;
  };

  const validatePhone = (phone: string): string | null => {
    if (!phone) {
      return 'Phone number is required';
    }

    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return 'Please enter a valid phone number';
    }

    return null;
  };

  const validateAddress = (address: string): string | null => {
    if (!address) {
      return 'Address is required';
    }

    if (address.trim().length < 5) {
      return 'Please enter a complete address';
    }

    return null;
  };

  const validateEmergencyContact = (name: string, phone: string): { name: string | null; phone: string | null } => {
    const errors = { name: null as string | null, phone: null as string | null };

    if (!name) {
      errors.name = 'Emergency contact name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Please enter a valid name';
    }

    if (!phone) {
      errors.phone = 'Emergency contact phone is required';
    } else {
      const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        errors.phone = 'Please enter a valid phone number';
      }
    }

    return errors;
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Date of birth validation
    const dobError = validateDateOfBirth(formData.medicalIntake.date_of_birth || '');
    if (dobError) newErrors.date_of_birth = dobError;

    // Phone validation
    const phoneError = validatePhone(formData.medicalIntake.phone || '');
    if (phoneError) newErrors.phone = phoneError;

    // Address validation
    const addressError = validateAddress(formData.medicalIntake.address || '');
    if (addressError) newErrors.address = addressError;

    // Emergency contact validation
    const contactErrors = validateEmergencyContact(
      formData.medicalIntake.emergency_contact_name || '',
      formData.medicalIntake.emergency_contact_phone || ''
    );
    if (contactErrors.name) newErrors.emergency_contact_name = contactErrors.name;
    if (contactErrors.phone) newErrors.emergency_contact_phone = contactErrors.phone;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form
      if (!validateForm()) {
        setLoading(false);
        return;
      }

      // Proceed to next step
      router.push('/signup/confirm');
    } catch (error) {
      console.error('Error proceeding to next step:', error);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
      setLoading(false);
    }
  };

  const getFieldError = (fieldName: string): string | null => {
    return errors[fieldName] || null;
  };

  const renderFieldError = (fieldName: string) => {
    const error = getFieldError(fieldName);
    if (!error) return null;
    return <p className="mt-1 text-sm text-brand-danger">{error}</p>;
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Medical Information
      </h2>
      <p className="text-center text-text-secondary mb-8">
        Step 2 of 3: Help us understand your health background
      </p>

      {errors.form && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {errors.form}
        </div>
      )}

      <form onSubmit={handleNext} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Date of Birth *</label>
          <input
            type="date"
            value={formData.medicalIntake.date_of_birth || ''}
            onChange={(e) => {
              updateMedicalField('date_of_birth', e.target.value);
              if (errors.date_of_birth) {
                setErrors({ ...errors, date_of_birth: '' });
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none ${
              errors.date_of_birth ? 'border-brand-danger' : 'border-border-card'
            }`}
          />
          {renderFieldError('date_of_birth')}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Gender</label>
          <select
            value={formData.medicalIntake.gender || ''}
            onChange={(e) => updateMedicalField('gender', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Phone *</label>
          <input
            type="tel"
            value={formData.medicalIntake.phone || ''}
            onChange={(e) => {
              updateMedicalField('phone', e.target.value);
              if (errors.phone) {
                setErrors({ ...errors, phone: '' });
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none ${
              errors.phone ? 'border-brand-danger' : 'border-border-card'
            }`}
            placeholder="+63 912 345 6789"
          />
          {renderFieldError('phone')}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Address *</label>
          <input
            type="text"
            value={formData.medicalIntake.address || ''}
            onChange={(e) => {
              updateMedicalField('address', e.target.value);
              if (errors.address) {
                setErrors({ ...errors, address: '' });
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none ${
              errors.address ? 'border-brand-danger' : 'border-border-card'
            }`}
            placeholder="Street, City, Province"
          />
          {renderFieldError('address')}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Emergency Contact Name *</label>
          <input
            type="text"
            value={formData.medicalIntake.emergency_contact_name || ''}
            onChange={(e) => {
              updateMedicalField('emergency_contact_name', e.target.value);
              if (errors.emergency_contact_name) {
                setErrors({ ...errors, emergency_contact_name: '' });
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none ${
              errors.emergency_contact_name ? 'border-brand-danger' : 'border-border-card'
            }`}
            placeholder="Juan Dela Cruz"
          />
          {renderFieldError('emergency_contact_name')}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Emergency Contact Phone *</label>
          <input
            type="tel"
            value={formData.medicalIntake.emergency_contact_phone || ''}
            onChange={(e) => {
              updateMedicalField('emergency_contact_phone', e.target.value);
              if (errors.emergency_contact_phone) {
                setErrors({ ...errors, emergency_contact_phone: '' });
              }
            }}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary outline-none ${
              errors.emergency_contact_phone ? 'border-brand-danger' : 'border-border-card'
            }`}
            placeholder="+63 912 345 6789"
          />
          {renderFieldError('emergency_contact_phone')}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Allergies <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={formData.medicalIntake.allergies || ''}
            onChange={(e) => updateMedicalField('allergies', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none text-sm"
            placeholder="e.g. Penicillin, latex..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Current Medications <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={formData.medicalIntake.current_medications || ''}
            onChange={(e) => updateMedicalField('current_medications', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none text-sm"
            placeholder="e.g. Metformin, Aspirin..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Medical Conditions <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={formData.medicalIntake.medical_conditions || ''}
            onChange={(e) => updateMedicalField('medical_conditions', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none text-sm"
            placeholder="e.g. Diabetes, Hypertension..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Past Surgeries <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={formData.medicalIntake.past_surgeries || ''}
            onChange={(e) => updateMedicalField('past_surgeries', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none text-sm"
            placeholder="e.g. Appendectomy (2019)..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Smoking Status</label>
          <select
            value={formData.medicalIntake.smoking_status || ''}
            onChange={(e) => updateMedicalField('smoking_status', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
          >
            <option value="">Prefer not to say</option>
            <option value="never">Never</option>
            <option value="former">Former smoker</option>
            <option value="current">Current smoker</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Pregnancy Status</label>
          <select
            value={formData.medicalIntake.pregnancy_status || ''}
            onChange={(e) => updateMedicalField('pregnancy_status', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
          >
            <option value="">Not applicable</option>
            <option value="not_pregnant">Not pregnant</option>
            <option value="pregnant">Pregnant</option>
            <option value="breastfeeding">Breastfeeding</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Additional Notes <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={formData.medicalIntake.notes || ''}
            onChange={(e) => updateMedicalField('notes', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none text-sm"
            placeholder="Anything else your dentist should know..."
          />
        </div>

        <p className="text-xs text-text-secondary">* Required fields. Other fields are optional.</p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
            disabled={loading}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Validating...' : 'Next: Review'}
          </button>
        </div>
      </form>
    </div>
  );
}