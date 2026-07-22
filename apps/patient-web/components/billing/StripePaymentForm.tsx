'use client';

import { useState } from 'react';
import { createStripePaymentIntent, confirmStripePayment } from '@/lib/paymentService';

interface StripePaymentFormProps {
  patientId: string;
  appointmentId?: string;
  amount: number;
  finalAmount: number;
  discountType?: 'none' | 'pwd' | 'senior';
  discountAmount?: number;
  onSuccess: (details: { paymentIntentId: string; amountPaid: number }) => void;
  onCancel?: () => void;
}

export default function StripePaymentForm({
  patientId,
  appointmentId,
  amount,
  finalAmount,
  discountType = 'none',
  discountAmount = 0,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0; i < match.length; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  const handleStripePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!cardHolder.trim()) {
      setErrorMsg('Please enter the cardholder name.');
      return;
    }
    if (cardNumber.replace(/\s/g, '').length < 16) {
      setErrorMsg('Please enter a valid 16-digit card number.');
      return;
    }
    if (expiry.length < 5) {
      setErrorMsg('Please enter a valid expiry date (MM/YY).');
      return;
    }
    if (cvc.length < 3) {
      setErrorMsg('Please enter a valid 3-digit CVC.');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create Stripe PaymentIntent via API Route
      const intentRes = await createStripePaymentIntent({
        patientId,
        appointmentId,
        amount,
        finalAmount,
        discountType,
        discountAmount,
        currency: 'php',
      });

      if (!intentRes.success || !intentRes.paymentIntentId || !intentRes.billingId) {
        throw new Error(intentRes.message || 'Payment authorization failed');
      }

      // Step 2: Simulate Stripe Card Processing & Confirmation
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Step 3: Confirm payment record status
      const confirmRes = await confirmStripePayment(
        intentRes.billingId,
        intentRes.paymentIntentId
      );

      if (!confirmRes.success) {
        throw new Error(confirmRes.message || 'Failed to update payment status');
      }

      onSuccess({
        paymentIntentId: intentRes.paymentIntentId,
        amountPaid: finalAmount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during payment processing';
      setErrorMsg(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const isConfigured = stripeKey && !stripeKey.includes('your_stripe_publishable_key');

  return (
    <div className="bg-bg-notes rounded-lg p-6 border border-brand-primary/20 shadow-sm mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💳</span>
          <h3 className="font-bold text-text-primary">Stripe Secure Card Checkout</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-full font-semibold">
          <span>🔒 256-bit SSL</span>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
          <span className="text-amber-500">ℹ️</span>
          <div>
            <strong>Stripe Sandbox Mode Active:</strong> Stripe publishable key is not configured.
            Transactions will process in simulated development mode.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          ❌ {errorMsg}
        </div>
      )}

      <form onSubmit={handleStripePay} className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Cardholder Name
          </label>
          <input
            type="text"
            placeholder="Jane Doe"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            className="w-full p-2.5 rounded-md border border-border-card bg-bg-surface text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Card Number
          </label>
          <input
            type="text"
            maxLength={19}
            placeholder="4242 •••• •••• 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            className="w-full p-2.5 rounded-md border border-border-card bg-bg-surface text-text-primary font-mono focus:ring-2 focus:ring-brand-primary focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Expires (MM/YY)
            </label>
            <input
              type="text"
              maxLength={5}
              placeholder="12/28"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              className="w-full p-2.5 rounded-md border border-border-card bg-bg-surface text-text-primary font-mono focus:ring-2 focus:ring-brand-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Security Code (CVC)
            </label>
            <input
              type="password"
              maxLength={4}
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full p-2.5 rounded-md border border-border-card bg-bg-surface text-text-primary font-mono focus:ring-2 focus:ring-brand-primary focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="submit"
            disabled={isProcessing}
            className="flex-1 py-3 px-4 bg-brand-primary text-white font-bold rounded-pill hover:bg-brand-primary/90 disabled:opacity-50 transition shadow-md"
          >
            {isProcessing ? '⏳ Authorizing Payment...' : `Pay ₱${finalAmount.toFixed(2)} with Stripe`}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-4 border border-border-card text-text-primary font-semibold rounded-pill hover:bg-bg-notes transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
