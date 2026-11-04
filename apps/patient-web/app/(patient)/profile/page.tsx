'use client';

import { Plus, Trash2 } from 'lucide-react';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { uploadPatientProfilePicture } from '@/components/dashboard/uploadPatientProfilePicture';
import { setPatientUserCookie } from '@/lib/auth-cookie';
import { withTimeout } from '@/lib/appointmentService';

import { showAlert } from '@/components/ui/AppDialog';
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


interface EmergencyContactItem {
  name: string;
  relationship: string;
  phone: string;
}

function parseContactsFromMedical(nameStr?: string | null, phoneStr?: string | null): EmergencyContactItem[] {
  if (!nameStr && !phoneStr) return [];
  const rawNames = (nameStr || '').split(';').map(s => s.trim()).filter(Boolean);
  const rawPhones = (phoneStr || '').split(';').map(s => s.trim()).filter(Boolean);
  const len = Math.max(rawNames.length, rawPhones.length, 1);
  const items: EmergencyContactItem[] = [];

  for (let i = 0; i < len; i++) {
    const rawName = rawNames[i] || '';
    const phone = rawPhones[i] || '';
    const match = rawName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      items.push({ name: match[1].trim(), relationship: match[2].trim(), phone });
    } else {
      items.push({ name: rawName, relationship: '', phone });
    }
  }
  return items.filter(c => c.name || c.phone);
}

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
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([]);

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
        const parsed = parseContactsFromMedical(data.emergency_contact_name, data.emergency_contact_phone);
        setEmergencyContacts(parsed.length > 0 ? parsed : [{ name: '', relationship: '', phone: '' }]);
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
                      showAlert(`Failed to upload image: ${err.message || 'Unknown error. Check console.'}`);
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
                    value={medicalData.gender?.toLowerCase() || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value || null)}
                    className="w-full px-3.5 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                ) : (
                  <p className="text-text-secondary py-1 text-sm capitalize">
                    {medicalData.gender ? (medicalData.gender.toLowerCase() === 'female' ? 'Female' : medicalData.gender.toLowerCase() === 'male' ? 'Male' : medicalData.gender) : 'Not provided'}
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
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">
                Emergency Contact{emergencyContacts.filter(c => c.name.trim() || c.phone.trim()).length > 1 ? 's' : ''}
              </h2>
              {isEditing && emergencyContacts.length < 3 && (
                <button
                  type="button"
                  onClick={() => setEmergencyContacts(prev => [...prev, { name: '', relationship: '', phone: '' }])}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {emergencyContacts.map((contact, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Contact #{idx + 1} {idx === 0 && '(Primary)'}
                      </span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setEmergencyContacts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmergencyContacts(prev => prev.map((c, i) => i === idx ? { ...c, name: val } : c));
                          }}
                          placeholder="e.g. Juan Dela Cruz"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Relationship</label>
                        <select
                          value={contact.relationship}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmergencyContacts(prev => prev.map((c, i) => i === idx ? { ...c, relationship: val } : c));
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                        >
                          <option value="">Select relationship...</option>
                          <option value="Parent">Parent</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Child">Child</option>
                          <option value="Friend">Friend</option>
                          <option value="Relative">Relative</option>
                          <option value="Guardian">Guardian</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmergencyContacts(prev => prev.map((c, i) => i === idx ? { ...c, phone: val } : c));
                          }}
                          placeholder="+639123456789"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                const displayContacts = emergencyContacts.filter(c => c.name.trim() || c.phone.trim());
                if (displayContacts.length === 0) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">Name</label>
                        <p className="text-text-secondary py-1 text-sm">Not provided</p>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-text-primary mb-1.5">Phone</label>
                        <p className="text-text-secondary py-1 text-sm">Not provided</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayContacts.map((c, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Contact #{idx + 1} {idx === 0 && '(Primary)'}
                          </span>
                          {c.relationship && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {c.relationship}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900">{c.name || 'Not provided'}</p>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">{c.phone || 'Not provided'}</p>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
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
