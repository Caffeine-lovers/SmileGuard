'use client';

import { useRouter } from 'next/navigation';
import { useSignup } from '@/lib/signup-context';

export default function SignupMedicalPage() {
  const router = useRouter();
  const { formData, updateMedicalField } = useSignup();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/signup/confirm');
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Medical Information
      </h2>
      <p className="text-center text-text-secondary mb-8">
        Step 2 of 3: Help us understand your health background
      </p>

      <form onSubmit={handleNext} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Date of Birth</label>
          <input
            type="date"
            value={formData.medicalIntake.date_of_birth || ''}
            onChange={(e) => updateMedicalField('date_of_birth', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
          />
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
          <label className="block text-sm font-medium text-text-primary mb-2">Phone</label>
          <input
            type="tel"
            value={formData.medicalIntake.phone || ''}
            onChange={(e) => updateMedicalField('phone', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
            placeholder="+63 912 345 6789"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Address</label>
          <input
            type="text"
            value={formData.medicalIntake.address || ''}
            onChange={(e) => updateMedicalField('address', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
            placeholder="Street, City, Province"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Emergency Contact Name</label>
          <input
            type="text"
            value={formData.medicalIntake.emergency_contact_name || ''}
            onChange={(e) => updateMedicalField('emergency_contact_name', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
            placeholder="Juan Dela Cruz"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Emergency Contact Phone</label>
          <input
            type="tel"
            value={formData.medicalIntake.emergency_contact_phone || ''}
            onChange={(e) => updateMedicalField('emergency_contact_phone', e.target.value)}
            className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
            placeholder="+63 912 345 6789"
          />
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

        <p className="text-xs text-text-secondary">All fields are optional except where required by your dentist.</p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            Next: Review
          </button>
        </div>
      </form>
    </div>
  );
}