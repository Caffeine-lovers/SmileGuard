import type { ReactNode } from 'react';

/**
 * Single source of truth for SmileGuard's Terms & Conditions and Privacy Policy.
 * Used by the /terms and /privacy pages and by the signup consent dialog.
 *
 * TODO before launch: have the clinic's counsel / Data Protection Officer review this text
 * and fill in LEGAL_CONTACT below.
 */
export const LEGAL_EFFECTIVE_DATE = 'November 3, 2026';
export const LEGAL_CONTACT = {
  dpoEmail: 'dpo@smileguard.example', // replace with the real Data Protection Officer email
  clinicName: 'SmileGuard partner clinic',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);

export function TermsContent() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">Effective {LEGAL_EFFECTIVE_DATE}</p>

      <Section title="1. About these terms">
        <p>
          These Terms and Conditions govern your use of SmileGuard, a patient portal for booking dental
          appointments, managing billing, storing your dental records, and using AI-assisted oral photo
          screening. By creating an account or using SmileGuard, you agree to these terms. If you do not
          agree, please do not use the service.
        </p>
      </Section>

      <Section title="2. Your account">
        <List
          items={[
            'You must give accurate, complete information when you sign up, including your medical history, and keep it up to date.',
            'You are responsible for keeping your password private and for all activity under your account. Tell the clinic right away if you think someone else has accessed it.',
            'If you are under 18, a parent or legal guardian must create and manage the account for you.',
            'We may suspend or close accounts that give false information, misuse the service, or break these terms.',
          ]}
        />
      </Section>

      <Section title="3. AI oral screening is not a diagnosis">
        <p>
          The AI Oral Analysis feature looks at photos you take and points out areas that may need attention.
          It is for <strong>information only</strong>. It does not diagnose any condition, it can miss problems or
          flag things that are not problems, and it does not replace an examination by a licensed dentist.
          Always consult your dentist before making any decision about your treatment. If you have severe pain,
          swelling, bleeding, or another emergency, seek care immediately instead of using the app.
        </p>
      </Section>

      <Section title="4. Appointments">
        <List
          items={[
            'A booking you make is a request. It is confirmed only when the clinic approves it.',
            'Appointment length and the fee shown when booking depend on the services you choose. The dentist may adjust the treatment, and the final fee, after examining you.',
            'Please cancel or reschedule through the app as early as possible if you cannot attend.',
            'The clinic may reschedule or cancel an appointment when necessary and will notify you through the app.',
          ]}
        />
      </Section>

      <Section title="5. Payments and discounts">
        <List
          items={[
            'Online payments are processed by PayMongo, a BSP-licensed payment provider. SmileGuard does not see or store your card or e-wallet details.',
            'A payment is marked paid only after PayMongo or the clinic confirms it.',
            'Senior Citizen (RA 9994) and PWD (RA 10754) discounts apply only after the clinic verifies a valid ID you submit. Submitting a false or someone else’s ID is prohibited and may be reported.',
            'Refunds, if any, follow the clinic’s refund policy and PayMongo’s processing rules.',
          ]}
        />
      </Section>

      <Section title="6. Acceptable use">
        <p>You agree not to:</p>
        <List
          items={[
            'upload content that is not yours, is unlawful, or shows anything other than your own mouth and teeth in the analysis feature;',
            'try to access other patients’ data or parts of the system you are not allowed to use;',
            'interfere with, overload, or reverse-engineer the service.',
          ]}
        />
      </Section>

      <Section title="7. Availability and liability">
        <p>
          We work to keep SmileGuard available and accurate, but the service is provided “as is” and may
          occasionally be unavailable or contain errors. To the extent allowed by Philippine law, SmileGuard is not
          liable for indirect losses or for decisions made based only on AI screening results. Nothing in these
          terms limits rights you have under the Consumer Act of the Philippines (RA 7394) or other laws.
        </p>
      </Section>

      <Section title="8. Changes and governing law">
        <p>
          We may update these terms. If the changes are significant, we will notify you in the app before they
          take effect. These terms are governed by the laws of the Republic of the Philippines.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Questions about these terms can be sent to <strong>{LEGAL_CONTACT.dpoEmail}</strong>.
        </p>
      </Section>
    </div>
  );
}

export function PrivacyContent() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">Effective {LEGAL_EFFECTIVE_DATE}</p>

      <Section title="1. Our commitment">
        <p>
          SmileGuard handles your personal and health information in line with the Data Privacy Act of 2012
          (RA 10173), its Implementing Rules, and issuances of the National Privacy Commission (NPC). This
          policy explains what we collect, why, who we share it with, and the rights you have.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <List
          items={[
            <><strong>Account details:</strong> name, email address, phone number, password (stored encrypted), and profile picture.</>,
            <><strong>Medical information (sensitive personal information):</strong> date of birth, allergies, medical conditions, medications, past surgeries, smoking and pregnancy status, and emergency contact.</>,
            <><strong>Dental records:</strong> appointments, treatments, documents and X-rays uploaded by you or the clinic.</>,
            <><strong>Oral photos and AI results:</strong> photos you take or upload for AI screening and the results produced.</>,
            <><strong>Billing information:</strong> invoices, amounts, payment status and PayMongo reference IDs. Card and e-wallet details are handled only by PayMongo.</>,
            <><strong>Discount verification:</strong> images of Senior Citizen or PWD IDs you submit.</>,
            <><strong>Technical data:</strong> device and browser type, and logs needed to keep the service secure.</>,
          ]}
        />
      </Section>

      <Section title="3. Why we use it">
        <List
          items={[
            'To create and manage your account and to book, confirm and remind you about appointments.',
            'To let your dentist review your history, records and photos so they can provide care.',
            'To run AI oral screening when you ask for it and to keep your scan history.',
            'To process payments and apply statutory discounts after verifying your ID.',
            'To send you notifications you have turned on, and to keep the service secure and working.',
            'To meet legal obligations, such as keeping medical and financial records.',
          ]}
        />
        <p>
          We process sensitive personal information based on your consent, for medical treatment, and as required
          by law. We do not sell your personal information or use it for advertising.
        </p>
      </Section>

      <Section title="4. Who we share it with">
        <List
          items={[
            'The dentist and authorized staff of the clinic you book with.',
            'Service providers that run SmileGuard for us, under agreements that require them to protect your data: Supabase (database, login and file storage), PayMongo (payments), and our AI processing provider (oral photo screening), plus Vercel (website hosting).',
            'Government authorities, only when the law requires it.',
          ]}
        />
        <p>
          Some of these providers may store data on servers outside the Philippines. We require them to protect it
          to a standard comparable to the Data Privacy Act.
        </p>
      </Section>

      <Section title="5. How we protect it">
        <p>
          Data is encrypted in transit, access is limited by role so that patients see only their own records and
          clinic staff see only what they need, and ID images and documents are kept in private storage. No
          system is perfectly secure; if a breach affecting you occurs, we will notify you and the NPC as the law
          requires.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <p>
          We keep your records while your account is active and afterwards for as long as required for medical,
          tax and legal purposes. Oral photos and scan results can be deleted by you at any time from your scan
          history. When information is no longer needed, we delete or anonymize it securely.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>Under the Data Privacy Act, you have the right to:</p>
        <List
          items={[
            'be informed about how your data is processed;',
            'access your data and get a copy of it;',
            'correct inaccurate or outdated data;',
            'object to processing, or withdraw consent, where processing is based on consent;',
            'have your data erased or blocked, subject to legal record-keeping requirements;',
            'data portability; and',
            'file a complaint with the National Privacy Commission (privacy.gov.ph).',
          ]}
        />
        <p>
          You can update most details yourself on your Profile page. For other requests, contact our Data
          Protection Officer below.
        </p>
      </Section>

      <Section title="8. Contact our Data Protection Officer">
        <p>
          Email <strong>{LEGAL_CONTACT.dpoEmail}</strong>. We will respond within the period required by the NPC.
        </p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>
          If we make significant changes, we will notify you in the app before they take effect. The effective date
          at the top shows when this policy was last updated.
        </p>
      </Section>
    </div>
  );
}
