'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Appointment, Billing } from '@/lib/database';
import { getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';

interface CancellationBillingProps {
  onCancellationComplete?: () => void;
}

export default function CancellationBilling({ onCancellationComplete }: CancellationBillingProps) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cancellation-specific state
  const [cancellationAppointment, setCancellationAppointment] = useState<Appointment | null>(null);
  const [cancellationFee, setCancellationFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<Billing['payment_method']>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [unpaidAppointments, setUnpaidAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Load unpaid appointments on mount
  useEffect(() => {
    async function loadAppointments() {
      if (!currentUser || !currentUser.id) {
        setLoadingData(false);
        return;
      }
      
      setLoadingData(true);
      try {
        const userId = currentUser.id;
        const appts = await getPatientAppointments(userId);
        const billings = await getBillings(userId);
        
        const paidApptIds = new Set(
          billings
            .filter(b => b.payment_status === 'paid' && b.appointment_id)
            .map(b => b.appointment_id)
        );
        
        const unpaid = appts.filter(a => a.status !== 'cancelled' && !paidApptIds.has(a.id));
        setUnpaidAppointments(unpaid);
      } catch (err) {
        console.error('Error loading appointments:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadAppointments();
  }, [currentUser?.id]);

  // Handle cancellation from query params
  useEffect(() => {
    const action = searchParams.get('action');
    const appointmentId = searchParams.get('appointmentId');
    const cancellationFeeParam = searchParams.get('cancellationFee');

    if (action === 'cancel' && appointmentId && cancellationFeeParam) {
      const fee = parseFloat(cancellationFeeParam);
      setCancellationFee(fee);

      // Find the appointment to cancel
      const appt = unpaidAppointments.find(a => a.id === appointmentId);
      if (appt) {
        setCancellationAppointment(appt);
      }
    }
  }, [searchParams, unpaidAppointments]);

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

      // Redirect immediately without delay
      await router.push('/');
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
          </div>

          {/* Cancellation Fee */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-700 uppercase font-bold tracking-wide mb-2">Cancellation Fee</p>
            <p className="text-3xl font-bold text-yellow-900">₱{cancellationFee.toFixed(2)}</p>
            <p className="text-sm text-yellow-700 mt-2">
              This fee applies based on the clinic&apos;s cancellation policy.
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
