'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import type { Billing } from '@/lib/database';
import { calculateDiscount } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';

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
  const [selectedService, setSelectedService] = useState<string>('Check-up');
  const [amount, setAmount] = useState<number>(baseAmount || SERVICE_PRICES['Check-up']);
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
        const [balance, billings] = await Promise.all([
          getBalance(currentUser.id),
          getBillings(currentUser.id),
        ]);
        setOutstandingBalance(balance);
        setBillingHistory(billings);
      } catch (err) {
        console.error('Error fetching billing data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchBillingData();
  }, [currentUser]);

  const handleServiceChange = (service: string) => {
    setSelectedService(service);
    const newAmount = SERVICE_PRICES[service] || 0;
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
      alert('Please upload proof of PWD/Senior/Insurance ID.');
      return;
    }

    setIsProcessing(true);
    try {
      // Mock payment processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      alert(
        `Payment Successful!\nAmount Paid: ₱${finalAmount.toFixed(2)}\nPayment Method: ${paymentMethod}${
          discountType !== 'none' ? `\nDiscount: -₱${discountAmount.toFixed(2)}` : ''
        }`
      );
      if (onSuccess) {
        onSuccess({
          id: '1',
          patient_id: '1',
          appointment_id: undefined,
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
      setSelectedService('Check-up');
      setAmount(SERVICE_PRICES['Check-up']);
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
              {outstandingBalance === 0 ? '✓ Paid' : '⚠️ Pending'}
            </p>
            <p className="text-xs text-gray-500 mt-2">Status</p>
          </div>
        </div>
      )}

      {/* Payment Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">💰 Make Payment</h2>

        <div className="space-y-6">
          {/* Service Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Service
            </label>
            <select
              value={selectedService}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
            >
              {Object.entries(SERVICE_PRICES).map(([service, price]) => (
                <option key={service} value={service}>
                  {service} - ₱{price}
                </option>
              ))}
            </select>
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
                { value: 'insurance' as const, label: '🛡️ Insurance' },
              ].map((option) => (
                <button
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
          onClick={handlePayment}
          disabled={isProcessing}
          className="flex-1 p-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition text-lg"
        >
          {isProcessing ? '⏳ Processing...' : '✓ Pay Now'}
        </button>
        {onCancel && (
          <button
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
