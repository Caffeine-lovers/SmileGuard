'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import dynamic from 'next/dynamic';
import { supabase } from '@smileguard/supabase-client';
import type { Billing, Appointment } from '@/lib/database';
import { calculateDiscount } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';
import { fetchBillingDataForDashboard, SERVICE_PRICES } from '@/lib/outstandingBalanceService';
import {
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  ShieldCheck,
} from 'lucide-react';

// Lazy-load Stripe components (only when card payment is selected)
const StripeProvider = dynamic(
  () => import('@/components/billing/StripeProvider'),
  { ssr: false }
);
const CardPaymentForm = dynamic(
  () => import('@/components/billing/CardPaymentForm'),
  { ssr: false }
);

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

  // Stripe-specific state
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [showStripeForm, setShowStripeForm] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

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
    // Reset Stripe form if switching appointments
    setShowStripeForm(false);
    setStripeClientSecret(null);
    setStripeError(null);
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

    // Reset Stripe form when discount changes
    setShowStripeForm(false);
    setStripeClientSecret(null);
  };

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDiscountProof(file.name);
    }
  };

  const refreshBillingData = async () => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;

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
    setShowStripeForm(false);
    setStripeClientSecret(null);
  };

  // Initiate Stripe card payment
  const handleStripePayment = async () => {
    if (!selectedAppointment || !currentUser?.id) {
      alert('Please select an appointment to pay.');
      return;
    }

    if (discountType !== 'none' && !discountProof) {
      alert('Please upload proof of PWD/Senior ID.');
      return;
    }

    setIsProcessing(true);
    setStripeError(null);

    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          appointmentId: selectedAppointment.id,
          patientId: currentUser.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      setStripeClientSecret(data.clientSecret);
      setShowStripeForm(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to initiate card payment';
      setStripeError(msg);
      console.error('Stripe payment initiation error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle successful Stripe payment
  const handleStripeSuccess = async () => {
    if (!selectedAppointment || !currentUser?.id) return;

    // Save billing record (webhook also does this, but we do it here for immediate UI update)
    try {
      await supabase.from('billings').insert({
        patient_id: currentUser.id,
        appointment_id: selectedAppointment.id,
        amount,
        discount_type: discountType,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_status: 'paid',
        payment_method: 'card',
        payment_date: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error saving billing after Stripe payment:', err);
    }

    alert(
      `Payment Successful!\nAmount Paid: ₱${finalAmount.toFixed(2)}\nPayment Method: Card${
        discountType !== 'none' ? `\nDiscount: -₱${discountAmount.toFixed(2)}` : ''
      }`
    );

    if (onSuccess) {
      onSuccess({
        patient_id: currentUser.id,
        appointment_id: selectedAppointment.id,
        amount,
        discount_type: discountType,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_status: 'paid',
        payment_method: 'card',
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    await refreshBillingData();
  };

  const handleStripeError = (message: string) => {
    setStripeError(message);
  };

  const handleStripeCancelForm = () => {
    setShowStripeForm(false);
    setStripeClientSecret(null);
    setStripeError(null);
  };

  // Handle non-card payment (existing flow for cash, gcash, bank-transfer)
  const handleNonCardPayment = async () => {
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
      // Simulate payment processing for non-card methods
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

      await refreshBillingData();
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (paymentMethod === 'card') {
      await handleStripePayment();
    } else {
      await handleNonCardPayment();
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen max-w-5xl mx-auto space-y-6">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-6 text-white border-2 border-emerald-950 shadow-md">
        <div className="flex items-center gap-3 mb-1">
          <span className="skeuo-badge skeuo-badge-mint text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400">
            <ShieldCheck className="w-3 h-3 text-emerald-950" />
            Clinic Billing Portal
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Accounts & Settlement</h1>
        <p className="text-emerald-100 text-xs font-semibold tracking-wide uppercase mt-0.5">
          Settle procedure balances and review financial ledgers
        </p>
      </div>

      {/* Financial Summary Stats */}
      {!loadingData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/billing" className="block no-underline">
            <div className="skeuo-card p-5 border-2 border-red-300 bg-red-50/40 rounded-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Outstanding Balance</span>
              <p className="text-2xl font-black tracking-tight text-red-700 mt-1">₱{outstandingBalance?.toFixed(2)}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">Current Balance Due</p>
            </div>
          </Link>
          <div className="skeuo-card p-5 border-2 border-slate-300 rounded-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Transactions</span>
            <p className="text-2xl font-black tracking-tight text-slate-900 mt-1">{billingHistory.length}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Settled on Ledger</p>
          </div>
          <div className="skeuo-card p-5 border-2 border-emerald-300 bg-emerald-50/40 rounded-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Account Standing</span>
            <div className="flex items-center gap-2 mt-1">
              {outstandingBalance === 0 && unpaidAppointments.length === 0 ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-xl font-black tracking-tight text-emerald-700 uppercase">Settled</p>
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5 text-amber-600" />
                  <p className="text-xl font-black tracking-tight text-amber-700 uppercase">Pending Due</p>
                </>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Clinical Settlement Status</p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <div className="skeuo-panel p-6 border-2 border-slate-300">
        <div className="flex items-center gap-2 pb-4 mb-6 border-b-2 border-slate-200">
          <Receipt className="w-5 h-5 text-emerald-700" />
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
            Process Invoice Payment
          </h2>
        </div>

        <div className="space-y-6">
          {/* Availed Services from Appointments */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Select Procedure to Settle
            </label>
            {unpaidAppointments.length > 0 ? (
              <div className="space-y-2">
                {unpaidAppointments.map((apt) => {
                  const price = SERVICE_PRICES[apt.service] || 0;
                  const isSelected = selectedAppointment?.id === apt.id;
                  return (
                    <button
                      type="button"
                      key={apt.id}
                      onClick={() => handleAppointmentSelect(apt)}
                      className={`skeuo-card w-full p-4 flex justify-between items-center rounded-sm text-left border-2 transition ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-xs border-2 flex items-center justify-center ${
                          isSelected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-400'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{apt.service}</p>
                          <p className="text-xs font-mono text-slate-500">
                            {new Date(apt.appointment_date).toLocaleDateString()} @ {apt.appointment_time}
                          </p>
                        </div>
                      </div>
                      <div className="font-mono font-black text-base text-emerald-800">
                        ₱{price.toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-sm text-slate-500 text-center border-2 border-dashed border-slate-300 text-xs font-bold uppercase tracking-wider">
                No unpaid procedures currently outstanding on record.
              </div>
            )}
          </div>

          {/* Discount Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Eligible Statutory Discount
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'none' as const, label: 'Standard Rate' },
                { value: 'pwd' as const, label: 'PWD (10%)' },
                { value: 'senior' as const, label: 'Senior (15%)' },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleDiscountSelect(option.value)}
                  className={`py-2.5 px-3 rounded-sm border-2 text-xs font-bold uppercase tracking-wider transition ${
                    discountType === option.value
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-800 shadow-xs'
                      : 'border-slate-300 bg-white hover:border-slate-400 text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Proof Upload for Discounts */}
          {showProofUpload && (discountType === 'pwd' || discountType === 'senior') && (
            <div className="p-5 bg-emerald-50/40 border-2 border-dashed border-emerald-400 rounded-sm text-center">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                Upload Valid {discountType === 'pwd' ? 'PWD' : 'Senior Citizen'} Identification Card
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                className="block mx-auto text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xs file:border file:border-emerald-700 file:bg-emerald-700 file:text-white file:text-xs file:font-bold file:uppercase file:cursor-pointer cursor-pointer"
              />
              {discountProof && (
                <p className="text-xs font-bold text-emerald-700 mt-2 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{discountProof} uploaded for clinical audit</span>
                </p>
              )}
            </div>
          )}

          {/* Payment Method Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Select Settlement Channel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { value: 'cash' as const, label: 'Clinic Cash', icon: Banknote },
                { value: 'card' as const, label: 'Credit/Debit (Stripe)', icon: CreditCard },
                { value: 'bank-transfer' as const, label: 'Bank Transfer', icon: Building2 },
                { value: 'gcash' as const, label: 'GCash', icon: Smartphone },
              ].map((option) => {
                const IconComponent = option.icon;
                const isSelected = paymentMethod === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => {
                      setPaymentMethod(option.value);
                      if (option.value !== 'card') {
                        setShowStripeForm(false);
                        setStripeClientSecret(null);
                        setStripeError(null);
                      }
                    }}
                    className={`p-3 rounded-sm border-2 text-xs font-bold uppercase tracking-wider transition flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-slate-300 bg-white hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Summary */}
          <div className="skeuo-card p-5 bg-slate-50 border-2 border-slate-300 rounded-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-600" />
              Payment Breakdown
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-700">
                <span>Standard Procedure Fee:</span>
                <span className="font-mono font-bold">₱{amount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="font-semibold">Discount Applied ({(discountType || 'none').toUpperCase()}):</span>
                  <span className="font-mono font-bold">-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t-2 border-slate-200 pt-2 flex justify-between text-base font-black text-slate-900">
                <span className="uppercase tracking-wide">Net Settlement:</span>
                <span className="font-mono text-emerald-800">₱{finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Stripe Error */}
          {stripeError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-400 rounded-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <p className="text-xs font-bold">{stripeError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stripe Card Payment Form */}
      {showStripeForm && stripeClientSecret && (
        <div className="skeuo-panel p-6 border-2 border-emerald-600">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-slate-200">
            <div className="w-10 h-10 bg-emerald-100 rounded-xs border border-emerald-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight text-slate-900">Card Payment Gateway</h2>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Visa, Mastercard, Debit, ATM cards</p>
            </div>
          </div>
          <StripeProvider clientSecret={stripeClientSecret}>
            <CardPaymentForm
              amount={finalAmount}
              onSuccess={handleStripeSuccess}
              onError={handleStripeError}
              onCancel={handleStripeCancelForm}
            />
          </StripeProvider>
        </div>
      )}

      {/* Billing History Table */}
      {billingHistory.length > 0 && (
        <div className="skeuo-panel p-6 border-2 border-slate-300">
          <h2 className="text-base font-black uppercase tracking-tight text-slate-900 mb-4">
            Recent Billing Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-500 uppercase tracking-wider">
                  <th className="text-left p-2.5 font-bold">Transaction Date</th>
                  <th className="text-left p-2.5 font-bold">Clinical Service</th>
                  <th className="text-right p-2.5 font-bold">Amount Paid</th>
                  <th className="text-center p-2.5 font-bold">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {billingHistory.slice(0, 5).map((bill, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-700 font-mono">
                      {bill.created_at ? new Date(bill.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-2.5 text-slate-900 font-bold">{bill.appointment_id ? 'Dental Appointment' : 'Clinical Service'}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      ₱{bill.amount?.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={bill.payment_status === 'paid' ? 'skeuo-badge skeuo-badge-mint' : 'skeuo-badge skeuo-badge-amber'}>
                        {bill.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action CTA Buttons */}
      {!showStripeForm && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handlePayment}
            disabled={isProcessing || (!selectedAppointment && unpaidAppointments.length > 0)}
            className="skeuo-btn-primary py-2.5 px-5 text-xs uppercase tracking-wider disabled:opacity-50 shrink-0"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Processing Payment...</span>
              </span>
            ) : paymentMethod === 'card' ? (
              <span className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Pay ₱{finalAmount.toFixed(2)} with Card</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Confirm Settlement</span>
              </span>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="skeuo-btn-secondary py-2.5 px-4 text-xs uppercase tracking-wider shrink-0"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
