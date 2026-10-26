import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Dimensions,
} from 'react-native';
import {
  X,
  CreditCard,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileText,
  ExternalLink,
  Sparkles,
  Landmark,
  BadgePercent,
  Check,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface PayMongoDoctorGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PayMongoDoctorGuideModal({
  visible,
  onClose,
}: PayMongoDoctorGuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'merchant-account',
      badge: 'Step 1 of 5 • Merchant Registration',
      title: 'Register Your Dental Clinic on PayMongo',
      subtitle: 'Create your official BSP-licensed Merchant Account.',
      icon: Building2,
      accentColor: '#10B981',
      pointers: [
        {
          tag: 'POINTER 1',
          label: 'Visit PayMongo Portal',
          detail: 'Sign up at dashboard.paymongo.com and select "Individual / Sole Proprietor" or "Corporation" matching your dental clinic.',
        },
        {
          tag: 'POINTER 2',
          label: 'Prepare Philippine Legal Documents',
          detail: 'Have the following requirements ready for instant merchant verification:\n• BIR Certificate of Registration (Form 2303 / COR)\n• DTI Business Certificate or SEC Registration\n• 1 Valid Government ID of Licensed Dentist / Owner\n• Bank Account Proof (Bank Statement or Passbook)',
        },
        {
          tag: 'POINTER 3',
          label: 'Bank Settlement Account',
          detail: 'Nominate your clinic’s Philippine bank account (BDO, BPI, Metrobank, UnionBank, etc.) for direct payout deposits.',
        },
      ],
      tip: 'PayMongo is legally licensed as an Operator of Payment Systems (OPS) by the Bangko Sentral ng Pilipinas (BSP), legally authorizing direct payouts to Philippine clinics.',
    },
    {
      id: 'channels',
      badge: 'Step 2 of 5 • Payment Channels',
      title: 'Activate Patient E-Wallets & Card Channels',
      subtitle: 'Turn on how Filipino patients pay for dental procedures.',
      icon: CreditCard,
      accentColor: '#059669',
      pointers: [
        {
          tag: 'POINTER 1',
          label: 'GCash & Maya Activation',
          detail: 'Inside your PayMongo Dashboard, enable GCash and Maya. Over 85% of dental patients prefer settling via e-wallets.',
        },
        {
          tag: 'POINTER 2',
          label: 'Visa & Mastercard Debit/Credit',
          detail: 'Toggle Card processing for major dental procedures (implants, braces, crowns) where patients use credit cards or installment options.',
        },
        {
          tag: 'POINTER 3',
          label: 'QR Ph & GrabPay',
          detail: 'Turn on standardized QR Ph interoperability so patients can scan from any Philippine mobile banking app.',
        },
      ],
      tip: 'Zero POS terminal hardware required. All payment channels are hosted online and work automatically with SmileGuard.',
    },
    {
      id: 'pricing-sync',
      badge: 'Step 3 of 5 • Clinic Catalog Sync',
      title: 'Sync Your Procedure Rates with PayMongo',
      subtitle: 'Your custom mobile rates feed patient web checkout automatically.',
      icon: BadgePercent,
      accentColor: '#0d9488',
      pointers: [
        {
          tag: 'POINTER 1',
          label: 'Configure Rates in SmileGuard',
          detail: 'Go to Settings → Clinic Setup → Services. Set standard fees for Oral Prophylaxis, Restorations, Extractions, and Orthodontics.',
        },
        {
          tag: 'POINTER 2',
          label: 'Server-Locked Checkout',
          detail: 'When a patient books or pays on the web, SmileGuard locks the exact fee from your clinic catalog. Patients cannot tamper with or manipulate prices.',
        },
        {
          tag: 'POINTER 3',
          label: 'Automatic Senior / PWD 20% Calculation',
          detail: 'Under Philippine RA 9994 and RA 10754, verified Senior Citizens and PWDs receive an automated 20% statutory deduction calculated server-side.',
        },
      ],
      tip: 'Whenever you adjust your treatment prices in the mobile app, patient web billing updates immediately.',
    },
    {
      id: 'realtime-flow',
      badge: 'Step 4 of 5 • Invoicing & Real-time Webhooks',
      title: 'Digital Invoicing & Real-Time Status',
      subtitle: 'Instant ledger reconciliation when patients complete payment.',
      icon: FileText,
      accentColor: '#0284c7',
      pointers: [
        {
          tag: 'POINTER 1',
          label: 'Automated Invoice Generation',
          detail: 'Once a patient visit is scheduled or finished, a digital invoice is issued to the patient’s portal.',
        },
        {
          tag: 'POINTER 2',
          label: 'Cryptographic HMAC Webhook',
          detail: 'When the patient settles via PayMongo, PayMongo fires an HMAC-SHA256 authenticated webhook directly to our cloud server.',
        },
        {
          tag: 'POINTER 3',
          label: 'Instant Status Switch: "PAID"',
          detail: 'Your Doctor Billing Ledger instantly flips the record from "Pending" to "Paid", logging the payment method and transaction ID with zero manual bookkeeping.',
        },
      ],
      tip: 'Check your Billing Ledger in the mobile app anytime to see real-time payment breakdown and filter by patient.',
    },
    {
      id: 'payouts-tax',
      badge: 'Step 5 of 5 • Bank Payouts & Taxes',
      title: 'Bank Settlements & BIR Tax Records',
      subtitle: 'Automated deposits to your clinic bank account.',
      icon: Landmark,
      accentColor: '#10B981',
      pointers: [
        {
          tag: 'POINTER 1',
          label: 'Automated Payout Schedule',
          detail: 'PayMongo automatically transfers your net collected dental revenues to your enrolled bank account (e.g. daily or weekly schedule).',
        },
        {
          tag: 'POINTER 2',
          label: 'Official BIR Form 2307 Withholding Certificates',
          detail: 'PayMongo issues downloadable Electronic Certificates of Creditable Tax Withheld at Source (Form 2307) for your clinic’s quarterly/annual tax filings.',
        },
        {
          tag: 'POINTER 3',
          label: 'Reconciliation Report',
          detail: 'Download full transaction CSV reports directly from the PayMongo dashboard or view your SmileGuard billing history anytime.',
        },
      ],
      tip: 'You are completely protected against chargeback and fraud thanks to PayMongo 3D-Secure (3DS) authentication.',
    },
  ];

  const activeStep = steps[currentStep];
  const StepIcon = activeStep.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const openPayMongoDashboard = () => {
    Linking.openURL('https://dashboard.paymongo.com/signup');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconContainer}>
                <CreditCard size={18} color="#10B981" />
              </View>
              <View>
                <Text style={styles.headerTitle}>PayMongo Onboarding Guide</Text>
                <Text style={styles.headerSubtitle}>
                  Clinic Payment & Payout Setup for Doctors
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${((currentStep + 1) / steps.length) * 100}%` },
              ]}
            />
          </View>

          {/* Step Content */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Step Badge */}
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{activeStep.badge}</Text>
            </View>

            {/* Step Hero Row */}
            <View style={styles.heroRow}>
              <View
                style={[
                  styles.heroIconBox,
                  { backgroundColor: activeStep.accentColor },
                ]}
              >
                <StepIcon size={24} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{activeStep.title}</Text>
                <Text style={styles.stepSubtitle}>{activeStep.subtitle}</Text>
              </View>
            </View>

            {/* Pointers List */}
            <View style={styles.pointersList}>
              {activeStep.pointers.map((item, index) => (
                <View key={index} style={styles.pointerCard}>
                  <View style={styles.pointerHeaderRow}>
                    <View style={styles.pointerTag}>
                      <Text style={styles.pointerTagText}>{item.tag}</Text>
                    </View>
                    <Text style={styles.pointerLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.pointerDetail}>{item.detail}</Text>
                </View>
              ))}
            </View>

            {/* Pro-Tip Box */}
            <View style={styles.tipBox}>
              <View style={styles.tipHeaderRow}>
                <ShieldCheck size={16} color="#047857" />
                <Text style={styles.tipTitle}>CLINIC GUIDELINE & COMPLIANCE</Text>
              </View>
              <Text style={styles.tipText}>{activeStep.tip}</Text>
            </View>

            {/* External Registration Link for Step 1 */}
            {currentStep === 0 && (
              <TouchableOpacity
                onPress={openPayMongoDashboard}
                style={styles.externalLinkBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.externalLinkBtnText}>
                  Open PayMongo Merchant Registration
                </Text>
                <ExternalLink size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer Controls */}
          <View style={styles.footer}>
            <View style={styles.dotsRow}>
              {steps.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setCurrentStep(idx)}
                  style={[
                    styles.dot,
                    idx === currentStep ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.footerBtns}>
              {currentStep > 0 && (
                <TouchableOpacity
                  onPress={handlePrev}
                  style={styles.prevBtn}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={15} color="#475569" />
                  <Text style={styles.prevBtnText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleNext}
                style={styles.nextBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.nextBtnText}>
                  {currentStep === steps.length - 1 ? 'Got It' : 'Next Step'}
                </Text>
                <ArrowRight size={15} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 44, 34, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: '#f1f5f9',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  body: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 24,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 14,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    lineHeight: 23,
  },
  stepSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
  pointersList: {
    gap: 10,
    marginBottom: 16,
  },
  pointerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  pointerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pointerTag: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  pointerTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  pointerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  pointerDetail: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  tipBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tipTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  tipText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
    fontWeight: '500',
  },
  externalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  externalLinkBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#10B981',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#e2e8f0',
  },
  footerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  prevBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  nextBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
