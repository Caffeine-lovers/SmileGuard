'use client';

import { useRouter } from 'next/navigation';
import { useSignup } from '@/lib/signup-context';

export default function SignupMedicalPage() {
  const router = useRouter();
  const { formData, updateFormField } = useSignup();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/signup/confirm');


  const updateMedicalField = (field: string, value: any) => {
    updateFormField('medicalIntake', {
      ...formData.medicalIntake,
      [field]: value,
    });
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Medical Details
      </h2>
      <p className="text-center text-text-secondary mb-8">
      </p>

      <form onSubmit={handleNext} className="space-y-6">
        {/* Personal Information Section */}
        <div className="border-b border-border-card pb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Personal Information</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.medicalIntake.dateOfBirth || ''}
                onChange={(e) => updateMedicalField('dateOfBirth', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Gender
              </label>
              <select
                value={formData.medicalIntake.gender || ''}
                onChange={(e) => updateMedicalField('gender', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.medicalIntake.phone || ''}
                onChange={(e) => updateMedicalField('phone', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Address
              </label>
              <input
                type="text"
                value={formData.medicalIntake.address || ''}
                onChange={(e) => updateMedicalField('address', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="123 Main St, City, ST 12345"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="border-b border-border-card pb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Emergency Contact</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={formData.medicalIntake.emergencyContactName || ''}
                onChange={(e) => updateMedicalField('emergencyContactName', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={formData.medicalIntake.emergencyContactPhone || ''}
                onChange={(e) => updateMedicalField('emergencyContactPhone', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </div>

        {/* Medical History Section */}
        <div className="border-b border-border-card pb-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Medical History</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Allergies
              </label>
              <textarea
                value={formData.medicalIntake.allergies || ''}
                onChange={(e) => updateMedicalField('allergies', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="List any drug, food, or material allergies..."
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Current Medications
              </label>
              <textarea
                value={formData.medicalIntake.currentMedications || ''}
                onChange={(e) => updateMedicalField('currentMedications', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="List any current medications you're taking..."
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Medical Conditions
              </label>
              <textarea
                value={formData.medicalIntake.medicalConditions || ''}
                onChange={(e) => updateMedicalField('medicalConditions', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="E.g., diabetes, heart disease, high blood pressure..."
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Past Surgeries
              </label>
              <textarea
                value={formData.medicalIntake.pastSurgeries || ''}
                onChange={(e) => updateMedicalField('pastSurgeries', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="List any surgeries you've had..."
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Smoking Status
              </label>
              <select
                value={formData.medicalIntake.smokingStatus || ''}
                onChange={(e) => updateMedicalField('smokingStatus', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="">Select...</option>
                <option value="Never">Never smoked</option>
                <option value="Former">Former smoker</option>
                <option value="Current">Current smoker</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Pregnancy Status
              </label>
              <select
                value={formData.medicalIntake.pregnancyStatus || ''}
                onChange={(e) => updateMedicalField('pregnancyStatus', e.target.value)}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="">Select...</option>
                <option value="Not applicable">Not applicable</option>
                <option value="Not pregnant">Not pregnant</option>
                <option value="Pregnant">Currently pregnant</option>
                <option value="Breastfeeding">Breastfeeding</option>
              </select>
            </div>
          </div>
        </div>

        {/* Service Type */}
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
