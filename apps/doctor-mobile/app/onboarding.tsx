import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@smileguard/supabase-client";
import {
  Stethoscope,
  Clock,
  Calendar,
  CreditCard,
  Users,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  Building2,
  Tag,
  Inbox,
  CalendarDays,
  Phone,
} from "lucide-react-native";
import PayMongoDoctorGuideModal from "../components/billing/PayMongoDoctorGuideModal";

export default function DoctorOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"doctor" | "assistant">("doctor");
  const [showPayMongoGuide, setShowPayMongoGuide] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pendingRole, { data: { session } }] = await Promise.all([
          AsyncStorage.getItem("@pending_user_role"),
          supabase.auth.getSession(),
        ]);

        if (pendingRole === "assistant") {
          setUserRole("assistant");
        }

        if (session?.user?.id) {
          setUserId(session.user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile?.role === "assistant") {
            setUserRole("assistant");
          }
        }
      } catch (err) {
        console.warn("[Onboarding] Error resolving user role:", err);
      }
    })();
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (showPayMongoGuide) {
        setShowPayMongoGuide(false);
        return true;
      }
      if (currentStep > 0) {
        handlePrev();
        return true;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(doctor)/dashboard");
      }
      return true;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [showPayMongoGuide, currentStep]);

  const doctorSteps = [
    {
      id: "welcome",
      badge: "Step 1 of 5 • Welcome",
      title: "Welcome to SmileGuard Doctor Suite",
      subtitle: "Your Mobile Dental Clinic Command Center",
      description:
        "SmileGuard Doctor connects your practice with your online patients. Manage clinic schedules, service prices, patient health forms, and digital billing anywhere, anytime from your phone.",
      icon: Stethoscope,
      accentColor: "#059669",
      features: [
        {
          icon: Building2,
          title: "Multi-Chair Practice Hub",
          desc: "Full control over clinic working hours, chair limits, and daily operating schedules.",
        },
        {
          icon: ShieldCheck,
          title: "Encrypted Patient Charting",
          desc: "Secure, compliant storage of dental history, previous visits, and treatment notes.",
        },
        {
          icon: Sparkles,
          title: "Live Web & Mobile Sync",
          desc: "Changes you make in the mobile app instantly reflect on your patient's booking portal.",
        },
      ],
    },
    {
      id: "schedule",
      badge: "Step 2 of 5 • Hours & Schedule",
      title: "Clinic Hours & Booking Slots",
      subtitle: "Automatic booking for patients without schedule conflicts.",
      description:
        "Set your clinic hours for each day of the week. SmileGuard calculates available time slots (e.g. 10:00 AM – 2:00 PM) and prevents double bookings automatically.",
      icon: Clock,
      accentColor: "#0d9488",
      features: [
        {
          icon: Calendar,
          title: "Custom Weekly Open Days",
          desc: "Turn open or closed days on and off, and set lunch or break times.",
        },
        {
          icon: Clock,
          title: "Dynamic Slot Duration",
          desc: "Patients booking online only see real available time blocks matching your rules.",
        },
        {
          icon: ShieldCheck,
          title: "Blocked Slot Overrides",
          desc: "Easily mark vacation days or emergency closures by blocking dates on the calendar.",
        },
      ],
    },
    {
      id: "pricing",
      badge: "Step 3 of 5 • Treatment Catalog",
      title: "Custom Procedures & Pricing",
      subtitle: "Your services, priced transparently in Philippine Pesos (₱).",
      description:
        "Set up your clinic's services (Cleaning, Extractions, Fillings, Braces, Whitening) and set prices. Patients see these prices when booking online.",
      icon: Tag,
      accentColor: "#0891b2",
      features: [
        {
          icon: CreditCard,
          title: "Transparent Rates",
          desc: "Avoids billing confusion by showing patients exact fees before and after treatment.",
        },
        {
          icon: Tag,
          title: "Flexible Catalog",
          desc: "Add or edit custom clinic procedures, durations, and base prices with 1 tap.",
        },
        {
          icon: Sparkles,
          title: "Direct Invoice Link",
          desc: "Selected procedures are automatically added to invoices with accurate totals.",
        },
      ],
    },
    {
      id: "requests",
      badge: "Step 4 of 5 • Appointment Queue",
      title: "Real-time Appointment Alerts",
      subtitle: "Instant notifications when patients request a chair.",
      description:
        "When a patient books online, you get an immediate alert. Review their preferred time, requested service, and health form, then Confirm or Reschedule with a single tap.",
      icon: Calendar,
      accentColor: "#059669",
      features: [
        {
          icon: Clock,
          title: "Push Notifications",
          desc: "Stay updated the moment a patient schedules, reschedules, or cancels.",
        },
        {
          icon: Users,
          title: "Patient Health Form Preview",
          desc: "Check past health conditions, allergies, and dental notes before confirming.",
        },
        {
          icon: CheckCircle,
          title: "Daily Chair Schedule",
          desc: "View upcoming patients grouped by today, this week, or pending requests.",
        },
      ],
    },
    {
      id: "paymongo",
      badge: "Step 5 of 5 • PayMongo Setup & Guidelines",
      title: "PayMongo Payouts & Clinic Billing",
      subtitle: "Set up GCash, Maya, and direct Philippine bank settlements.",
      description:
        "SmileGuard integrates directly with PayMongo (BSP-Licensed) so your patients can pay via GCash, Maya, and Cards. Follow these clinic guidelines to start receiving automated payouts:",
      icon: CreditCard,
      accentColor: "#10b981",
      features: [
        {
          icon: Building2,
          title: "1. Register Merchant Account",
          desc: "Create an account on dashboard.paymongo.com with your BIR Form 2303 / COR, DTI/SEC certificate, and valid ID.",
        },
        {
          icon: CreditCard,
          title: "2. Activate GCash & Maya Channels",
          desc: "Enable Philippine e-wallets, QR Ph, and Cards for 1-click patient checkout without expensive POS hardware.",
        },
        {
          icon: CheckCircle,
          title: "3. Direct Bank Payouts & BIR 2307",
          desc: "Collected patient revenues deposit into your clinic bank account with official BIR Form 2307 withholding certificates.",
        },
      ],
    },
  ];

  const assistantSteps = [
    {
      id: "assistant-welcome",
      badge: "Step 1 of 5 • Welcome",
      title: "Welcome to SmileGuard Assistant Suite",
      subtitle: "Your Front-Desk & Clinic Coordination Hub",
      description:
        "SmileGuard Assistant connects your front desk with arriving patients and attending dentists. Streamline daily visits, confirm booking requests, manage queues, and prepare patient charts seamlessly.",
      icon: Users,
      accentColor: "#059669",
      features: [
        {
          icon: Building2,
          title: "Front-Desk Coordination Hub",
          desc: "Full oversight of arriving patients, today's chair queue, and clinic schedules.",
        },
        {
          icon: ShieldCheck,
          title: "Instant Patient Charting",
          desc: "Secure, immediate access to medical history, allergies, notes, and past dental procedures.",
        },
        {
          icon: Sparkles,
          title: "Real-Time Collaboration",
          desc: "Patient check-ins and appointment status updates sync in real time with the dentists.",
        },
      ],
    },
    {
      id: "assistant-queue",
      badge: "Step 2 of 5 • Patient Queue & Check-In",
      title: "Today's Patient Schedule & Queue",
      subtitle: "Track arriving patients, check-ins, and chair progression in real time.",
      description:
        "Monitor every scheduled patient for the day. Filter by Scheduled, Completed, or All. Quick-tap any patient to inspect their visit reason, verify check-in, or prepare their chart for the doctor.",
      icon: Clock,
      accentColor: "#0d9488",
      features: [
        {
          icon: Calendar,
          title: "Real-Time Patient Roster",
          desc: "See who is in the waiting room and who is scheduled next in the dental chair.",
        },
        {
          icon: CheckCircle,
          title: "One-Tap Status Updates",
          desc: "Update patient progress effortlessly from scheduled to completed with real-time logging.",
        },
        {
          icon: Phone,
          title: "Direct Patient Contact",
          desc: "One-tap phone calls and quick SMS to contact patients who are running late.",
        },
      ],
    },
    {
      id: "assistant-requests",
      badge: "Step 3 of 5 • Booking Requests Deck",
      title: "Swipeable Booking Request Deck",
      subtitle: "Fast, distraction-free appointment reviews and confirmations.",
      description:
        "Review incoming patient appointment requests one at a time with a dedicated swipe interface. Swipe right to accept or swipe left to decline. Requests arrive organized oldest-first so no patient is kept waiting.",
      icon: Inbox,
      accentColor: "#0891b2",
      features: [
        {
          icon: Sparkles,
          title: "Focused Quick Swiping",
          desc: "Review requested chair times, patient contact numbers, and intake notes with zero clutter.",
        },
        {
          icon: Users,
          title: "Medical Intake Inspection",
          desc: "Check patient chief complaints, requested dental procedures, and health alerts upfront.",
        },
        {
          icon: ShieldCheck,
          title: "Instant Patient Confirmation",
          desc: "Patients receive instant confirmation alerts the moment you accept their requested slot.",
        },
      ],
    },
    {
      id: "assistant-reschedules",
      badge: "Step 4 of 5 • Reschedules & Dental Records",
      title: "Reschedule Priority & Dental Records",
      subtitle: "Priority reschedule inbox and complete patient directory.",
      description:
        "Patients requesting to change their appointment time appear right at the top of your dashboard for quick action. Access complete digital patient records with instant search and date sorting.",
      icon: CalendarDays,
      accentColor: "#059669",
      features: [
        {
          icon: Clock,
          title: "Priority Reschedule Queue",
          desc: "Quickly review requested new dates/times and verify dentist availability before confirming.",
        },
        {
          icon: Users,
          title: "Searchable Patient Directory",
          desc: "Instantly find patient records by full name, ID, or creation date.",
        },
        {
          icon: CheckCircle,
          title: "Allergies & Medical History",
          desc: "Verify medical precautions and alert the attending dentist before treatment begins.",
        },
      ],
    },
    {
      id: "assistant-billing",
      badge: "Step 5 of 5 • Billing Assistance & Verification",
      title: "Front-Desk Billing & Payment Verification",
      subtitle: "Verify digital transactions and manage front-desk receipts.",
      description:
        "Track clinic invoices, verify PayMongo e-wallet payments (GCash, Maya, Cards), and record front-desk cash settlements to keep clinic ledgers perfectly balanced.",
      icon: CreditCard,
      accentColor: "#10b981",
      features: [
        {
          icon: CreditCard,
          title: "GCash, Maya & Card Verification",
          desc: "Verify patient digital payments directly from your mobile ledger without POS hardware.",
        },
        {
          icon: Building2,
          title: "Transparent Invoicing",
          desc: "Check procedure itemization, senior/PWD discounts, and payment status at a glance.",
        },
        {
          icon: CheckCircle,
          title: "Daily Clinic Settlement",
          desc: "Ensure front-desk receipts match today's completed procedures for seamless reporting.",
        },
      ],
    },
  ];

  const isAssistant = userRole === "assistant";
  const steps = isAssistant ? assistantSteps : doctorSteps;

  const handleComplete = async (destination?: string) => {
    try {
      const storageKey = isAssistant
        ? (userId ? `@smileguard_assistant_onboarding_completed_${userId}` : "@smileguard_assistant_onboarding_completed_default")
        : (userId ? `@smileguard_doctor_onboarding_completed_${userId}` : "@smileguard_doctor_onboarding_completed_default");
      await AsyncStorage.setItem(storageKey, "true");
    } catch (e) {
      console.warn("Failed to persist onboarding completion", e);
    }

    if (destination) {
      router.replace(destination as any);
    } else {
      router.replace("/(doctor)/dashboard");
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const activeStep = steps[currentStep];
  const StepIcon = activeStep.icon;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#022c22" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            {isAssistant ? (
              <Users size={18} color="#34d399" />
            ) : (
              <Stethoscope size={18} color="#34d399" />
            )}
          </View>
          <View>
            <Text style={styles.brandTitle}>SmileGuard</Text>
            <Text style={styles.brandSubtitle}>
              {isAssistant ? "Assistant Clinic Hub" : "Doctor Clinic Suite"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleComplete()}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip to Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Step Badge */}
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{activeStep.badge}</Text>
        </View>

        {/* Step Hero */}
        <View style={styles.heroRow}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: activeStep.accentColor },
            ]}
          >
            <StepIcon size={28} color="#ffffff" />
          </View>
          <View style={styles.heroTextCol}>
            <Text style={styles.stepTitle}>{activeStep.title}</Text>
            <Text style={styles.stepSubtitle}>{activeStep.subtitle}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.stepDescription}>{activeStep.description}</Text>

        {/* Features Card List */}
        <View style={styles.featureList}>
          {activeStep.features.map((feat, index) => {
            const FeatIcon = feat.icon;
            return (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <FeatIcon size={20} color="#10b981" />
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>{feat.title}</Text>
                  <Text style={styles.featureDesc}>{feat.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Final Step Actions */}
        {currentStep === steps.length - 1 && (
          <View style={styles.quickStartCard}>
            <Text style={styles.quickStartTitle}>
              {isAssistant ? "Assistant Front-Desk Ready:" : "PayMongo Payout & Clinic Setup:"}
            </Text>
            <View style={styles.quickActionButtons}>
              {isAssistant ? (
                <TouchableOpacity
                  onPress={() => handleComplete("/(doctor)/dashboard")}
                  style={[styles.actionBtnPrimary, { backgroundColor: "#065f46", flex: 1 }]}
                  activeOpacity={0.8}
                >
                  <Building2 size={16} color="#ffffff" />
                  <Text style={[styles.actionBtnPrimaryText, { color: "#ffffff" }]}>
                    Go to Assistant Dashboard
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setShowPayMongoGuide(true)}
                    style={styles.actionBtnPrimary}
                    activeOpacity={0.8}
                  >
                    <CreditCard size={16} color="#022c22" />
                    <Text style={styles.actionBtnPrimaryText}>PayMongo Checklist</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleComplete("/(doctor)/dashboard")}
                    style={[styles.actionBtnPrimary, { backgroundColor: "#065f46" }]}
                    activeOpacity={0.8}
                  >
                    <Building2 size={16} color="#ffffff" />
                    <Text style={[styles.actionBtnPrimaryText, { color: "#ffffff" }]}>Go to Dashboard</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Controls */}
      <View style={styles.footerControls}>
        {/* Dots */}
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

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          {currentStep > 0 ? (
            <TouchableOpacity
              onPress={handlePrev}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color="#94a3b8" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace("/(doctor)/dashboard")}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color="#94a3b8" />
              <Text style={styles.backBtnText}>Close</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            style={styles.continueBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.continueBtnText}>
              {currentStep === steps.length - 1
                ? (isAssistant ? "Enter Assistant Hub" : "Enter Clinic Hub")
                : "Continue"}
            </Text>
            <ChevronRight size={18} color="#022c22" />
          </TouchableOpacity>
        </View>
      </View>
      {/* PayMongo Doctor Onboarding & Guidelines Modal */}
      <PayMongoDoctorGuideModal
        visible={showPayMongoGuide}
        onClose={() => setShowPayMongoGuide(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#061512",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#0f2f27",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#064e3b",
    borderWidth: 1,
    borderColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#064e3b",
    borderWidth: 1,
    borderColor: "#059669",
  },
  skipButtonText: {
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: "#064e3b",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(5, 150, 105, 0.2)",
    borderWidth: 1,
    borderColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  stepBadgeText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  heroTextCol: {
    flex: 1,
  },
  stepTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  stepSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  stepDescription: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  featureList: {
    gap: 12,
    marginBottom: 20,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#06231c",
    borderWidth: 1,
    borderColor: "#0f3e33",
    padding: 14,
    borderRadius: 10,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    color: "#f1f5f9",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  featureDesc: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
  quickStartCard: {
    backgroundColor: "rgba(6, 78, 59, 0.3)",
    borderWidth: 1,
    borderColor: "#059669",
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
    marginBottom: 10,
  },
  quickStartTitle: {
    color: "#a7f3d0",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickActionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#34d399",
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    color: "#022c22",
    fontSize: 12,
    fontWeight: "800",
  },
  footerControls: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#0f2f27",
    backgroundColor: "#061512",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 20,
    backgroundColor: "#10b981",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "#064e3b",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backBtnText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  continueBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  continueBtnText: {
    color: "#022c22",
    fontSize: 14,
    fontWeight: "800",
  },
});
