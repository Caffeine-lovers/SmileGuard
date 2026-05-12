'use client';

import { useState } from 'react';
import { supabase } from '@smileguard/supabase-client';
import type { Appointment } from '@/lib/database';

interface CancelAppointmentProps {
  isOpen: boolean;
  appointment: Appointment | null;
  appointmentRules: any | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function CancelAppointment({
  isOpen,
  appointment,
  appointmentRules,
  onClose,
  onConfirm,
}: CancelAppointmentProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const calculateCancellationFee = (): { fee: number; isWithinGracePeriod: boolean; isWithinCancellationWindow: boolean } => {
    if (!appointmentRules || !appointment) {
      return { fee: 0, isWithinGracePeriod: false, isWithinCancellationWindow: false };
    }

    const now = new Date();

    // Calculate grace period based on when appointment was created (booked)
    if (appointmentRules.grace_period_enabled && appointment.created_at) {
      const createdAt = new Date(appointment.created_at);
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation <= appointmentRules.grace_period_hours) {
        return { fee: 0, isWithinGracePeriod: true, isWithinCancellationWindow: true };
      }
    }

    // Calculate cancellation window based on appointment date
    const apptDate = new Date(appointment.appointment_date);
    const hoursUntilAppointment = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If still within cancellation window, charge fee
    if (hoursUntilAppointment >= -appointmentRules.cancellation_window_hours) {
      return { fee: appointmentRules.cancellation_fee_amount || 0, isWithinGracePeriod: false, isWithinCancellationWindow: true };
    }

    // Past cancellation window
    return { fee: 0, isWithinGracePeriod: false, isWithinCancellationWindow: false };
  };

  const handleConfirmCancel = async () => {
    if (!appointment) return;

    setIsCancelling(true);
    try {
      // Update appointment status to cancelled
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id);

      if (appointmentError) throw appointmentError;

      // Delete associated billing record
      const { error: billingError } = await supabase
        .from('billings')
        .delete()
        .eq('appointment_id', appointment.id);

      if (billingError) {
        console.warn('Warning: Billing record could not be deleted:', billingError);
        // Don't throw - appointment was already cancelled, billing might not exist
      }

      onConfirm();
      alert('Appointment cancelled and billing removed successfully');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isOpen || !appointment || !appointmentRules) {
    return null;
  }

  const { fee, isWithinGracePeriod, isWithinCancellationWindow } = calculateCancellationFee();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">⚠️</span> Cancel Appointment
          </h2>
          <p className="text-red-100 text-sm mt-2">Review cancellation policy before proceeding</p>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Appointment Details */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-2">Appointment Details</p>
            <p className="text-sm font-semibold text-gray-900">{appointment.service}</p>
            <p className="text-xs text-gray-600 mt-1">
              {formatDate(appointment.appointment_date)} at {appointment.appointment_time}
            </p>
          </div>

          {/* Cancellation Rules */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cancellation Policy</p>

            {isWithinGracePeriod && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-green-900">✓ Within Grace Period</p>
                <p className="text-xs text-green-700 mt-1">
                  You can cancel for free within {appointmentRules.grace_period_hours} hours of booking.
                </p>
                <p className="text-sm font-bold text-green-900 mt-2">Cancellation Fee: FREE</p>
              </div>
            )}

            {isWithinCancellationWindow && !isWithinGracePeriod && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-yellow-900">⏱️ Cancellation Fee Applies</p>
                <p className="text-xs text-yellow-700 mt-1">
                  You are still within the {appointmentRules.cancellation_window_hours} hour cancellation window. A fee will be charged.
                </p>
                <p className="text-sm font-bold text-yellow-900 mt-2">Cancellation Fee: ₱{fee}</p>
              </div>
            )}

            {!isWithinCancellationWindow && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-900">❌ Past Cancellation Window</p>
                <p className="text-xs text-red-700 mt-1">
                  The cancellation window has passed. You can no longer cancel this appointment.
                </p>
              </div>
            )}
          </div>

          {/* Policy Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-900 uppercase mb-2">Policy Summary</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>
                • Cancel up to <span className="font-bold">{appointmentRules.cancellation_window_hours}h</span> before appointment
              </li>
              {appointmentRules.grace_period_enabled && (
                <li>
                  • Free cancellation within <span className="font-bold">{appointmentRules.grace_period_hours}h</span> of booking
                </li>
              )}
              <li>
                • Late cancellation fee: <span className="font-bold">₱{appointmentRules.cancellation_fee_amount}</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Keep Appointment
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isCancelling || !isWithinCancellationWindow}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
