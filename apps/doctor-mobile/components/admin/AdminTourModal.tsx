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

export type AdminTab = "clinic" | "codes" | "dentists" | "patients" | "support" | "attempts";

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
  description: string;
  icon: any;
  accentColor: string;
}

// Width must match the left nav rail in app/(admin)/dashboard.tsx so the
// interactive tour's dim panel never covers the live nav icons behind it.
const NAV_RAIL_WIDTH = 64;

const TOUR_STEPS: TourStep[] = [
  {
    badge: "Step 1 of 6 • Overview",
    title: "Admin Console",
    description: "Use the left navigation rail to access clinic management modules.",
    icon: ShieldCheck,
    accentColor: "#047857",
  },
  {
    tab: "codes",
    badge: "Step 2 of 6 • Access Codes",
    title: "Access Codes",
    description: "Create and manage sign-in codes for dentists and clinic assistants.",
    icon: KeyRound,
    accentColor: "#059669",
  },
  {
    tab: "dentists",
    badge: "Step 3 of 6 • Clinicians",
    title: "Staff Roster",
    description: "Review registered staff and toggle verified status upon PRC license checks.",
    icon: Stethoscope,
    accentColor: "#0D9488",
  },
  {
    tab: "patients",
    badge: "Step 4 of 6 • Patients",
    title: "Patient Accounts",
    description: "Search registered patient records and inspect Senior Citizen or PWD verification.",
    icon: Users,
    accentColor: "#2563EB",
  },
  {
    tab: "support",
    badge: "Step 5 of 6 • Helpdesk",
    title: "Support Tickets",
    description: "Filter and resolve patient inquiries.",
    icon: LifeBuoy,
    accentColor: "#D97706",
  },
  {
    tab: "attempts",
    badge: "Step 6 of 6 • Security Log",
    title: "Audit Log",
    description: "Review authorized and blocked access code attempts.",
    icon: ListChecks,
    accentColor: "#DC2626",
  },
];

export default function AdminTourModal({
  visible,
  onClose,
  onSelectTab,
}: AdminTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState<TourMode>("choose");

  const step = TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  // Only the live tour mode moves the real dashboard tab — and only once a
  // tab-specific step is showing, so the welcome screen never needs to dim it.
  const isLiveSheet = mode === "tour" && Boolean(step.tab);

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
              <Text style={styles.choiceTitlePrimary}>Interactive Tour</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceBtn, styles.choiceBtnSecondary]}
            onPress={startWalkthrough}
            activeOpacity={0.8}
          >
            <BookOpen size={18} color="#334155" />
            <View style={styles.choiceTextWrap}>
              <Text style={styles.choiceTitleSecondary}>Quick Walkthrough</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Skip</Text>
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
            {isLast ? "Done" : "Next"}
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
        <Text style={styles.description}>{step.description}</Text>
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
  description: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#334155",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
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
  choiceTitleSecondary: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
});
