'use client';

import { useRouter } from 'next/navigation';
import { useSignup } from '@/lib/signup-context';

export default function SignupMedicalPage() {
  const router = useRouter();
  const { formData, updateFormField } = useSignup();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/signup/confirm');


  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Medical Details
      </h2>
      <p className="text-center text-text-secondary mb-8">
      </p>

      <form onSubmit={handleNext} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Service Type
          </label>
          <select
            value={formData.service}
            onChange={(e) => updateFormField('service', e.target.value)}
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
                updateFormField('medicalIntake', {
                  ...formData.medicalIntake,
                  has_diabetes: e.target.checked,
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
                updateFormField('medicalIntake', {
                  ...formData.medicalIntake,
                  has_heart_disease: e.target.checked,
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
              updateFormField('medicalIntake', {
                ...formData.medicalIntake,
                allergies: e.target.value,
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
            onClick={() => window.history.back()}
            className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            Next: Confirm
          </button>
        </div>
      </form>
    </div>
  );
}
