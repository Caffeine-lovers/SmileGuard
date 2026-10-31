'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { uploadPatientProfilePicture } from '@/components/dashboard/uploadPatientProfilePicture';
import { setPatientUserCookie } from '@/lib/auth-cookie';
import { withTimeout } from '@/lib/appointmentService';

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

import { 
  normalizePregnancyStatus, 
  formatPregnancyStatus, 
  normalizeSmokingStatus, 
  formatSmokingStatus 
} from '@/lib/medical-helpers';

export default function ProfilePage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const [medicalData, setMedicalData] = useState<MedicalIntake | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Sync state correctly based on useAuth hook's currentUser value and persistent DB record
  useEffect(() => {
    if (currentUser?.avatar_url) {
      setProfileImageUrl(currentUser.avatar_url);
    } else if ((currentUser as any)?.profile_picture_url) {
      setProfileImageUrl((currentUser as any).profile_picture_url);
    }

    if (currentUser?.id) {
      supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.avatar_url) {
            setProfileImageUrl(data.avatar_url);
          }
        });
    }
  }, [currentUser]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
      return;
    }

    if (currentUser) {
      fetchMedicalData();
    }
  }, [authLoading, currentUser?.id, router]);

  const fetchMedicalData = async () => {
    try {
      setIsLoadingData(true);
      setError(null);

      const res = await withTimeout<any>(
        supabase
          .from('medical_intake')
          .select('*')
          .eq('patient_id', currentUser?.id)
          .maybeSingle(),
        3000,
        { data: null, error: null }
      );

      const { data, error: fetchError } = res || { data: null, error: null };

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
      setIsLoadingData(false);
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
          smoking_status: normalizeSmokingStatus(medicalData.smoking_status),
          pregnancy_status: normalizePregnancyStatus(medicalData.pregnancy_status),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'patient_id' });

      if (saveError) {
        console.error('[BioData] Error saving medical data:', saveError);
        setError(`Failed to save changes: ${saveError.message}`);
        return;
      }

      console.log('[BioData] Medical data saved successfully');
      setSuccess('Bio data saved successfully!');
      
      // Update cache in useAuth hook
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

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-card">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-18 h-18 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-border-card bg-bg-surface-secondary flex items-center justify-center shadow-xs">
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-text-secondary text-xs sm:text-sm">No Image</span>
              )}
            </div>
            
            {isEditing && (
              <label className="mt-1.5 cursor-pointer text-xs text-brand-primary hover:underline font-semibold">
                {isUploadingImage ? 'Uploading...' : 'Change Picture'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !currentUser?.id) return;
                    try {
                      setIsUploadingImage(true);
                      const newUrl = await uploadPatientProfilePicture(currentUser.id, file);
                      setProfileImageUrl(newUrl);
                      setPatientUserCookie({
                        id: currentUser.id,
                        name: currentUser.name,
                        email: currentUser.email,
                        role: 'patient',
                        avatar_url: newUrl,
                      });
                    } catch (err: any) {
                      console.error('Upload failed', err);
                      alert(`Failed to upload image: ${err.message || 'Unknown error. Check console.'}`);
                    } finally {
                      setIsUploadingImage(false);
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary truncate">
              {currentUser?.name || 'Patient Profile'}
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">SmileGuard Patient Portal</p>
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-2 px-5 sm:px-6 rounded-lg transition w-full sm:w-auto text-center cursor-pointer shadow-xs"
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-brand-success/10 border border-brand-success text-brand-success px-4 py-3 rounded mb-6 text-xs sm:text-sm">
          {success}
        </div>
      )}

      {medicalData ? (
        <form onSubmit={handleSave} className="space-y-6 sm:space-y-8">
          {/* Personal Information Section */}
          <div className="bg-bg-surface border border-border-card rounded-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary mb-4 sm:mb-6">Personal Information</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">
                  Date of Birth
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={medicalData.date_of_birth || ''}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  />
                ) : (
                  <p className="text-text-secondary py-1 text-sm">
                    {medicalData.date_of_birth ? new Date(medicalData.date_of_birth).toLocaleDateString() : 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">
                  Gender
                </label>
                {isEditing ? (
                  <select
                    value={medicalData.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-1 text-sm">
                    {medicalData.gender || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={medicalData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  />
                ) : (
                  <p className="text-text-secondary py-1 text-sm">
                    {medicalData.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">
                  Address
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={medicalData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  />
                ) : (
                  <p className="text-text-secondary py-1 text-sm">
                    {medicalData.address || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact Section */}
          <div className="bg-bg-surface border border-border-card rounded-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary mb-4 sm:mb-6">Emergency Contact</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">
                  Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={medicalData.emergency_contact_name || ''}
                    onChange={(e) => handleInputChange('emergency_contact_name', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  />
                ) : (
                  <p className="text-text-secondary py-1 text-sm">
                    {medicalData.emergency_contact_name || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={medicalData.emergency_contact_phone || ''}
                    onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  />
                ) : (
                  <p className="text-text-secondary py-1 text-sm">
                    {medicalData.emergency_contact_phone || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Medical History Section */}
          <div className="bg-bg-surface border border-border-card rounded-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary mb-4 sm:mb-6">Medical History</h2>
            
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
                    value={normalizeSmokingStatus(medicalData.smoking_status)}
                    onChange={(e) => handleInputChange('smoking_status', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="never">Never smoked</option>
                    <option value="former">Former smoker</option>
                    <option value="current">Current smoker</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-2">
                    {formatSmokingStatus(medicalData.smoking_status)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Pregnancy Status
                </label>
                {isEditing ? (
                  <select
                    value={normalizePregnancyStatus(medicalData.pregnancy_status)}
                    onChange={(e) => handleInputChange('pregnancy_status', e.target.value || null)}
                    className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="na">Not applicable</option>
                    <option value="no">Not pregnant</option>
                    <option value="yes">Currently pregnant</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-2">
                    {formatPregnancyStatus(medicalData.pregnancy_status)}
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
      ) : isLoadingData ? (
        <div className="bg-bg-surface border border-border-card rounded-lg p-10 text-center animate-pulse">
          <p className="text-text-secondary text-xs font-bold uppercase tracking-wider">Syncing clinical profile records...</p>
        </div>
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
