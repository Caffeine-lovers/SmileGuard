import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from "react-native";
import {
  ShieldCheck,
  KeyRound,
  Stethoscope,
  Users,
  LifeBuoy,
  ListChecks,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Building2,
  Lock,
} from "lucide-react-native";

export type AdminTab = "codes" | "dentists" | "patients" | "support" | "attempts";

interface AdminTourModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTab?: (tab: AdminTab) => void;
}

interface TourStep {
  tab?: AdminTab;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  accentColor: string;
  features: {
    icon: any;
    title: string;
    desc: string;
  }[];
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: "Step 1 of 6 • Overview",
    title: "Welcome to Admin Console",
    subtitle: "Clinic Command & Governance Center",
    description:
      "As an Administrator, you have full oversight of SmileGuard's clinical operations, user security, staff access codes, and system audit logs.",
    icon: ShieldCheck,
    accentColor: "#047857",
    features: [
      {
        icon: Building2,
        title: "Multi-Role Governance",
        desc: "Oversee dentists, clinic assistants, and registered web patients in one centralized console.",
      },
      {
        icon: Lock,
        title: "Strict Role-Based Security",
        desc: "Grant or revoke staff privileges instantly to safeguard sensitive patient records.",
      },
      {
        icon: Sparkles,
        title: "Real-Time Sync",
        desc: "All administrative changes update live across the doctor mobile app and patient web portal.",
      },
    ],
  },
  {
    tab: "codes",
    badge: "Step 2 of 6 • Access Codes",
    title: "Clinic Access Codes",
    subtitle: "Staff Registration & Security Codes",
    description:
      "Generate and manage clinic codes required for staff onboarding. Set whether codes grant Doctor or Assistant access, and toggle active status at any time.",
    icon: KeyRound,
    accentColor: "#059669",
    features: [
      {
        icon: KeyRound,
        title: "Standard Codes",
        desc: "SMILE-DOC-2026 for Dentists, SMILEGUARD-STAFF for Front Desk & Assistants.",
      },
      {
        icon: CheckCircle2,
        title: "Active / Inactive Toggle",
        desc: "Immediately deactivate codes when an employee departs without breaking existing data.",
      },
      {
        icon: Sparkles,
        title: "Custom Code Generator",
        desc: "Create bespoke temporary or contractor access codes with descriptive clinic labels.",
      },
    ],
  },
  {
    tab: "dentists",
    badge: "Step 3 of 6 • Clinicians",
    title: "Dentist & Staff Roster",
    subtitle: "Medical License & Credential Verification",
    description:
      "Review all registered dentists and clinic assistants. Verify professional licenses, check specialties, and manage practitioner credentials.",
    icon: Stethoscope,
    accentColor: "#0D9488",
    features: [
      {
        icon: CheckCircle2,
        title: "License Verification",
        desc: "Toggle verification badges for accredited dentists upon PRC license validation.",
      },
      {
        icon: Stethoscope,
        title: "Specialties & Roles",
        desc: "Inspect Orthodontics, Oral Surgery, and General Dentistry credentials.",
      },
      {
        icon: Lock,
        title: "Staff Management",
        desc: "Safely remove or suspend accounts directly from your phone if necessary.",
      },
    ],
  },
  {
    tab: "patients",
    badge: "Step 4 of 6 • Patients",
    title: "Patient Accounts",
    subtitle: "Profiles & Discount Verification",
    description:
      "Browse registered patient accounts. Check Senior Citizen and PWD discount credentials so appointment billings comply with statutory clinic regulations.",
    icon: Users,
    accentColor: "#2563EB",
    features: [
      {
        icon: Users,
        title: "Registered Directory",
        desc: "Search patients by name, email address, or registration timestamp.",
      },
      {
        icon: ShieldCheck,
        title: "Senior Citizen & PWD IDs",
        desc: "Review submitted government IDs to authorize discounted treatment billing.",
      },
      {
        icon: Building2,
        title: "Account Status",
        desc: "Monitor active patient engagement and clinic visit records.",
      },
    ],
  },
  {
    tab: "support",
    badge: "Step 5 of 6 • Helpdesk",
    title: "Support & Inquiries",
    subtitle: "Patient & Clinician Helpdesk Tickets",
    description:
      "Stay on top of patient support tickets, scheduling inquiries, and account assistance requests submitted via the mobile app or web portal.",
    icon: LifeBuoy,
    accentColor: "#D97706",
    features: [
      {
        icon: LifeBuoy,
        title: "Live Ticket Queue",
        desc: "Filter tickets by Open, In Progress, and Resolved status.",
      },
      {
        icon: CheckCircle2,
        title: "Fast Resolutions",
        desc: "Tap to update ticket statuses and keep response times swift.",
      },
      {
        icon: Sparkles,
        title: "Priority Tagging",
        desc: "Flag urgent patient inquiries requiring immediate clinical intervention.",
      },
    ],
  },
  {
    tab: "attempts",
    badge: "Step 6 of 6 • Security Log",
    title: "Audit Trail & Attempt Log",
    subtitle: "Real-Time Security Intelligence",
    description:
      "Inspect every access code entered on the mobile login screen. The attempt log records valid entries as well as blocked or brute-force attempts with precise timestamps.",
    icon: ListChecks,
    accentColor: "#DC2626",
    features: [
      {
        icon: ListChecks,
        title: "Audit History",
        desc: "Complete chronological timeline of clinic sign-in attempts.",
      },
      {
        icon: ShieldCheck,
        title: "Success vs Blocked",
        desc: "Instantly pinpoint invalid code attempts and prevent unauthorized clinic access.",
      },
      {
        icon: Lock,
        title: "Zero-Trust Enforcement",
        desc: "Safeguard patient confidentiality with verified clinic credentials.",
      },
    ],
  },
];

export default function AdminTourModal({
  visible,
  onClose,
  onSelectTab,
}: AdminTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const goToStep = (index: number) => {
    if (index < 0 || index >= TOUR_STEPS.length) return;
    setCurrentStep(index);
    const targetTab = TOUR_STEPS[index].tab;
    if (targetTab && onSelectTab) {
      onSelectTab(targetTab);
    }
  };

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    goToStep(currentStep - 1);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.card}>
            {/* Top Bar with Step Indicators & Close Button */}
            <View style={styles.headerRow}>
              <View style={styles.stepBadge}>
                <Sparkles size={13} color={step.accentColor} />
                <Text style={[styles.stepBadgeText, { color: step.accentColor }]}>
                  {step.badge}
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Close tour"
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Progress Dots */}
            <View style={styles.dotsRow}>
              {TOUR_STEPS.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => goToStep(idx)}
                  style={[
                    styles.dot,
                    idx === currentStep && [styles.dotActive, { backgroundColor: step.accentColor }],
                  ]}
                />
              ))}
            </View>

            {/* Step Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${step.accentColor}18` }]}>
                <StepIcon size={34} color={step.accentColor} />
              </View>

              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.subtitle}>{step.subtitle}</Text>
              <Text style={styles.description}>{step.description}</Text>

              {/* Features List */}
              <View style={styles.featuresContainer}>
                {step.features.map((feat, fIdx) => {
                  const FeatIcon = feat.icon;
                  return (
                    <View key={fIdx} style={styles.featureItem}>
                      <View style={[styles.featureIconBadge, { backgroundColor: `${step.accentColor}14` }]}>
                        <FeatIcon size={16} color={step.accentColor} />
                      </View>
                      <View style={styles.featureTextWrapper}>
                        <Text style={styles.featureTitle}>{feat.title}</Text>
                        <Text style={styles.featureDesc}>{feat.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Bottom Navigation Controls */}
            <View style={styles.footerRow}>
              {!isFirst ? (
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={handlePrev}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={18} color="#475569" />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipBtnText}>Skip Tour</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: step.accentColor }]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>
                  {isLast ? "Finish & Start Managing" : "Next"}
                </Text>
                {!isLast && <ChevronRight size={18} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    display: "flex",
    maxHeight: "100%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
  },
  scrollBody: {
    alignItems: "center",
    paddingBottom: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#334155",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  featuresContainer: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  featureIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 10,
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    gap: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 6,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

