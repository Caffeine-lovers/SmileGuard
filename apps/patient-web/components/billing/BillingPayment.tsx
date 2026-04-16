'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Billing, Appointment } from '@/lib/database';
import { calculateDiscount } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';
import { fetchBillingDataForDashboard, SERVICE_PRICES } from '@/lib/outstandingBalanceService';

interface BillingPaymentProps {
  appointmentId?: string;
  baseAmount?: number;
  onSuccess?: (billing: Billing) => void;
  onCancel?: () => void;
}

export default function BillingPayment({
  appointmentId: _appointmentId,
  baseAmount = 0,
  onSuccess,
  onCancel,
}: BillingPaymentProps) {
  const { currentUser } = useAuth();
  const [unpaidAppointments, setUnpaidAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [amount, setAmount] = useState<number>(baseAmount || 0);
  const [discountType, setDiscountType] = useState<Billing['discount_type']>('none');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(amount);
  const [paymentMethod, setPaymentMethod] = useState<Billing['payment_method']>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountProof, setDiscountProof] = useState<string | null>(null);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0);
  const [billingHistory, setBillingHistory] = useState<Billing[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;

    const userId = currentUser.id;

    async function fetchBillingData() {
      setLoadingData(true);
      try {
        const { outstandingBalance, unpaidAppointments, billingHistory } =
          await fetchBillingDataForDashboard(userId);

        setOutstandingBalance(outstandingBalance);
        setBillingHistory(billingHistory);
        setUnpaidAppointments(unpaidAppointments);

        if (unpaidAppointments.length > 0 && !baseAmount) {
          const first = unpaidAppointments[0];
          setSelectedAppointment(first);
          const initialAmt = SERVICE_PRICES[first.service] || 0;
          setAmount(initialAmt);
          const result = calculateDiscount(initialAmt, discountType);
          setDiscountAmount(result.discountAmount);
          setFinalAmount(result.finalAmount);
        }
      } catch (err) {
        console.error('Error fetching billing data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchBillingData();
  }, [currentUser?.id, baseAmount, discountType]);

  const handleAppointmentSelect = (apt: Appointment) => {
    setSelectedAppointment(apt);
    const newAmount = SERVICE_PRICES[apt.service] || 0;
    setAmount(newAmount);
    applyDiscount(newAmount, discountType);
  };

  const applyDiscount = (total: number, type: Billing['discount_type']) => {
    const result = calculateDiscount(total, type);
    setDiscountAmount(result.discountAmount);
    setFinalAmount(result.finalAmount);
  };

  const handleDiscountSelect = (type: Billing['discount_type']) => {
    // Only clear the proof if the discount type changes
    if (discountType !== type) {
      setDiscountProof(null);
    }
    
    setDiscountType(type);
    applyDiscount(amount, type);

    if (type !== 'none') {
      setShowProofUpload(true);
    } else {
      setDiscountProof(null);
    }
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDiscountProof(file.name);
    }
  };

  const handlePayment = async () => {
    if (discountType !== 'none' && !discountProof) {
      alert('Please upload proof of PWD/Senior ID.');
      return;
    }

    if (!selectedAppointment || !currentUser?.id) {
      alert('Please select an appointment to pay.');
      return;
    }

    const userId = currentUser.id;
    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save billing record to database
      const { error } = await supabase
        .from('billings')
        .insert({
          patient_id: userId,
          appointment_id: selectedAppointment.id,
          amount,
          discount_type: discountType,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
        });

      if (error) throw error;

      alert(
        `Payment Successful!\nAmount Paid: ₱${finalAmount.toFixed(2)}\nPayment Method: ${
          (paymentMethod as string).charAt(0).toUpperCase() + (paymentMethod as string).slice(1)
        }${
          discountType !== 'none' ? `\nDiscount: -₱${discountAmount.toFixed(2)}` : ''
        }`
      );

      // Callback for parent component
      if (onSuccess) {
        onSuccess({
          id: Date.now().toString(),
          patient_id: userId,
          appointment_id: selectedAppointment.id,
          amount,
          discount_type: discountType,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }

      // Refresh billing data
      const [balance, billings, appts] = await Promise.all([
        getBalance(userId),
        getBillings(userId),
        getPatientAppointments(userId),
      ]);

      const paidApptIds = new Set(billings.filter(b => b.payment_status === 'paid' && b.appointment_id).map(b => b.appointment_id));
      const unpaid = appts.filter(a => a.status !== 'cancelled' && !paidApptIds.has(a.id));
      const unpaidApptsSum = unpaid.reduce((sum, a) => sum + (SERVICE_PRICES[a.service] || 0), 0);

      setOutstandingBalance(balance + unpaidApptsSum);
      setBillingHistory(billings);
      setUnpaidAppointments(unpaid);
      setSelectedAppointment(null);
      setAmount(0);
      setDiscountType('none');
      setDiscountProof(null);
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-bg-screen min-h-screen">
      <h1 className="text-4xl font-bold text-brand-cyan mb-2">Manage Billing</h1>
      <p className="text-text-secondary mb-8">View and pay your outstanding balances</p>

      {/* Financial Summary Stats */}
      {!loadingData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/">
            <div className="bg-brand-danger/10 rounded-lg shadow-md p-6 transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(240,84,84,0.4)] cursor-pointer">
              <p className="text-sm text-text-secondary">Outstanding Balance</p>
              <p className="text-3xl font-bold text-brand-danger">₱{outstandingBalance?.toFixed(2)}</p>
              <p className="text-xs text-text-secondary mt-2">Current Due</p>
            </div>
          </Link>
          <div className="bg-brand-primary/10 rounded-lg shadow-md p-6 transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(61,170,184,0.4)]">
            <p className="text-sm text-text-secondary">Total Transactions</p>
            <p className="text-3xl font-bold text-brand-primary">{billingHistory.length}</p>
            <p className="text-xs text-text-secondary mt-2">On Record</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow-md p-6 transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]">
            <p className="text-sm text-text-secondary">Account Status</p>
            <p className="text-3xl font-bold text-green-700">
              {outstandingBalance === 0 && unpaidAppointments.length === 0 ? '✓ Paid' : '⚠️ Pending'}
            </p>
            <p className="text-xs text-text-secondary mt-2">Status</p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <div className="bg-bg-surface rounded-lg shadow-md p-6 mb-8 transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(41,171,226,0.4)]">
        <h2 className="text-2xl font-bold text-text-primary mb-6">💰 Make Payment</h2>

        <div className="space-y-6">
          {/* Availed Services from Appointments */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-3">
              Select Availed Service
            </label>
            {unpaidAppointments.length > 0 ? (
              <div className="bg-bg-notes rounded-lg p-2 shadow-sm">
                <div className="rounded bg-bg-surface overflow-hidden shadow-sm">
                  <div className="bg-bg-notes text-text-secondary text-xs font-bold tracking-widest text-center py-2">
                    PENDING INVOICES
                  </div>
                  <div className="flex flex-col">
                    {unpaidAppointments.map((apt) => {
                      const price = SERVICE_PRICES[apt.service] || 0;
                      const isSelected = selectedAppointment?.id === apt.id;
                      return (
                        <button
                          type="button"
                          key={apt.id}
                          onClick={() => handleAppointmentSelect(apt)}
                          className={`w-full p-4 flex justify-between items-center transition text-left ${
                            isSelected
                              ? 'bg-brand-primary/5'
                              : 'hover:bg-bg-notes bg-bg-surface'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              isSelected ? 'border-brand-primary' : 'border-border-card'
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary" />}
                            </div>
                            <div>
                              <p className={`font-bold ${isSelected ? 'text-brand-primary' : 'text-text-primary'}`}>
                                {apt.service}
                              </p>
                              <p className="text-sm font-mono text-text-secondary mt-0.5">
                                {new Date(apt.appointment_date).toLocaleDateString()} @ {apt.appointment_time}
                              </p>
                            </div>
                          </div>
                          <div className={`font-mono font-semibold text-lg ${isSelected ? 'text-brand-primary' : 'text-text-primary'}`}>
                            ₱{price.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-bg-notes rounded-lg text-text-secondary text-center border-2 border-dashed border-border-card">
                No pending appointments with services to pay.
              </div>
            )}
          </div>

          {/* Discount Selection */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-3">
              Apply Discount (Optional)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'none' as const, label: 'None' },
                { value: 'pwd' as const, label: '👴 PWD (10%)' },
                { value: 'senior' as const, label: '👵 Senior (15%)' },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleDiscountSelect(option.value)}
                  className={`p-3 rounded-lg border-2 font-semibold transition outline-none ${
                    discountType === option.value
                      ? 'border-brand-primary bg-brand-primary/5 text-brand-primary ring-2 ring-brand-primary/30'
                      : 'border-border-card hover:border-brand-primary/50 text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Proof Upload for Discounts */}
          {showProofUpload && discountType === 'pwd' && (
            <div className="p-6 bg-bg-notes border-2 border-dashed border-border-card rounded-lg text-center transition-colors hover:border-brand-primary/50">
              <label className="block text-sm font-semibold text-text-primary mb-3">
                📄 Drop your PWD ID here, or click to upload
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                className="block mx-auto w-full max-w-xs text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-primary file:text-white file:font-semibold file:cursor-pointer hover:file:bg-brand-primary/90 cursor-pointer"
              />
              {discountProof && <p className="text-sm font-bold text-green-600 mt-4">✓ {discountProof} uploaded</p>}
            </div>
          )}

          {showProofUpload && discountType === 'senior' && (
            <div className="p-6 bg-bg-notes border-2 border-dashed border-border-card rounded-lg text-center transition-colors hover:border-brand-primary/50">
              <label className="block text-sm font-semibold text-text-primary mb-3">
                📄 Drop your Senior Citizen ID here, or click to upload
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                className="block mx-auto w-full max-w-xs text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-primary file:text-white file:font-semibold file:cursor-pointer hover:file:bg-brand-primary/90 cursor-pointer"
              />
              {discountProof && <p className="text-sm font-bold text-green-600 mt-4">✓ {discountProof} uploaded</p>}
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'cash' as const, label: '💵 Cash' },
                { value: 'card' as const, label: '💳 Card' },
                { value: 'bank-transfer' as const, label: '🏧 Bank Transfer' },
                { value: 'gcash' as const, label: '📱 GCash' },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setPaymentMethod(option.value)}
                  className={`p-3 rounded-lg border-2 font-semibold transition ${
                    paymentMethod === option.value
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-border-card hover:border-green-300 text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="my-6 border-border-card" />

          {/* Amount Summary */}
          <div className="bg-brand-primary/5 rounded-lg p-6 border border-brand-primary/20">
            <h3 className="text-lg font-bold text-text-primary mb-4">📊 Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-text-primary">
                <span className="font-medium">Service Amount:</span>
                <span className="font-semibold">₱{amount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount ({(discountType || 'none').toUpperCase()}):</span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-brand-primary/20 pt-3 flex justify-between text-lg font-bold text-text-primary">
                <span>Total Amount:</span>
                <span className="text-brand-primary">₱{finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing History */}
      {billingHistory.length > 0 && (
        <div className="bg-bg-surface rounded-lg shadow-md p-6 mb-8 border border-border-card">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Billing History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border-card">
                  <th className="text-left p-3 font-semibold text-text-primary">Date</th>
                  <th className="text-left p-3 font-semibold text-text-primary">Service</th>
                  <th className="text-right p-3 font-semibold text-text-primary">Amount</th>
                  <th className="text-center p-3 font-semibold text-text-primary">Status</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.slice(0, 5).map((bill, idx) => (
                  <tr key={idx} className="border-b border-border-card hover:bg-bg-notes">
                    <td className="p-3 text-text-primary">
                      {bill.created_at ? new Date(bill.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 text-text-primary">{bill.appointment_id ? 'Appointment' : 'Service'}</td>
                    <td className="p-3 text-right font-semibold text-text-primary">
                      ₱{bill.amount?.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-pill text-xs font-bold ${
                          bill.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-brand-danger/10 text-brand-danger'
                        }`}
                      >
                        {bill.payment_status === 'paid' ? '✓ Paid' : '⏳ Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4">
        <button
          type="button"
          onClick={handlePayment}
          disabled={isProcessing || (!selectedAppointment && unpaidAppointments.length > 0)}
          className="flex-1 p-4 bg-brand-primary text-text-on-avatar font-bold rounded-pill hover:bg-brand-primary/90 disabled:bg-border-card transition text-lg"
        >
          {isProcessing ? '⏳ Processing...' : '✓ Pay Now'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 p-4 bg-border-card text-text-primary font-semibold rounded-pill hover:bg-border-card/80 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
