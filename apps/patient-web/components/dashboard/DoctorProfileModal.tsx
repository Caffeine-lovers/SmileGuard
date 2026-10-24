'use client';

import { useEffect, useState } from 'react';
import { 
  Doctor, 
  getDoctorFullName, 
  getDoctorPrefix, 
  getDoctorTitleName 
} from '@smileguard/shared-types';
import { getDoctorProfile } from '@/lib/appointmentService';
import { 
  X, 
  Award, 
  UserCheck, 
  Stethoscope 
} from 'lucide-react';

interface DoctorProfileModalProps {
  doctorId: string | null;
  onClose: () => void;
}

export default function DoctorProfileModal({ doctorId, onClose }: DoctorProfileModalProps) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!doctorId) {
      setDoctor(null);
      return;
    }

    let isMounted = true;
    async function loadDoctor() {
      setLoading(true);
      setImgError(false);
      try {
        const doc = await getDoctorProfile(doctorId!);
        if (isMounted) setDoctor(doc);
      } catch (err) {
        console.error('Error loading doctor profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDoctor();

    return () => {
      isMounted = false;
    };
  }, [doctorId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!doctorId) return null;

  const initials = doctor 
    ? (doctor.first_name?.[0] || '') + (doctor.last_name?.[0] || '') 
    : 'DR';



  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="skeuo-panel bg-white w-full max-w-lg rounded-sm border-2 border-slate-300 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 px-5 py-4 text-white border-b-2 border-emerald-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">SmileGuard Medical Registry</span>
              <h2 className="text-base font-black uppercase tracking-tight">Attending Doctor Profile</h2>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-sm bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-b-emerald-600 mx-auto mb-3"></div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading Doctor Credentials...</p>
            </div>
          ) : !doctor ? (
            <div className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
              Doctor details unavailable.
            </div>
          ) : (
            <>
              {/* Doctor Header Card */}
              <div className="skeuo-card p-4 rounded-sm border-2 border-slate-300 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-emerald-600 to-emerald-800 text-white font-bold text-lg flex items-center justify-center border-2 border-emerald-900 shadow-md overflow-hidden mb-3">
                  {doctor.profile_picture_url && !imgError ? (
                    <img 
                      src={doctor.profile_picture_url} 
                      alt={doctor.first_name || 'Doctor'} 
                      className="w-full h-full object-cover"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span>{initials.toUpperCase() || 'DR'}</span>
                  )}
                </div>

                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {getDoctorTitleName(doctor) || 'Doctor'}
                </h3>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                  {doctor.specialization || 'General Dentistry'}
                </p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">
                  {doctor.years_of_experience || 0} {doctor.years_of_experience === 1 ? 'year' : 'years'} of clinical experience
                </p>
              </div>

              {/* License & Credentials Section */}
              <div className="skeuo-card p-4 rounded-sm border-2 border-slate-300">
                <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-200">
                  <Award className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">License & Credentials</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">License Number:</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                      {doctor.license_number || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Specialization:</span>
                    <span className="font-bold text-slate-800">{doctor.specialization || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-semibold">Years of Experience:</span>
                    <span className="font-bold text-slate-800">
                      {doctor.years_of_experience || 0} {doctor.years_of_experience === 1 ? 'year' : 'years'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Doctor Information Section */}
              <div className="skeuo-card p-4 rounded-sm border-2 border-slate-300">
                <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-200">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Doctor Information</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Full Legal Name:</span>
                    <span className="font-bold text-slate-800">{getDoctorFullName(doctor) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Gender / Title:</span>
                    <span className="font-bold text-slate-800">
                      {doctor.gender ? `${doctor.gender} (${getDoctorPrefix(doctor)})` : 'Not specified (Dr.)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Clinic Phone:</span>
                    <span className="font-bold text-slate-800">{doctor.doctor_phone || 'N/A'}</span>
                  </div>
                  {doctor.bio && (
                    <div className="pt-2">
                      <span className="text-slate-500 font-semibold block mb-1">Professional Bio:</span>
                      <p className="text-slate-700 bg-slate-50 p-2.5 rounded-sm border border-slate-200 leading-relaxed italic text-[11px]">
                        "{doctor.bio}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="skeuo-btn-secondary px-5 py-2 text-xs uppercase tracking-wider font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
