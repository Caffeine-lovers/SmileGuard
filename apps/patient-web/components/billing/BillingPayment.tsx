'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Billing, Appointment } from '@/lib/database';
import { calculateDiscount } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';

const SERVICE_PRICES: Record<string, number> = {
  Cleaning: 1500,
  Whitening: 5000,
  Fillings: 2000,
  'Root Canal': 8000,
  Extraction: 1500,
  Braces: 35000,
  Implants: 45000,
  'X-Ray': 500,
  'Check-up': 300,
};

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
    if (!currentUser) return;

    async function fetchBillingData() {
      setLoadingData(true);
      try {
        if (!currentUser) return;
        const [balance, billings, appts] = await Promise.all([
          getBalance(currentUser.id),
          getBillings(currentUser.id),
          getPatientAppointments(currentUser.id),
        ]);
        
        const paidApptIds = new Set(billings.filter(b => b.payment_status === 'paid' && b.appointment_id).map(b => b.appointment_id));
        const unpaid = appts.filter(a => a.status !== 'cancelled' && !paidApptIds.has(a.id));

        const unpaidApptsSum = unpaid.reduce((sum, a) => sum + (SERVICE_PRICES[a.service] || 0), 0);
        setOutstandingBalance(balance + unpaidApptsSum);
        
        setBillingHistory(billings);
        setUnpaidAppointments(unpaid);
        
        if (unpaid.length > 0 && !baseAmount) {
           const first = unpaid[0];
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
      setShowProofUpload(false);
    }
  };

  const handlePayment = async () => {
    if (discountType !== 'none' && !discountProof) {
      alert('Please upload proof of PWD/Senior ID.');
      return;
    }

    if (!selectedAppointment) {
      alert('Please select an appointment to pay.');
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Save billing record to database
      const { error } = await supabase
        .from('billings')
        .insert({
          patient_id: currentUser!.id,
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
          patient_id: currentUser!.id,
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
        getBalance(currentUser!.id),
        getBillings(currentUser!.id),
        getPatientAppointments(currentUser!.id),
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">💳 Manage Billing</h1>
      <p className="text-gray-600 mb-8">View and pay your outstanding balances</p>

      {/* Financial Summary Stats */}
      {!loadingData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-orange-50 rounded-lg shadow-md p-6 border-l-4 border-orange-600">
            <p className="text-sm text-gray-600">Outstanding Balance</p>
            <p className="text-3xl font-bold text-orange-700">₱{outstandingBalance?.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">Current Due</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-md p-6 border-l-4 border-blue-600">
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-3xl font-bold text-blue-700">{billingHistory.length}</p>
            <p className="text-xs text-gray-500 mt-2">On Record</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow-md p-6 border-l-4 border-green-600">
            <p className="text-sm text-gray-600">Account Status</p>
            <p className="text-3xl font-bold text-green-700">
              {outstandingBalance === 0 && unpaidAppointments.length === 0 ? '✓ Paid' : '⚠️ Pending'}
            </p>
            <p className="text-xs text-gray-500 mt-2">Status</p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">💰 Make Payment</h2>

        <div className="space-y-6">
          {/* Availed Services from Appointments */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Availed Service
            </label>
            {unpaidAppointments.length > 0 ? (
              <div className="bg-slate-50 border border-gray-200 rounded-lg p-2">
                <div className="border border-dashed border-gray-300 rounded bg-white overflow-hidden">
                  <div className="bg-gray-100 text-gray-500 text-xs font-bold tracking-widest text-center py-2 border-b border-dashed border-gray-300">
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
                          className={`w-full p-4 flex justify-between items-center border-b border-dashed border-gray-200 last:border-0 transition text-left ${
                            isSelected
                              ? 'bg-blue-50/50'
                              : 'hover:bg-gray-50 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              isSelected ? 'border-blue-600' : 'border-gray-400'
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                            </div>
                            <div>
                              <p className={`font-bold ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                                {apt.service}
                              </p>
                              <p className="text-sm font-mono text-gray-500 mt-0.5">
                                {new Date(apt.appointment_date).toLocaleDateString()} @ {apt.appointment_time}
                              </p>
                            </div>
                          </div>
                          <div className={`font-mono font-semibold text-lg ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                            ₱{price.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-gray-50 rounded-lg text-gray-500 text-center border-2 border-dashed border-gray-300">
                No pending appointments with services to pay.
              </div>
            )}
          </div>

          {/* Discount Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Apply Discount (Optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'none' as const, label: 'None' },
                { value: 'pwd' as const, label: '👴 PWD (10%)' },
                { value: 'senior' as const, label: '👵 Senior (15%)' },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleDiscountSelect(option.value)}
                  className={`p-3 rounded-lg border-2 font-semibold transition ${
                    discountType === option.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-blue-300 text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Proof Upload for Discounts */}
          {showProofUpload && discountType !== 'none' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                📄 Upload Proof of ID
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              {discountProof && <p className="text-sm text-green-600 mt-2">✓ {discountProof}</p>}
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                      : 'border-gray-200 hover:border-green-300 text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="my-6" />

          {/* Amount Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">Service Amount:</span>
                <span className="font-semibold">₱{amount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount ({(discountType || 'none').toUpperCase()}):</span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-blue-300 pt-3 flex justify-between text-lg font-bold text-gray-800">
                <span>Total Amount:</span>
                <span className="text-blue-700">₱{finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing History */}
      {billingHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 Billing History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left p-3 font-semibold text-gray-700">Date</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Service</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Amount</th>
                  <th className="text-center p-3 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.slice(0, 5).map((bill, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3 text-gray-700">
                      {bill.created_at ? new Date(bill.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 text-gray-700">{bill.appointment_id ? 'Appointment' : 'Service'}</td>
                    <td className="p-3 text-right font-semibold text-gray-800">
                      ₱{bill.amount?.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          bill.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
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
          className="flex-1 p-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition text-lg"
        >
          {isProcessing ? '⏳ Processing...' : '✓ Pay Now'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 p-4 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
