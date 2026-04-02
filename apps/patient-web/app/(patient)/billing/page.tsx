'use client';

import dynamic from 'next/dynamic';

const BillingPayment = dynamic(
  () => import('@/components/billing/BillingPayment'),
  { loading: () => <div className="p-8 text-center">Loading...</div> }
);

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-bg-screen">
      <div className="px-4 py-8">
        <div className="max-w-7xl mx-auto mb-8">
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 px-2">
          {/* Empty space on left for balance */}
          <div className="lg:col-span-1" />

          {/* Billing Payment (Center) - Main Form */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 shadow-lg rounded-card overflow-hidden transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(41,171,226,0.4)]">
              <BillingPayment />
            </div>
          </div>

          {/* Empty space on right for balance */}
          <div className="lg:col-span-1" />
        </div>
      </div>
    </div>
  );
}
