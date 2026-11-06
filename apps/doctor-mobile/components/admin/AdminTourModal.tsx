import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@smileguard/supabase-client";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
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
  BookOpen,
  Compass,
} from "lucide-react-native";

export type AdminTab = "codes" | "dentists" | "patients" | "support" | "attempts";

type TourMode = "choose" | "walkthrough" | "tour";

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

// Width must match the left nav rail in app/(admin)/dashboard.tsx so the
// interactive tour's dim panel never covers the live nav icons behind it.
const NAV_RAIL_WIDTH = 76;

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
  const [mode, setMode] = useState<TourMode>("choose");
  const [showNavHint, setShowNavHint] = useState(false);
  const navHintKeyRef = useRef<string | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  // Only the live tour mode moves the real dashboard tab — and only once a
  // tab-specific step is showing, so the welcome screen never needs to dim it.
  const isLiveSheet = mode === "tour" && Boolean(step.tab);

  // One-time nudge pointing at the nav rail, shown the first time the admin
  // reaches a live tour step where the rail is actually visible and updating.
  useEffect(() => {
    if (!visible || !isLiveSheet || currentStep !== 1) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const key = userId ? `@has_seen_admin_nav_hint_${userId}` : "@has_seen_admin_nav_hint_default";
        navHintKeyRef.current = key;
        const seen = await AsyncStorage.getItem(key);
        if (!seen && !cancelled) {
          setShowNavHint(true);
          timer = setTimeout(() => dismissNavHint(), 4000);
        }
      } catch (err) {
        console.warn("[AdminTourModal] Error checking nav hint status:", err);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [visible, isLiveSheet, currentStep]);

  const dismissNavHint = async () => {
    setShowNavHint(false);
    const key = navHintKeyRef.current;
    if (!key) return;
    try {
      await AsyncStorage.setItem(key, "true");
    } catch (err) {
      console.warn("[AdminTourModal] Error persisting nav hint seen:", err);
    }
  };

  if (!visible) return null;

  const StepIcon = step.icon;

  const resetTour = () => {
    setCurrentStep(0);
    setMode("choose");
  };

  const handleClose = () => {
    resetTour();
    onClose();
  };

  const goToStep = (index: number) => {
    if (index < 0 || index >= TOUR_STEPS.length) return;
    setCurrentStep(index);
    // Jumping via the dot indicators before a mode is picked defaults to a
    // plain walkthrough — it should never silently move the admin's real tab.
    if (mode === "choose") {
      if (index > 0) setMode("walkthrough");
      return;
    }
    if (mode === "tour") {
      const targetTab = TOUR_STEPS[index].tab;
      if (targetTab && onSelectTab) onSelectTab(targetTab);
    }
  };

  const startWalkthrough = () => {
    setMode("walkthrough");
    setCurrentStep(1);
  };

  const startTour = () => {
    setMode("tour");
    setCurrentStep(1);
    const targetTab = TOUR_STEPS[1].tab;
    if (targetTab && onSelectTab) onSelectTab(targetTab);
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    goToStep(currentStep - 1);
  };

  const renderDots = () => (
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
  );

  const renderFooter = () => {
    if (isFirst) {
      // Entry point: let the admin pick a reading-only walkthrough or a live
      // tour that actually drives the dashboard behind this modal.
      return (
        <View style={styles.choiceColumn}>
          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnPrimary]}
            onPress={startTour}
            activeOpacity={0.85}
          >
            <Compass size={18} color="#FFFFFF" />
            <View style={styles.choiceTextWrap}>
              <Text style={styles.choiceTitlePrimary}>Take the Interactive Tour</Text>
              <Text style={styles.choiceSubPrimary}>Watch each section light up live as you go</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnSecondary]}
            onPress={startWalkthrough}
            activeOpacity={0.8}
          >
            <BookOpen size={18} color="#334155" />
            <View style={styles.choiceTextWrap}>
              <Text style={styles.choiceTitleSecondary}>Just Read the Walkthrough</Text>
              <Text style={styles.choiceSubSecondary}>Skim every section without changing your screen</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={handlePrev} activeOpacity={0.7}>
          <ChevronLeft size={18} color="#475569" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

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
    );
  };

  const cardBody = (compact: boolean) => (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {/* Top Bar with Step Indicators & Close Button */}
      <View style={styles.headerRow}>
        <View style={styles.stepBadge}>
          {isLiveSheet ? (
            <Compass size={13} color={step.accentColor} />
          ) : (
            <Sparkles size={13} color={step.accentColor} />
          )}
          <Text style={[styles.stepBadgeText, { color: step.accentColor }]}>
            {isLiveSheet ? `${step.badge} • Live on screen` : step.badge}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          accessibilityLabel="Close tour"
          activeOpacity={0.7}
        >
          <X size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      {renderDots()}

      {/* Step Body */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
      >
        {!compact && (
          <View style={[styles.iconCircle, { backgroundColor: `${step.accentColor}18` }]}>
            <StepIcon size={34} color={step.accentColor} />
          </View>
        )}

        <Text style={[styles.title, compact && styles.titleCompact]}>{step.title}</Text>
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

      {renderFooter()}
    </View>
  );

  if (isLiveSheet) {
    // Interactive tour: dim only the main content pane (never the nav rail)
    // so the admin can watch the real tab and its highlighted icon change.
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
        <View style={styles.sheetRoot}>
          <View style={styles.sheetDimPanel}>
            <SafeAreaView style={styles.sheetSafeArea}>
              {cardBody(true)}
            </SafeAreaView>
          </View>

          {showNavHint && (
            <Animated.View
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(180)}
              style={styles.navHintBubble}
            >
              <View style={styles.navHintCaret} />
              <Compass size={14} color="#047857" />
              <Text style={styles.navHintText}>Watch this tab light up on the left</Text>
              <TouchableOpacity
                onPress={dismissNavHint}
                style={styles.navHintCloseBtn}
                accessibilityLabel="Dismiss hint"
              >
                <X size={12} color="#94A3B8" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.modalContainer}>
          {cardBody(false)}
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
  sheetRoot: {
    flex: 1,
  },
  // Covers only the main content pane to the right of the fixed-width left
  // nav rail (see NAV_RAIL_WIDTH), keeping the live nav icon visible.
  sheetDimPanel: {
    position: "absolute",
    top: 0,
    left: NAV_RAIL_WIDTH,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheetSafeArea: {
    padding: 16,
  },
  navHintBubble: {
    position: "absolute",
    top: "36%",
    left: NAV_RAIL_WIDTH + 10,
    maxWidth: 210,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingRight: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  navHintCaret: {
    position: "absolute",
    left: -6,
    top: "50%",
    marginTop: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: "#FFFFFF",
  },
  navHintText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: "#065F46",
    lineHeight: 15,
  },
  navHintCloseBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    padding: 2,
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
  cardCompact: {
    maxHeight: 420,
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
  titleCompact: {
    fontSize: 17,
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
    alignSelf: "center",
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
  choiceColumn: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 10,
    gap: 10,
  },
  choiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  choiceBtnPrimary: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  choiceBtnSecondary: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  choiceTextWrap: {
    flex: 1,
  },
  choiceTitlePrimary: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  choiceSubPrimary: {
    fontSize: 11.5,
    color: "#D1FAE5",
    marginTop: 1,
  },
  choiceTitleSecondary: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  choiceSubSecondary: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1,
  },
});
