'use client';

import dynamic from 'next/dynamic';

const BillingPayment = dynamic(
  () => import('@/components/billing/BillingPayment'),
  { loading: () => <div className="p-8 text-center">Loading...</div> }
);

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Payment & Billing</h1>
        <p className="text-gray-600 mb-8">Manage your dental bill and make payments</p>
        <BillingPayment />
      </div>
    </div>
  );
}
