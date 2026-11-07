import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ShieldCheck,
  FileText,
  Lock,
  Scale,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react-native';

export type LegalDocType = 'privacy' | 'terms';

interface LegalDocumentModalProps {
  visible: boolean;
  docType: LegalDocType | null;
  onClose: () => void;
}

export default function LegalDocumentModal({
  visible,
  docType,
  onClose,
}: LegalDocumentModalProps) {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0);

  if (!docType) return null;

  const isPrivacy = docType === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';
  const subtitle = isPrivacy
    ? 'Republic Act No. 10173 • Data Privacy Act of 2012'
    : 'Clinical Platform Service Agreement & Guidelines';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.safeArea,
          { paddingTop: Platform.OS === 'android' ? statusBarHeight : 0 },
        ]}
        edges={['bottom', 'left', 'right']}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />

        {/* Modal Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Close"
          >
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>COMPLIANCE</Text>
          </View>
        </View>

        {/* Content Body */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Metadata Banner */}
          <View style={styles.metaBanner}>
            <View style={styles.metaIconBox}>
              {isPrivacy ? (
                <ShieldCheck size={20} color="#047857" />
              ) : (
                <Scale size={20} color="#047857" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaTitle}>
                {isPrivacy ? 'Philippine Healthcare Privacy Standard' : 'Official Clinic Service Agreement'}
              </Text>
              <Text style={styles.metaSubtitle}>
                Effective Date: November 2026 • Republic of the Philippines
              </Text>
            </View>
          </View>

          {isPrivacy ? <PrivacyPolicyContent /> : <TermsConditionsContent />}

          {/* Bottom Acknowledge Button */}
          <TouchableOpacity
            style={styles.closeActionBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.closeActionBtnText}>I Understand & Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionIconBox}>
          <Icon size={16} color="#047857" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function PrivacyPolicyContent() {
  return (
    <View style={styles.contentContainer}>
      <SectionCard icon={ShieldCheck} title="1. Our Privacy Commitment">
        <Text style={styles.paragraph}>
          SmileGuard values and respects the privacy of all patients, licensed dental practitioners, and clinic personnel.
          All personal health information (PHI) and identification credentials collected through this clinic portal are processed in accordance with the <Text style={styles.boldText}>Data Privacy Act of 2012 (Republic Act No. 10173)</Text>, its Implementing Rules and Regulations, and National Privacy Commission (NPC) circulars.
        </Text>
      </SectionCard>

      <SectionCard icon={Lock} title="2. Information Collected & Processed">
        <Text style={styles.paragraph}>
          In managing clinic schedules, patient encounters, and ledger transactions, the portal processes:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Clinical Account Info:</Text> Dentist and assistant names, contact emails, phone numbers, and professional PRC license credentials.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Patient Protected Health Info (PHI):</Text> Patient profiles, full names, medical histories, recorded allergies, systemic diseases, dental charts, treatment notes, and uploaded radiographs.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Billing & Payment Telemetry:</Text> Itemized procedure charges, clinic invoice records, payment verification timestamps, and PayMongo transaction reference IDs.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Statutory Discount Validations:</Text> Verified Senior Citizen (RA 9994) and PWD (RA 10754) credentials submitted by patients for statutory deductions.
          </Text>
        </View>
      </SectionCard>

      <SectionCard icon={FileText} title="3. Clinical Purpose of Processing">
        <Text style={styles.paragraph}>
          Data collected through the platform is processed exclusively for legitimate dental healthcare and clinic administration operations:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Coordinating appointment bookings, schedule blockouts, and chair reservations.</Text>
          <Text style={styles.bulletItem}>• Enabling dentists to inspect previous treatment histories and digital dental charts before procedures.</Text>
          <Text style={styles.bulletItem}>• Facilitating cashless settlements via Bangko Sentral ng Pilipinas (BSP) regulated gateway partners.</Text>
          <Text style={styles.bulletItem}>• Dispatching automated patient SMS and push notifications for reminders and reschedule notices.</Text>
        </View>
      </SectionCard>

      <SectionCard icon={Building2} title="4. Access Control & Confidentiality">
        <Text style={styles.paragraph}>
          Access to patient records is strictly guarded via role-based access controls (RBAC) and Row-Level Security (RLS). Licensed dentists and authorized assistants have access only to patients and records registered with their clinic. Patient health data is never sold, leased, or disclosed to third-party commercial marketing entities.
        </Text>
      </SectionCard>

      <SectionCard icon={AlertCircle} title="5. Data Retention & Subject Rights">
        <Text style={styles.paragraph}>
          Patient medical records are preserved in accordance with Philippine Department of Health (DOH) clinical record-keeping directives. Under RA 10173, data subjects hold the right to be informed, right of access, right of rectification, right of erasure/blocking, and right to file complaints with the National Privacy Commission (<Text style={styles.linkText}>privacy.gov.ph</Text>).
        </Text>
      </SectionCard>
    </View>
  );
}

function TermsConditionsContent() {
  return (
    <View style={styles.contentContainer}>
      <SectionCard icon={Scale} title="1. Clinical Platform Agreement">
        <Text style={styles.paragraph}>
          By registering an account and signing into the SmileGuard Clinic Portal, dental practitioners, clinic owners, and authorized assistants agree to be bound by these Terms and Conditions. If you do not agree with any provision of this agreement, you must refrain from using the platform.
        </Text>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="2. Professional Dental Responsibility">
        <Text style={styles.paragraph}>
          SmileGuard is a digital clinical administration and scheduling tool. The platform:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Does not practice dentistry:</Text> The licensed dentist retains sole, independent clinical responsibility for all medical diagnoses, treatment plans, surgical procedures, and prescription orders.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Assistant Delegation:</Text> Clinic assistants operating the portal act under the direct supervision and authorization of the designated supervising dentist.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.boldText}>Accurate Records:</Text> Clinic practitioners are responsible for ensuring all entered treatment codes, notes, and pricing are accurate and compliant with the Philippine Dental Act of 2007 (RA 9484).
          </Text>
        </View>
      </SectionCard>

      <SectionCard icon={Building2} title="3. Appointments & Schedule Compliance">
        <Text style={styles.paragraph}>
          Operating schedules, dental chair capacities, and blockout slots configured in Clinic Setup determine online appointment availability. The clinic agrees to:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Review and promptly confirm or reschedule pending patient booking requests.</Text>
          <Text style={styles.bulletItem}>• Provide reasonable advance notification through the portal when canceling or rescheduling an appointment due to clinical emergencies.</Text>
          <Text style={styles.bulletItem}>• Maintain up-to-date vacation, holiday, and consultation hour blockouts to avoid patient scheduling conflicts.</Text>
        </View>
      </SectionCard>

      <SectionCard icon={Lock} title="4. Account Integrity & Security Safeguards">
        <Text style={styles.paragraph}>
          Every clinic user is responsible for preserving the confidentiality of their login credentials. Passwords must not be shared. Any suspected unauthorized account access, device loss, or credential compromise must be reported immediately to clinic administration and technical support.
        </Text>
      </SectionCard>

      <SectionCard icon={FileText} title="5. Payments & Philippine Financial Rules">
        <Text style={styles.paragraph}>
          Digital invoice settlement is facilitated via PayMongo, an authorized Operator of Payment Systems (OPS) regulated by the Bangko Sentral ng Pilipinas (BSP). Clinics must:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Provide valid BIR Certificate of Registration (Form 2303) and DTI/SEC business certificates for merchant verification.</Text>
          <Text style={styles.bulletItem}>• Comply with Republic Act No. 9994 (Senior Citizens Act) and Republic Act No. 10754 (PWD Act) by honoring mandatory statutory discounts upon presentation of valid government IDs.</Text>
          <Text style={styles.bulletItem}>• Maintain accurate bank settlement accounts for direct proceeds disbursement.</Text>
        </View>
      </SectionCard>

      <SectionCard icon={AlertCircle} title="6. Governing Law & Dispute Resolution">
        <Text style={styles.paragraph}>
          These Terms and Conditions are governed by and construed in accordance with the laws of the Republic of the Philippines. Any legal action or proceeding arising out of or related to these terms shall be instituted exclusively in the proper courts of the Philippines.
        </Text>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badgePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  metaIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  metaSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  contentContainer: {
    gap: 12,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  sectionBody: {
    gap: 8,
  },
  paragraph: {
    fontSize: 12.5,
    lineHeight: 19,
    color: '#334155',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  linkText: {
    color: '#047857',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  bulletList: {
    gap: 6,
    marginTop: 4,
    paddingLeft: 4,
  },
  bulletItem: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  closeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#059669',
    borderLeftColor: '#047857',
    borderRightColor: '#064E3B',
    borderBottomColor: '#022C22',
    borderBottomWidth: 3,
    marginTop: 8,
  },
  closeActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

