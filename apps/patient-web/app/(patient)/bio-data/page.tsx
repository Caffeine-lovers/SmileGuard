'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';

interface MedicalIntake {
  patient_id: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string | null;
  current_medications: string | null;
  medical_conditions: string | null;
  past_surgeries: string | null;
  smoking_status: string | null;
  pregnancy_status: string | null;
}

export default function BioDataPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const [medicalData, setMedicalData] = useState<MedicalIntake | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }

    if (!authLoading && currentUser) {
      fetchMedicalData();
    }
  }, [authLoading, currentUser, router]);

  const fetchMedicalData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('medical_intake')
        .select('*')
        .eq('patient_id', currentUser?.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[BioData] Error fetching medical data:', fetchError);
        setError('Failed to load medical information');
        return;
      }

      if (!data) {
        console.log('[BioData] No medical data found for user');
        setMedicalData(null);
      } else {
        console.log('[BioData] Medical data loaded successfully');
        setMedicalData(data);
      }
    } catch (err) {
      console.error('[BioData] Error fetching medical data:', err);
      setError('An error occurred while loading medical information');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicalData || !currentUser) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const { error: saveError } = await supabase
        .from('medical_intake')
        .upsert({
          patient_id: currentUser.id,
          date_of_birth: medicalData.date_of_birth,
          gender: medicalData.gender,
          phone: medicalData.phone,
          address: medicalData.address,
          emergency_contact_name: medicalData.emergency_contact_name,
          emergency_contact_phone: medicalData.emergency_contact_phone,
          allergies: medicalData.allergies,
          current_medications: medicalData.current_medications,
          medical_conditions: medicalData.medical_conditions,
          past_surgeries: medicalData.past_surgeries,
          smoking_status: medicalData.smoking_status,
          pregnancy_status: medicalData.pregnancy_status,
          updated_at: new Date().toISOString(),
        });

      if (saveError) {
        console.error('[BioData] Error saving medical data:', saveError);
        setError(`Failed to save changes: ${saveError.message}`);
        return;
      }

      console.log('[BioData] Medical data saved successfully');
      setSuccess('Bio data saved successfully!');
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('[BioData] Error saving medical data:', err);
      setError('An error occurred while saving medical information');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof MedicalIntake, value: string | null) => {
    setMedicalData(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-text-primary">Loading your bio data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Bio Data</h1>
          <p className="text-text-secondary mt-2">Manage your personal and medical information</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-6 rounded-lg transition"
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-brand-success/10 border border-brand-success text-brand-success px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}

      {medicalData ? (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Personal Information Section */}
          <div className="bg-bg-surface border border-border-card rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-text-primary mb-6">Personal Information</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Date of Birth
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={medicalData.date_of_birth || ''}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.date_of_birth ? new Date(medicalData.date_of_birth).toLocaleDateString() : 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Gender
                </label>
                {isEditing ? (
                  <select
                    value={medicalData.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.gender || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={medicalData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Address
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={medicalData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.address || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="bg-bg-surface border border-border-card rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-text-primary mb-6">Emergency Contact</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={medicalData.emergency_contact_name || ''}
                    onChange={(e) => handleInputChange('emergency_contact_name', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.emergency_contact_name || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={medicalData.emergency_contact_phone || ''}
                    onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.emergency_contact_phone || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Medical History Section */}
          <div className="bg-bg-surface border border-border-card rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-text-primary mb-6">Medical History</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Allergies
                </label>
                {isEditing ? (
                  <textarea
                    value={medicalData.allergies || ''}
                    onChange={(e) => handleInputChange('allergies', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.allergies || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Current Medications
                </label>
                {isEditing ? (
                  <textarea
                    value={medicalData.current_medications || ''}
                    onChange={(e) => handleInputChange('current_medications', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.current_medications || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Medical Conditions
                </label>
                {isEditing ? (
                  <textarea
                    value={medicalData.medical_conditions || ''}
                    onChange={(e) => handleInputChange('medical_conditions', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.medical_conditions || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Past Surgeries
                </label>
                {isEditing ? (
                  <textarea
                    value={medicalData.past_surgeries || ''}
                    onChange={(e) => handleInputChange('past_surgeries', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.past_surgeries || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Smoking Status
                </label>
                {isEditing ? (
                  <select
                    value={medicalData.smoking_status || ''}
                    onChange={(e) => handleInputChange('smoking_status', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="Never">Never smoked</option>
                    <option value="Former">Former smoker</option>
                    <option value="Current">Current smoker</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.smoking_status || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Pregnancy Status
                </label>
                {isEditing ? (
                  <select
                    value={medicalData.pregnancy_status || ''}
                    onChange={(e) => handleInputChange('pregnancy_status', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="Not applicable">Not applicable</option>
                    <option value="Not pregnant">Not pregnant</option>
                    <option value="Pregnant">Currently pregnant</option>
                    <option value="Breastfeeding">Breastfeeding</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-2">
                    {medicalData.pregnancy_status || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  fetchMedicalData(); // Reset form data
                }}
                className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-white font-medium py-2 px-4 rounded-lg transition"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      ) : (
        <div className="bg-bg-surface border border-border-card rounded-lg p-8 text-center">
          <p className="text-text-secondary mb-4">No bio data on file yet.</p>
          <button
            onClick={() => router.push('/signup/medical')}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-6 rounded-lg transition"
          >
            Add Bio Data
          </button>
        </div>
      )}
    </div>
  );
}
