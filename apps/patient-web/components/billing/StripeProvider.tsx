'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { ReactNode } from 'react';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface StripeProviderProps {
  clientSecret: string;
  children: ReactNode;
}

export default function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'flat',
      variables: {
        colorPrimary: '#29ABE2',
        colorBackground: '#F8FAFC',
        colorText: '#1E293B',
        colorDanger: '#F05454',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '12px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: '2px solid #E2E8F0',
          boxShadow: 'none',
          padding: '12px 16px',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        },
        '.Input:focus': {
          border: '2px solid #29ABE2',
          boxShadow: '0 0 0 3px rgba(41, 171, 226, 0.15)',
        },
        '.Input--invalid': {
          border: '2px solid #F05454',
        },
        '.Label': {
          fontWeight: '600',
          fontSize: '14px',
          marginBottom: '8px',
        },
        '.Error': {
          fontSize: '13px',
          marginTop: '6px',
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
