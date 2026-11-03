import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { TermsContent } from '@/components/legal/LegalContent';

export const metadata: Metadata = { title: 'Terms and Conditions | SmileGuard' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions">
      <TermsContent />
    </LegalPage>
  );
}
