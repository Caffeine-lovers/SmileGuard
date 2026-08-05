'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

interface CardPaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

export default function CardPaymentForm({
  amount,
  onSuccess,
  onError,
  onCancel,
}: CardPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing`,
      },
      redirect: 'if_required',
    });

    if (error) {
      const msg = error.message || 'Payment failed. Please try again.';
      setErrorMessage(msg);
      onError(msg);
      setIsProcessing(false);
    } else {
      // Payment succeeded (no redirect needed)
      onSuccess();
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card Brand Icons */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-semibold text-text-secondary">Accepted:</span>
        <div className="flex items-center gap-2">
          {/* Mastercard */}
          <div className="flex items-center gap-1 px-2 py-1 bg-bg-notes rounded-md border border-border-card">
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
              <circle cx="9" cy="8" r="7" fill="#EB001B" opacity="0.9" />
              <circle cx="15" cy="8" r="7" fill="#F79E1B" opacity="0.9" />
              <path d="M12 2.36a6.98 6.98 0 0 1 2.6 5.44A6.98 6.98 0 0 1 12 13.24a6.98 6.98 0 0 1-2.6-5.44A6.98 6.98 0 0 1 12 2.36z" fill="#FF5F00" />
            </svg>
            <span className="text-xs font-medium text-text-primary">Mastercard</span>
          </div>
          {/* Visa */}
          <div className="flex items-center gap-1 px-2 py-1 bg-bg-notes rounded-md border border-border-card">
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
              <rect width="24" height="16" rx="2" fill="#1A1F71" />
              <text x="12" y="11" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontStyle="italic">VISA</text>
            </svg>
            <span className="text-xs font-medium text-text-primary">Visa</span>
          </div>
          {/* Debit */}
          <div className="flex items-center gap-1 px-2 py-1 bg-bg-notes rounded-md border border-border-card">
            <span className="text-xs font-medium text-text-secondary">💳 Debit</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Stripe PaymentElement handles card number, expiry, CVC */}
        <div className="bg-bg-surface rounded-xl p-5 border border-border-card">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-4 bg-brand-danger/10 border border-brand-danger/30 rounded-lg">
            <span className="text-brand-danger font-bold">⚠</span>
            <p className="text-sm font-medium text-brand-danger">{errorMessage}</p>
          </div>
        )}

        {/* Amount Display */}
        <div className="flex items-center justify-between p-4 bg-brand-primary/5 rounded-xl border border-brand-primary/20">
          <span className="font-semibold text-text-primary">Amount to charge:</span>
          <span className="text-2xl font-bold text-brand-primary">₱{amount.toFixed(2)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isProcessing || !stripe || !elements}
            className="flex-1 p-4 bg-brand-primary text-white font-bold rounded-full hover:bg-brand-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 text-lg flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              <>🔒 Pay ₱{amount.toFixed(2)}</>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-4 bg-bg-notes text-text-primary font-semibold rounded-full hover:bg-border-card/50 disabled:opacity-50 transition-all duration-200"
          >
            Cancel
          </button>
        </div>

        {/* Security Badge */}
        <p className="text-center text-xs text-text-secondary flex items-center justify-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Secured by Stripe. Your card details never touch our servers.
        </p>
      </form>
    </div>
  );
}
