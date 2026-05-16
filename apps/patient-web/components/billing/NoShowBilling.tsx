'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Appointment, Billing } from '@/lib/database';
import { getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';
import { SERVICE_PRICES } from '@/lib/outstandingBalanceService';

interface NoShowBillingProps {
  onNoShowComplete?: () => void;
  appointmentId?: string;
  noShowPenalty?: number;
}

export default function NoShowBilling({ 
  onNoShowComplete, 
  appointmentId: propAppointmentId,
  noShowPenalty: propNoShowPenalty 
}: NoShowBillingProps) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize noShowPenalty from URL params if available
  const initialNoShowPenalty = useMemo(() => {
    const fromUrl = parseFloat(searchParams?.get('noShowPenalty') || '0');
    const fromProps = propNoShowPenalty || 0;
    return fromProps || fromUrl;
  }, [searchParams, propNoShowPenalty]);

  // No-show specific state
  const [noShowAppointment, setNoShowAppointment] = useState<Appointment | null>(null);
  const [noShowPenalty, setNoShowPenalty] = useState(initialNoShowPenalty);
  const [amountAlreadyPaid, setAmountAlreadyPaid] = useState(0);
  const [adjustedPenalty, setAdjustedPenalty] = useState(initialNoShowPenalty);
  const [paymentMethod, setPaymentMethod] = useState<Billing['payment_method']>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [unpaidAppointments, setUnpaidAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('[NoShowBilling] Initial state - penalty:', initialNoShowPenalty, 'from searchParams noShowPenalty:', searchParams?.get('noShowPenalty'));

  // Try to extract appointment data from URL if available
  const passedAppointmentData = useMemo(() => {
    try {
      const data = searchParams?.get('appointmentData');
      if (data) {
        console.log('[NoShowBilling] Found appointment data in params');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[NoShowBilling] Failed to parse appointmentData from params');
    }
    return null;
  }, [searchParams]);

  // Load unpaid no-show appointments
  useEffect(() => {
    async function loadAppointmentsAndSetNoShow() {
      if (!currentUser || !currentUser.id) {
        console.log('[NoShowBilling] No current user, skipping load');
        setLoadingData(false);
        return;
      }

      // Prefer props over searchParams for reliability
      // Accept both appointmentId (camelCase) and appointment_id (snake_case) parameter names
      const appointmentId = propAppointmentId || searchParams?.get('appointmentId') || searchParams?.get('appointment_id');
      
      // Parse penalty from URL or props - ensure it's a number
      const penaltyFromUrl = searchParams?.get('noShowPenalty');
      const penaltyFromProps = propNoShowPenalty;
      const noShowPenaltyParam = penaltyFromProps || (penaltyFromUrl ? parseFloat(penaltyFromUrl) : 0);

      console.log('[NoShowBilling] Starting load with params:', { 
        appointmentId, 
        noShowPenaltyParam,
        penaltyFromUrl,
        penaltyFromProps,
        fromProps: !!propAppointmentId 
      });

      // If params are missing, this is not a no-show flow
      if (!appointmentId) {
        console.warn('[NoShowBilling] Missing required no-show appointment ID');
        console.warn('[NoShowBilling] Available params:', {
          appointmentId: searchParams?.get('appointmentId'),
          appointment_id: searchParams?.get('appointment_id'),
          noShowPenalty: searchParams?.get('noShowPenalty'),
          action: searchParams?.get('action'),
        });
        setError('Missing no-show appointment ID. Please try again from the appointments list.');
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      setError(null);
      
      try {
        const userId = currentUser.id;
        console.log('[NoShowBilling] Fetching all appointments for user:', userId);
        
        const appts = await getPatientAppointments(userId);
        const billings = await getBillings(userId);

        // Normalize ID for comparison
        const normalizedSearchId = String(appointmentId).trim();

        console.log('[NoShowBilling] All appointments:', appts.map(a => ({ 
          id: a.id, 
          idType: typeof a.id,
          idTrimmed: String(a.id).trim(),
          status: a.status, 
          service: a.service 
        })));
        console.log('[NoShowBilling] Looking for appointmentId:', { 
          raw: appointmentId, 
          normalized: normalizedSearchId,
          type: typeof appointmentId
        });
        
        // First, check if the appointment exists at all in appointments table
        const targetApptInAll = appts.find(a => String(a.id).trim() === normalizedSearchId);
        if (!targetApptInAll) {
          console.error('[NoShowBilling] Appointment NOT found. Database IDs:', appts.map(a => ({ 
            raw: a.id, 
            trimmed: String(a.id).trim(),
            matches: String(a.id).trim() === normalizedSearchId
          })));
          console.error('[NoShowBilling] Verification failed: appointment_id from URL does not match any id in appointments table');
          setError(`Appointment not found in database. ID: ${appointmentId}. Please check that the appointment exists and belongs to you.`);
          setLoadingData(false);
          return;
        }

        console.log('[NoShowBilling] ✓ Verified: appointment_id from URL matches appointments.id in database', {
          id: targetApptInAll.id,
          service: targetApptInAll.service,
          status: targetApptInAll.status,
          date: targetApptInAll.appointment_date,
          time: targetApptInAll.appointment_time
        });
        
        // Check if no-show penalty is already paid (look specifically for paid "No-Show Penalty" records)
        const paidNoShowPenaltyIds = new Set(
          billings
            .filter(b => b.payment_status === 'paid' && b.appointment_id && b.description === 'No-Show Penalty')
            .map(b => String(b.appointment_id).trim())
        );
        
        // Verify billing.appointment_id matches appointments.id relationship
        console.log('[NoShowBilling] Verifying billing.appointment_id → appointments.id relationships:');
        const billingVerification = billings.map(b => {
          const normalizedBillingApptId = String(b.appointment_id || '').trim();
          const correspondingAppt = appts.find(a => String(a.id).trim() === normalizedBillingApptId);
          return {
            billingId: b.id,
            billingAppointmentId: normalizedBillingApptId,
            correspondingAppointmentExists: !!correspondingAppt,
            correspondingAppointmentService: correspondingAppt?.service,
            correspondingAppointmentStatus: correspondingAppt?.status,
            paymentStatus: b.payment_status,
            description: b.description
          };
        });
        console.log('[NoShowBilling] Billing verification results:', billingVerification);
        
        console.log('[NoShowBilling] Paid no-show penalty IDs:', Array.from(paidNoShowPenaltyIds));
        console.log('[NoShowBilling] Appointment status:', targetApptInAll.status);
        
        // Don't filter by status - just find the no-show appointment regardless of current status
        // It might be transitioning from 'scheduled' to 'no-show' or already be 'no-show'
        const unpaid = appts.filter(a => {
          // Accept the appointment if:
          // 1. It matches our ID AND
          // 2. It doesn't have a paid no-show penalty already
          const matches = String(a.id).trim() === normalizedSearchId;
          const hasPaidPenalty = paidNoShowPenaltyIds.has(String(a.id).trim());
          const isNotAlreadyPaid = !hasPaidPenalty;
          
          console.log(`[NoShowBilling] Checking appointment ${String(a.id).trim()}: matches=${matches}, hasPaidPenalty=${hasPaidPenalty}, status=${a.status}`);
          
          return matches && isNotAlreadyPaid;
        });
        setUnpaidAppointments(unpaid);

        // Find the no-show appointment (first match since we're looking for a specific ID)
        const targetAppt = unpaid.length > 0 ? unpaid[0] : undefined;

        if (targetAppt) {
          console.log('[NoShowBilling] Appointment is a no-show and unpaid', targetAppt);
          
          // Use noShowPenaltyParam which was properly parsed above from URL/props
          console.log('[NoShowBilling] Using no-show penalty:', { 
            value: noShowPenaltyParam,
            type: typeof noShowPenaltyParam,
            isValid: !isNaN(noShowPenaltyParam) && noShowPenaltyParam > 0
          });
          
          setNoShowPenalty(noShowPenaltyParam);
          
          // Calculate amount already paid for this appointment
          const paidAmount = billings
            .filter(b => b.appointment_id === targetAppt.id && b.payment_status === 'paid')
            .reduce((sum, b) => sum + (b.final_amount || 0), 0);
          
          console.log('[NoShowBilling] Amount already paid for appointment:', paidAmount);
          
          // If appointment IS paid, deduct from penalty
          // If appointment is NOT paid, still show penalty (patient needs to pay the full no-show penalty)
          setAmountAlreadyPaid(paidAmount);
          
          // Calculate adjusted penalty: no_show_penalty - amount_already_paid
          // Allow negative amounts (overpayment) to be shown
          const adjusted = noShowPenaltyParam - paidAmount;
          console.log('[NoShowBilling] Final adjusted penalty:', { 
            original: noShowPenaltyParam, 
            paid: paidAmount,
            adjusted,
            isOverpaid: adjusted < 0,
            isCovered: adjusted === 0
          });
          
          setAdjustedPenalty(adjusted);
          setNoShowAppointment(targetAppt);
        } else {
          // Appointment exists but is not eligible for no-show penalty
          if (paidNoShowPenaltyIds.has(String(appointmentId).trim())) {
            console.warn('[NoShowBilling] Appointment has already been paid');
            setError('This no-show penalty has already been paid.');
          } else if (targetApptInAll.status !== 'no-show') {
            console.warn('[NoShowBilling] Appointment is not marked as no-show. Status:', targetApptInAll.status);
            setError(`This appointment is not marked as no-show (status: ${targetApptInAll.status})`);
          } else {
            console.warn('[NoShowBilling] Appointment exists but is not eligible for no-show penalty');
            setError('This appointment cannot process no-show penalty.');
          }
        }
      } catch (err) {
        console.error('[NoShowBilling] Error loading appointments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load appointment data');
      } finally {
        setLoadingData(false);
      }
    }

    loadAppointmentsAndSetNoShow();
  }, [currentUser?.id, propAppointmentId, initialNoShowPenalty]);

  const handlePayment = async () => {
    if (!noShowAppointment || !currentUser?.id) {
      alert('No-show appointment not found.');
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 1. Only delete existing billing records if penalty is still pending (adjustedPenalty > 0)
      if (adjustedPenalty > 0) {
        console.log('[NoShowBilling] Penalty pending - deleting existing billing records for appointment:', noShowAppointment.id);
        
        // First, fetch all billing records for this appointment
        const { data: existingBillings, error: fetchError } = await supabase
          .from('billings')
          .select('id, description, payment_status')
          .eq('appointment_id', noShowAppointment.id);
        
        if (fetchError) {
          console.error('Billing fetch error:', fetchError);
          throw new Error(`Failed to fetch existing billing: ${fetchError.message}`);
        }
        
        console.log('[NoShowBilling] Found existing billing records:', existingBillings);
        
        // Delete only non-penalty billing records
        const toDelete = existingBillings?.filter(b => b.description !== 'No-Show Penalty') || [];
        console.log('[NoShowBilling] Records to delete (excluding No-Show Penalty):', toDelete);
        
        if (toDelete.length > 0) {
          const idsToDelete = toDelete.map(b => b.id);
          const { error: deleteError } = await supabase
            .from('billings')
            .delete()
            .in('id', idsToDelete);
          
          if (deleteError) {
            console.error('Billing delete error:', deleteError);
            throw new Error(`Failed to delete existing appointment billing: ${deleteError.message}`);
          }
          
          console.log('[NoShowBilling] Successfully deleted', idsToDelete.length, 'billing records');
        } else {
          console.log('[NoShowBilling] No non-penalty billing records to delete');
        }
      } else {
        console.log('[NoShowBilling] Penalty already covered - keeping existing billing records');
      }

      // 2. Always create a billing record for no-show penalty (even if already paid)
      const { error: billingError } = await supabase
        .from('billings')
        .insert({
          patient_id: currentUser.id,
          appointment_id: noShowAppointment.id,
          amount: noShowPenalty,
          discount_type: 'none',
          discount_amount: amountAlreadyPaid > 0 ? amountAlreadyPaid : 0,
          final_amount: noShowPenalty - amountAlreadyPaid,
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          description: 'No-Show Penalty',
        });

      if (billingError) {
        console.error('Billing insert error:', billingError);
        throw new Error(`Failed to create no-show penalty: ${billingError.message}`);
      }

      console.log('[NoShowBilling] Successfully created no-show penalty billing record');

      // Determine success message based on payment status
      const successMessage = adjustedPenalty < 0
        ? `No-Show Penalty Confirmed!\nOriginal Penalty: ₱${noShowPenalty.toFixed(2)}\nOverpaid Amount: ₱${Math.abs(adjustedPenalty).toFixed(2)}\n\nYou can now book new appointments.`
        : adjustedPenalty === 0
        ? `No-Show Penalty Confirmed!\nYour appointment payment covers the penalty.\n\nYou can now book new appointments.`
        : `No-Show Penalty Paid Successfully!\nAmount Paid: ₱${adjustedPenalty.toFixed(2)}\n\nYou can now book new appointments.`;

      alert(successMessage);

      if (onNoShowComplete) {
        onNoShowComplete();
      }

      // Clear appointment state before navigation
      setNoShowAppointment(null);
      
      // Add small delay to ensure database operations complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Navigate to dashboard
      router.push('/');
    } catch (error) {
      console.error('No-show penalty error:', error);
      alert(error instanceof Error ? error.message : 'Failed to process no-show penalty');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6 bg-bg-screen min-h-screen flex items-center justify-center">
        <p className="text-text-secondary">Loading no-show penalty details...</p>
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
          onClick={() => router.back()}
          className="block mx-auto px-6 py-3 rounded-lg bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 transition"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  if (!noShowAppointment) {
    return (
      <div className="p-6 bg-bg-screen min-h-screen">
        <p className="text-text-secondary text-center">Unable to load no-show penalty information.</p>
        <button
          onClick={() => router.back()}
          className="mt-6 block mx-auto px-6 py-3 rounded-lg bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 transition"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-bg-screen min-h-screen">
      <h1 className="text-4xl font-bold text-red-600 mb-2">No-Show Penalty</h1>
      <p className="text-text-secondary mb-8">
        You missed your appointment. Please pay the no-show penalty to continue booking appointments.
      </p>

      {/* No-Show Penalty Form */}
      <div className="bg-bg-surface rounded-lg shadow-md p-6 mb-8 transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(240,84,84,0.4)]">
        <h2 className="text-2xl font-bold text-text-primary mb-6">No-Show Penalty Payment</h2>

        <div className="space-y-6">
          {/* Appointment Details */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <p className="text-xs text-red-700 uppercase font-bold tracking-wide mb-2">Missed Appointment</p>
            <p className="text-lg font-bold text-text-primary">{noShowAppointment.service}</p>
            <p className="text-sm text-text-secondary mt-2">
              {' '}
              {new Date(noShowAppointment.appointment_date).toLocaleDateString('en-PH', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at {noShowAppointment.appointment_time}
            </p>
          </div>

          {/* No-Show Penalty */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
            <p className="text-xs text-amber-700 uppercase font-bold tracking-wide mb-2">No-Show Penalty Breakdown</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-amber-700">Original Penalty Amount:</p>
                <p className="text-lg font-bold text-amber-900">₱{noShowPenalty.toFixed(2)}</p>
              </div>
              {amountAlreadyPaid > 0 && (
                <>
                  <div className="border-t border-amber-200 pt-2" />
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-amber-700">Amount Already Paid (Appointment Service):</p>
                    <p className="text-lg font-bold text-green-600">-₱{amountAlreadyPaid.toFixed(2)}</p>
                  </div>
                  <div className="border-t border-amber-200 pt-2" />
                  <div className="flex justify-between items-center bg-white rounded p-2">
                    <p className="text-sm font-semibold text-amber-900">Remaining Balance to Pay:</p>
                    <p className={`text-2xl font-bold ${
                      adjustedPenalty < 0 ? 'text-green-600' : 
                      adjustedPenalty === 0 ? 'text-blue-600' : 
                      'text-amber-900'
                    }`}>
                      {adjustedPenalty < 0 ? '-' : ''}₱{Math.abs(adjustedPenalty).toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>
            <p className="text-sm text-amber-700 mt-3">
              This penalty is charged because you did not show up for your scheduled appointment without cancelling beforehand.
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

          {/* Warning */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-bold">Important:</span> You cannot book new appointments until this no-show penalty is paid. 
              After payment, you will be able to schedule appointments again.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 rounded-lg border-2 border-border-card text-text-primary font-semibold hover:bg-bg-notes transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handlePayment}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? 'Processing...'
                : adjustedPenalty < 0
                ? `Overpaid by ₱${Math.abs(adjustedPenalty).toFixed(2)}`
                : adjustedPenalty === 0
                ? 'Penalty Already Covered - Confirm'
                : `Pay ₱${adjustedPenalty.toFixed(2)} Penalty`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
