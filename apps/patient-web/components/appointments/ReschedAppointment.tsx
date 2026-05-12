'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Appointment } from '@/lib/database';

interface ReschedAppointmentProps {
  isOpen: boolean;
  appointment: Appointment | null;
  appointmentRules: any | null;
  onClose: () => void;
}

export default function ReschedAppointment({
  isOpen,
  appointment,
  appointmentRules,
  onClose,
}: ReschedAppointmentProps) {
  const router = useRouter();
  const [isRescheduling, setIsRescheduling] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleString('en-PH', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateRescheduleEligibility = (): { canReschedule: boolean; reason: string; isWithinRescheduleWindow: boolean } => {
    if (!appointmentRules || !appointment) {
      return { canReschedule: false, reason: 'Unable to load reschedule rules', isWithinRescheduleWindow: false };
    }

    const now = new Date();

    // Check if reschedule is enabled
    if (!appointmentRules.reschedule_allowed) {
      return { canReschedule: false, reason: 'Rescheduling is not available', isWithinRescheduleWindow: false };
    }

    // Check if appointment is in the past
    const apptDate = new Date(appointment.appointment_date);
    const hoursUntilAppointment = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilAppointment < 0) {
      return { canReschedule: false, reason: 'Cannot reschedule past appointments', isWithinRescheduleWindow: false };
    }

    // Calculate reschedule window based on when appointment was created (booked)
    if (appointment.created_at) {
      const createdAt = new Date(appointment.created_at);
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      // If appointment was created within the reschedule window, patient can reschedule
      if (hoursSinceCreation <= appointmentRules.reschedule_window_hours) {
        return { canReschedule: true, reason: 'You can reschedule this appointment', isWithinRescheduleWindow: true };
      } else {
        return { canReschedule: false, reason: `Rescheduling window has expired (${appointmentRules.reschedule_window_hours} hours from booking)`, isWithinRescheduleWindow: false };
      }
    }

    // Fallback: if no created_at, cannot reschedule
    return { canReschedule: false, reason: 'Unable to determine reschedule eligibility', isWithinRescheduleWindow: false };
  };

  const handleConfirmReschedule = async () => {
    if (!appointment) return;

    setIsRescheduling(true);
    try {
      // Navigate to appointments page to reschedule with appointment ID as query param
      router.push(`/appointments?rescheduleId=${appointment.id}`);
      onClose();
    } catch (error) {
      console.error('Error initiating reschedule:', error);
      alert('Failed to open reschedule page');
    } finally {
      setIsRescheduling(false);
    }
  };

  if (!isOpen || !appointment || !appointmentRules) {
    return null;
  }

  const { canReschedule, isWithinRescheduleWindow } = calculateRescheduleEligibility();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">📅</span> Reschedule Appointment
          </h2>
          <p className="text-blue-100 text-sm mt-2">Choose a new date and time for your appointment</p>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Appointment Details */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-2">Current Appointment</p>
            <p className="text-sm font-semibold text-gray-900">{appointment.service}</p>
            <p className="text-xs text-gray-600 mt-1">
              {formatDate(appointment.appointment_date)} at {appointment.appointment_time}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Booked On</p>
              <p className="text-xs text-gray-700">{formatDateTime(appointment.created_at)}</p>
            </div>
          </div>

          {/* Eligibility Info */}
          {canReschedule && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-green-900">✓ Eligible to Reschedule</p>
              <p className="text-xs text-green-700 mt-1">
                You can reschedule this appointment up to {appointmentRules.reschedule_window_hours} hours from when you booked it.
              </p>
            </div>
          )}

          {!canReschedule && isWithinRescheduleWindow === false && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-red-900">❌ Not Eligible to Reschedule</p>
              <p className="text-xs text-red-700 mt-1">
                Rescheduling is not available for this appointment at the moment.
              </p>
            </div>
          )}

          {/* Reschedule Window Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-900 uppercase mb-2">Rescheduling Policy</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>
                • Reschedule up to <span className="font-bold">{appointmentRules.reschedule_window_hours}h</span> from booking
              </li>
              <li>• No additional fee for rescheduling</li>
              <li>• Choose any available time slot</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isRescheduling}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReschedule}
              disabled={isRescheduling || !canReschedule}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRescheduling ? 'Loading...' : 'Continue to Reschedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
