'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Appointment, Billing } from '@/lib/database';
import { getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';
import { fetchAppointmentRules } from '@/lib/appointmentRule';

interface CancellationBillingProps {
  onCancellationComplete?: () => void;
  appointmentId?: string;
  cancellationFee?: number;
}

export default function CancellationBilling({ 
  onCancellationComplete, 
  appointmentId: propAppointmentId,
  cancellationFee: propCancellationFee 
}: CancellationBillingProps) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cancellation-specific state
  const [cancellationAppointment, setCancellationAppointment] = useState<Appointment | null>(null);
  const [cancellationFee, setCancellationFee] = useState(propCancellationFee || 0);
  const [paymentMethod, setPaymentMethod] = useState<Billing['payment_method']>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [unpaidAppointments, setUnpaidAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointmentRules, setAppointmentRules] = useState<any>(null);

  // Try to extract appointment data from URL if available
  const passedAppointmentData = useMemo(() => {
    try {
      const data = searchParams?.get('appointmentData');
      if (data) {
        console.log('[CancellationBilling] Found appointment data in params');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[CancellationBilling] Failed to parse appointmentData from params');
    }
    return null;
  }, [searchParams]);

  // Load unpaid appointments and find cancellation appointment
  useEffect(() => {
    async function loadAppointmentsAndSetCancellation() {
      if (!currentUser || !currentUser.id) {
        console.log('[CancellationBilling] No current user, skipping load');
        setLoadingData(false);
        return;
      }

      // Fetch appointment rules
      const rules = await fetchAppointmentRules();
      setAppointmentRules(rules);

      // Prefer props over searchParams for reliability
      const appointmentId = propAppointmentId || searchParams?.get('appointmentId');
      const cancellationFeeParam = propCancellationFee !== undefined ? propCancellationFee : parseFloat(searchParams?.get('cancellationFee') || 'NaN');

      console.log('[CancellationBilling] Starting load with params:', { appointmentId, cancellationFeeParam, fromProps: !!propAppointmentId });

      // If params are missing, this is not a cancellation flow
      // Note: cancellationFeeParam can be 0 (valid fee), so check for NaN and null instead
      if (!appointmentId || isNaN(cancellationFeeParam)) {
        console.warn('[CancellationBilling] Missing required cancellation parameters');
        setError('Missing cancellation parameters. Please try again from the appointments list.');
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      setError(null);
      
      try {
        const userId = currentUser.id;
        console.log('[CancellationBilling] Fetching all appointments for user:', userId);
        
        const appts = await getPatientAppointments(userId);
        const billings = await getBillings(userId);

        // Normalize ID for comparison (trim whitespace, compare as strings)
        const normalizedSearchId = String(appointmentId).trim();

        console.log('[CancellationBilling] All appointments:', appts.map(a => ({ id: a.id, status: a.status, service: a.service })));
        console.log('[CancellationBilling] Looking for appointmentId:', { raw: appointmentId, normalized: normalizedSearchId });
        
        // First, check if the appointment exists at all
        const targetApptInAll = appts.find(a => String(a.id).trim() === normalizedSearchId);
        if (!targetApptInAll) {
          console.error('[CancellationBilling] Appointment NOT found. Database IDs:', appts.map(a => ({ raw: a.id, trimmed: String(a.id).trim() })));
          console.error('[CancellationBilling] Searching for:', { raw: appointmentId, trimmed: normalizedSearchId });
          setError(`Appointment not found in database. ID: ${appointmentId}`);
          setLoadingData(false);
          return;
        }

        console.log('[CancellationBilling] Found appointment in database:', targetApptInAll);
        
        // Now check if it's in the unpaid list
        const paidApptIds = new Set(
          billings
            .filter(b => b.payment_status === 'paid' && b.appointment_id)
            .map(b => String(b.appointment_id).trim())
        );
        
        console.log('[CancellationBilling] Paid appointment IDs:', Array.from(paidApptIds));
        console.log('[CancellationBilling] Appointment status:', targetApptInAll.status);
        console.log('[CancellationBilling] Is appointment paid?', paidApptIds.has(normalizedSearchId));
        console.log('[CancellationBilling] Is appointment cancelled?', targetApptInAll.status === 'cancelled');
        
        // Include appointments that are not cancelled and not paid
        // This includes pending appointments without billing records
        const unpaid = appts.filter(a => a.status !== 'cancelled' && !paidApptIds.has(String(a.id).trim()));
        setUnpaidAppointments(unpaid);

        // Find the appointment to cancel - should be any non-cancelled, non-paid appointment
        const targetAppt = unpaid.find(a => String(a.id).trim() === normalizedSearchId);

        if (targetAppt) {
          console.log('[CancellationBilling] Appointment is eligible for cancellation (unpaid/pending)', targetAppt);
          setCancellationFee(cancellationFeeParam);
          setCancellationAppointment(targetAppt);
        } else {
          // Appointment exists but is not eligible for cancellation
          if (paidApptIds.has(appointmentId)) {
            console.warn('[CancellationBilling] Appointment has already been paid');
            setError('This appointment has already been paid and cannot be cancelled.');
          } else if (targetApptInAll.status === 'cancelled') {
            console.warn('[CancellationBilling] Appointment is already cancelled');
            setError('This appointment is already cancelled.');
          } else {
            console.warn('[CancellationBilling] Appointment exists but is not eligible for cancellation. Status:', targetApptInAll.status);
            setError(`This appointment cannot be cancelled (status: ${targetApptInAll.status})`);
          }
        }
      } catch (err) {
        console.error('[CancellationBilling] Error loading appointments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load appointment data');
      } finally {
        setLoadingData(false);
      }
    }

    loadAppointmentsAndSetCancellation();
  }, [currentUser?.id, propAppointmentId]);

  // Helper function to calculate grace period status
  const getGracePeriodStatus = () => {
    if (!cancellationAppointment || !appointmentRules) {
      return { isWithinGrace: false, hoursElapsed: 0, hourGracePeriod: 0, minutesRemaining: 0 };
    }

    const now = new Date();
    const createdAt = new Date(cancellationAppointment.created_at || '');
    const elapsedMs = now.getTime() - createdAt.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const graceHours = appointmentRules.grace_period_hours || 0;
    const isWithinGrace = elapsedHours <= graceHours;
    const remainingMs = (graceHours * 60 * 60 * 1000) - elapsedMs;
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / (1000 * 60)));

    return {
      isWithinGrace,
      hoursElapsed: Math.floor(elapsedHours),
      hourGracePeriod: graceHours,
      minutesRemaining: remainingMinutes,
    };
  };

  const handlePayment = async () => {
    if (!cancellationAppointment || !currentUser?.id) {
      alert('Cancellation appointment not found.');
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 1. Create a billing record for cancellation fee
      const { error: billingError } = await supabase
        .from('billings')
        .insert({
          patient_id: currentUser.id,
          appointment_id: cancellationAppointment.id,
          amount: cancellationFee,
          discount_type: 'none',
          discount_amount: 0,
          final_amount: cancellationFee,
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          description: 'Appointment Cancellation Fee',
        });

      if (billingError) {
        console.error('Billing insert error:', billingError);
        throw new Error(`Failed to create cancellation fee: ${billingError.message}`);
      }

      // 2. Update appointment status to cancelled
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', cancellationAppointment.id);

      if (appointmentError) {
        console.error('Appointment update error:', appointmentError);
        throw new Error(`Failed to cancel appointment: ${appointmentError.message}`);
      }

      // 3. Delete the original service billing record (only if description is null or empty)
      console.log('[CancellationBilling] Attempting to delete original billing for appointment:', cancellationAppointment.id);
      
      const { data: deletedCount, error: deleteError } = await supabase
        .from('billings')
        .delete()
        .eq('appointment_id', cancellationAppointment.id)
        .is('description', null)
        .select();

      if (deleteError) {
        console.error('Delete error:', deleteError);
        console.warn('[CancellationBilling] Failed to delete original billing, but cancellation fee is recorded');
      } else {
        console.log('[CancellationBilling] Successfully deleted', deletedCount?.length || 0, 'original billing record(s)');
      }

      alert(
        `Appointment Cancelled Successfully!\nCancellation Fee Paid: ₱${cancellationFee.toFixed(2)}`
      );

      if (onCancellationComplete) {
        onCancellationComplete();
      }

      // Clear appointment state before navigation to reset component state
      setCancellationAppointment(null);
      
      // Add small delay to ensure database operations complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Navigate back with replace to prevent back navigation issues
      router.replace('/');
    } catch (error) {
      console.error('Cancellation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to process cancellation');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6 bg-bg-screen min-h-screen flex items-center justify-center">
        <p className="text-text-secondary">Loading cancellation details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-bg-screen min-h-screen">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
          <p className="text-red-800 font-semibold mb-2">Error:</p>
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="block mx-auto px-6 py-3 rounded-lg bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 transition"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  if (!cancellationAppointment) {
    return (
      <div className="p-6 bg-bg-screen min-h-screen">
        <p className="text-text-secondary text-center">Unable to load cancellation information.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 block mx-auto px-6 py-3 rounded-lg bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 transition"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-bg-screen min-h-screen">
      <h1 className="text-4xl font-bold text-brand-cyan mb-2">Cancel Appointment</h1>
      <p className="text-text-secondary mb-8">
        Complete your cancellation by paying the cancellation fee
      </p>

      {/* Cancellation Form */}
      <div className="bg-bg-surface rounded-lg shadow-md p-6 mb-8 transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(240,84,84,0.4)]">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Appointment Cancellation</h2>

        <div className="space-y-6">
          {/* Appointment Details */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-700 uppercase font-bold tracking-wide mb-2">Appointment to Cancel</p>
            <p className="text-lg font-bold text-text-primary">{cancellationAppointment.service}</p>
            <p className="text-sm text-text-secondary mt-2">
              {' '}
              {new Date(cancellationAppointment.appointment_date).toLocaleDateString('en-PH', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at {cancellationAppointment.appointment_time}
            </p>
            {cancellationAppointment.created_at && (
              <p className="text-xs text-red-600 mt-3 pt-3 border-t border-red-200">
                <span className="font-semibold">Booked:</span>{' '}
                {new Date(cancellationAppointment.created_at).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          {/* Grace Period Information */}
          {appointmentRules && (() => {
            const gracePeriod = getGracePeriodStatus();
            return (
              <div className={`border-2 rounded-lg p-4 ${
                gracePeriod.isWithinGrace
                  ? 'bg-green-50 border-green-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${
                  gracePeriod.isWithinGrace ? 'text-green-700' : 'text-orange-700'
                }`}>
                  Grace Period Status
                </p>
                <div className="space-y-2 text-xs">
                  <p className={gracePeriod.isWithinGrace ? 'text-green-900' : 'text-orange-900'}>
                    <span className="font-semibold">Grace Period Duration:</span> {gracePeriod.hourGracePeriod} hour{gracePeriod.hourGracePeriod !== 1 ? 's' : ''}
                  </p>
                  <p className={gracePeriod.isWithinGrace ? 'text-green-900' : 'text-orange-900'}>
                    <span className="font-semibold">Time Elapsed:</span> {gracePeriod.hoursElapsed} hour{gracePeriod.hoursElapsed !== 1 ? 's' : ''}
                  </p>
                  {gracePeriod.isWithinGrace && (
                    <p className="text-green-900 font-semibold">
                      You are within the grace period! {gracePeriod.minutesRemaining > 0 ? `${gracePeriod.minutesRemaining} minutes remaining.` : 'Grace period expiring soon!'}
                    </p>
                  )}
                  {!gracePeriod.isWithinGrace && (
                    <p className="text-orange-900 font-semibold">
                      Grace period has expired. Cancellation fee applies.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Cancellation Fee */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-700 uppercase font-bold tracking-wide mb-2">Cancellation Fee</p>
            <p className="text-3xl font-bold text-yellow-900">₱{cancellationFee.toFixed(2)}</p>
            <p className="text-sm text-yellow-700 mt-3">
              {cancellationFee === 0 
                ? 'Free cancellation! You are within the grace period, so no fee applies.'
                : 'Fee applies because you are cancelling after the grace period has expired.'}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-3">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-4 py-3 rounded-lg border-2 border-border-card focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none transition"
            >
              <option value="cash">Cash</option>
              <option value="card">Credit/Debit Card</option>
              <option value="online">Online Transfer</option>
            </select>
          </div>

          {/* Confirmation */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              By confirming, you acknowledge that this appointment will be cancelled and the fee will be charged to
              your account. This action cannot be undone.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 rounded-lg border-2 border-border-card text-text-primary font-semibold hover:bg-bg-notes transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handlePayment}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 rounded-lg bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : `Pay ₱${cancellationFee.toFixed(2)} & Cancel`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
