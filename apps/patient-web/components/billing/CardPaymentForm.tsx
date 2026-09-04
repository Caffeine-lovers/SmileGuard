'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { CreditCard, AlertCircle, Lock, ShieldCheck } from 'lucide-react';

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
      onSuccess();
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Accepted Card Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Accepted:</span>
        <div className="flex items-center gap-1.5">
          {/* Mastercard */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-xs border border-slate-300 shadow-xs">
            <svg width="20" height="14" viewBox="0 0 24 16" fill="none">
              <circle cx="9" cy="8" r="7" fill="#EB001B" opacity="0.9" />
              <circle cx="15" cy="8" r="7" fill="#F79E1B" opacity="0.9" />
              <path d="M12 2.36a6.98 6.98 0 0 1 2.6 5.44A6.98 6.98 0 0 1 12 13.24a6.98 6.98 0 0 1-2.6-5.44A6.98 6.98 0 0 1 12 2.36z" fill="#FF5F00" />
            </svg>
            <span className="text-[11px] font-bold text-slate-700">Mastercard</span>
          </div>
          {/* Visa */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-xs border border-slate-300 shadow-xs">
            <svg width="20" height="14" viewBox="0 0 24 16" fill="none">
              <rect width="24" height="16" rx="1" fill="#1A1F71" />
              <text x="12" y="11" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontStyle="italic">VISA</text>
            </svg>
            <span className="text-[11px] font-bold text-slate-700">Visa</span>
          </div>
          {/* Debit */}
          <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-xs border border-slate-300 shadow-xs">
            <CreditCard className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[11px] font-bold text-slate-700">Debit / ATM</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* PaymentElement container */}
        <div className="skeuo-panel p-5 border-2 border-slate-300">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border-2 border-red-400 rounded-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <p className="text-xs font-bold">{errorMessage}</p>
          </div>
        )}

        {/* Amount Summary */}
        <div className="flex items-center justify-between p-4 bg-emerald-50/80 rounded-sm border-2 border-emerald-500">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block">Total Due for Billing:</span>
            <span className="text-[11px] text-emerald-700 font-semibold">Immediate confirmation upon settlement</span>
          </div>
          <span className="text-2xl font-black text-emerald-800">₱{amount.toFixed(2)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isProcessing || !stripe || !elements}
            className="skeuo-btn-primary flex-1 py-3 text-sm uppercase tracking-wider disabled:opacity-50"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Processing Card...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Pay ₱{amount.toFixed(2)}</span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="skeuo-btn-secondary px-6 py-3 text-xs uppercase tracking-wider"
          >
            Cancel
          </button>
        </div>

        {/* Security Badge */}
        <p className="text-center text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5 uppercase tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Secured by Stripe SSL. Your card details are end-to-end encrypted.
        </p>
      </form>
    </div>
  );
}
