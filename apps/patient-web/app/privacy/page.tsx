import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PrivacyContent } from '@/components/legal/LegalContent';

export const metadata: Metadata = { title: 'Privacy Policy | SmileGuard' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <PrivacyContent />
    </LegalPage>
  );
}
