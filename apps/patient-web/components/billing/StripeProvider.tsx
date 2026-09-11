'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { ReactNode } from 'react';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface StripeProviderProps {
  clientSecret: string;
  children: ReactNode;
}

export default function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  if (!stripePromise) {
    return (
      <div className="p-6 bg-amber-50 border-2 border-amber-500 rounded-sm text-slate-800">
        <p className="font-bold text-base mb-1">Stripe Gateway Not Configured</p>
        <p className="text-sm text-slate-600">
          The Stripe publishable key is not currently set in the environment. Please choose another payment method (Cash, GCash, or Bank Transfer).
        </p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'flat',
      variables: {
        colorPrimary: '#10B981',
        colorBackground: '#FFFFFF',
        colorText: '#0F172A',
        colorDanger: '#EF4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '4px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: '2px solid #CBD5E1',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
          padding: '12px 16px',
          borderRadius: '4px',
          transition: 'border-color 0.15s ease',
        },
        '.Input:focus': {
          border: '2px solid #10B981',
          boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
        },
        '.Input--invalid': {
          border: '2px solid #EF4444',
        },
        '.Label': {
          fontWeight: '700',
          fontSize: '13px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '6px',
          color: '#334155',
        },
        '.Error': {
          fontSize: '13px',
          marginTop: '6px',
          color: '#DC2626',
        },
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
