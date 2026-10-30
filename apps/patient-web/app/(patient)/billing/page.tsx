'use client';

import BillingPayment from '@/components/billing/BillingPayment';

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-bg-screen w-full">
      <div className="max-w-5xl mx-auto w-full">
        <BillingPayment />
      </div>
    </div>
  );
}
