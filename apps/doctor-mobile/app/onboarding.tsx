import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
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
} from "lucide-react-native";
import PayMongoDoctorGuideModal from "../components/billing/PayMongoDoctorGuideModal";

export default function DoctorOnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPayMongoGuide, setShowPayMongoGuide] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    });
  }, []);

  const steps = [
    {
      id: "welcome",
      badge: "Step 1 of 5 • Welcome",
      title: "Welcome to SmileGuard Doctor Suite",
      subtitle: "Your Mobile Dental Clinic Command Center",
      description:
        "SmileGuard Doctor connects your practice with your online patients. Manage chair schedules, treatment catalogs, patient intake, and digital invoicing anywhere, anytime from your Android device.",
      icon: Stethoscope,
      accentColor: "#059669",
      features: [
        {
          icon: Building2,
          title: "Multi-Chair Practice Hub",
          desc: "Full operational control over clinic working hours, chair capacity, and operating schedules.",
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
      title: "Clinic Hours & Slot Logic",
      subtitle: "Automated conflict-free chair booking for patients.",
      description:
        "Customize operating hours for each day of the week. SmileGuard calculates open slot intervals (e.g. 10:00 AM – 2:00 PM) and prevents double bookings automatically.",
      icon: Clock,
      accentColor: "#0d9488",
      features: [
        {
          icon: Calendar,
          title: "Custom Weekly Open Days",
          desc: "Toggle open/closed days and specify lunch or break intervals.",
        },
        {
          icon: Clock,
          title: "Dynamic Slot Duration",
          desc: "Patients booking online only see real available time blocks matching your rules.",
        },
        {
          icon: ShieldCheck,
          title: "Blocked Slot Overrides",
          desc: "Easily mark vacation days or emergency closures with instant calendar lockdown.",
        },
      ],
    },
    {
      id: "pricing",
      badge: "Step 3 of 5 • Treatment Catalog",
      title: "Custom Procedures & Pricing",
      subtitle: "Your services, priced transparently in Philippine Pesos (₱).",
      description:
        "Define your clinic's service catalog (Oral Prophylaxis, Extractions, Restorations, Orthodontics, Whitening) and set prices. The patient web client pulls these rates for itemized checkout.",
      icon: Tag,
      accentColor: "#0891b2",
      features: [
        {
          icon: CreditCard,
          title: "Transparent Rates",
          desc: "Eliminates billing ambiguity by showing patients exact fees before and after treatment.",
        },
        {
          icon: Tag,
          title: "Flexible Catalog",
          desc: "Add or edit custom clinic procedures, durations, and base prices with 1 tap.",
        },
        {
          icon: Sparkles,
          title: "Direct Invoice Link",
          desc: "Procedures automatically populate billing invoices with accurate totals.",
        },
      ],
    },
    {
      id: "requests",
      badge: "Step 4 of 5 • Appointment Queue",
      title: "Real-time Appointment Alerts",
      subtitle: "Instant notifications when patients request a chair.",
      description:
        "When a patient books on the web portal, you receive an immediate alert. Review their preferred time, requested service, and medical intake, then Confirm or Reschedule with a single tap.",
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
          title: "Patient Medical Intake Preview",
          desc: "Check pre-existing conditions, allergies, and oral screening before confirming.",
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

  const handleComplete = async (destination?: string) => {
    try {
      if (userId) {
        await AsyncStorage.setItem(
          `@smileguard_doctor_onboarding_completed_${userId}`,
          "true"
        );
      } else {
        await AsyncStorage.setItem(
          "@smileguard_doctor_onboarding_completed_default",
          "true"
        );
      }
    } catch (e) {
      console.warn("Failed to persist doctor onboarding completion", e);
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
            <Stethoscope size={18} color="#34d399" />
          </View>
          <View>
            <Text style={styles.brandTitle}>SmileGuard</Text>
            <Text style={styles.brandSubtitle}>Doctor Clinic Suite</Text>
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
            <Text style={styles.quickStartTitle}>PayMongo Payout & Clinic Setup:</Text>
            <View style={styles.quickActionButtons}>
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
          {currentStep > 0 && (
            <TouchableOpacity
              onPress={handlePrev}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color="#94a3b8" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            style={styles.continueBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.continueBtnText}>
              {currentStep === steps.length - 1 ? "Enter Clinic Hub" : "Continue"}
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#0f2f27",
  },
  skipButtonText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "#0f2f27",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#064e3b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#059669",
    marginBottom: 16,
  },
  stepBadgeText: {
    color: "#6ee7b7",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTextCol: {
    flex: 1,
  },
  stepTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  stepSubtitle: {
    color: "#a7f3d0",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  stepDescription: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#0a221d",
    borderWidth: 1,
    borderColor: "#113830",
    borderRadius: 12,
    padding: 14,
  },
  featureIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#064e3b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  featureDesc: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
  },
  quickStartCard: {
    backgroundColor: "#064e3b",
    borderWidth: 1,
    borderColor: "#059669",
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
  },
  quickStartTitle: {
    color: "#a7f3d0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  quickActionButtons: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#34d399",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    color: "#022c22",
    fontSize: 13,
    fontWeight: "800",
  },
  footerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#0f2f27",
    backgroundColor: "#041b17",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: "#34d399",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "#164e43",
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#164e43",
  },
  backBtnText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  continueBtnText: {
    color: "#022c22",
    fontSize: 13,
    fontWeight: "800",
  },
});
