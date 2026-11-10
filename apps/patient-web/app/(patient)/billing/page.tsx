import { redirect } from 'next/navigation';

// Payments are handled by the clinic assistant; patients no longer have a billing page.
export default function BillingPage() {
  redirect('/dashboard');
}
