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
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Payment & Billing</h2>

      {/* Current Balance Display */}
      {!loadingData && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Outstanding Balance</p>
              <p className="text-2xl font-bold text-blue-600">₱{outstandingBalance.toFixed(2)}</p>
            </div>
            {billingHistory.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Recent Transactions</p>
                <p className="text-lg font-semibold text-gray-800">{billingHistory.length}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Select Service
        </label>
        <select
          value={selectedService}
          onChange={(e) => handleServiceChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {Object.entries(SERVICE_PRICES).map(([service, price]) => (
            <option key={service} value={service}>
              {service} - ₱{price}
            </option>
          ))}
        </select>
      </div>

      {/* Discount Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Discount Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'none' as const, label: 'None' },
            { value: 'pwd' as const, label: 'PWD (10%)' },
            { value: 'senior' as const, label: 'Senior (15%)' },
            { value: 'insurance' as const, label: 'Insurance' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleDiscountSelect(option.value)}
              className={`p-3 rounded-lg border-2 transition ${
                discountType === option.value
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Proof Upload for Discounts */}
      {showProofUpload && discountType !== 'none' && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Upload Proof of ID
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
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Payment Method
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'cash' as const, label: 'Cash' },
            { value: 'card' as const, label: 'Card' },
            { value: 'bank-transfer' as const, label: 'Bank Transfer' },
            { value: 'gcash' as const, label: 'GCash' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setPaymentMethod(option.value)}
              className={`p-3 rounded-lg border-2 transition ${
                paymentMethod === option.value
                  ? 'border-green-600 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between mb-2">
          <span className="text-gray-700">Base Amount:</span>
          <span className="font-semibold">₱{amount.toFixed(2)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between mb-2 text-red-600">
            <span>Discount ({(discountType || 'none').toUpperCase()}):</span>
            <span className="font-semibold">-₱{discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between">
          <span className="font-bold text-gray-800">Final Amount:</span>
          <span className="text-2xl font-bold text-blue-600">₱{finalAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="flex-1 p-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400"
        >
          {isProcessing ? 'Processing...' : 'Pay Now'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 p-3 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
