import React, { useState, useEffect } from "react";
import { View, Alert, BackHandler } from "react-native";
import DoctorProfileSetup from "../components/auth/DoctorProfileSetup";
import ClinicSetup from "../components/settings/ClinicSetup";
import { useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Setup Profile Page (OAuth redirect - Step 2)
 * 
 * After Google OAuth login, doctors land here to complete their profile.
 * Then progresses to clinic setup before dashboard access.
 * Flow: DoctorProfileSetup → ClinicSetup → Dashboard
 */
export default function SetupProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "clinic">("profile");

  const handleProfileContinue = async () => {
    console.log("[SetupProfile] Profile setup complete, checking role...");
    const [savedCode, savedRole] = await Promise.all([
      AsyncStorage.getItem("@pending_doctor_access_code"),
      AsyncStorage.getItem("@pending_user_role"),
    ]);

    if (savedCode === "SMILEGUARD-STAFF" || savedRole === "assistant") {
      console.log("[SetupProfile] Assistant role detected, bypassing clinic setup directly to onboarding");
      router.replace("/onboarding");
      return;
    }

    setStep("clinic");
  };

  const handleClinicClose = () => {
    console.log("[SetupProfile] Clinic setup cancelled, back to profile");
    setStep("profile");
  };

  const handleClinicSave = async () => {
    console.log("[SetupProfile] Clinic setup complete, routing to onboarding");
    // Navigate to onboarding guide before entering dashboard
    router.replace("/onboarding");
  };

  const handleCancel = () => {
    if (step === "clinic") {
      setStep("profile");
      return;
    }

    Alert.alert(
      "Exit Registration?",
      "Are you sure you want to exit and return to the welcome screen? Any unsaved registration details will be discarded.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Exit to Welcome Screen",
          style: "destructive",
          onPress: async () => {
            console.log("[SetupProfile] User exited registration, signing out...");
            try {
              await supabase.auth.signOut();
              await AsyncStorage.multiRemove([
                "supabase.auth.token",
                "supabase.auth.refreshToken",
                "supabase.auth.user",
                "@pending_doctor_access_code",
                "@pending_user_role",
              ]);
            } catch (err) {
              console.warn("[SetupProfile] Error during signOut on cancel:", err);
            } finally {
              router.replace("/");
            }
          },
        },
      ]
    );
  };

  // Intercept phone hardware back button on Android
  useEffect(() => {
    const onHardwareBack = () => {
      handleCancel();
      return true; // Prevent default OS pop which triggers route bounce loop
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onHardwareBack
    );

    return () => backSubscription.remove();
  }, [step]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: step === "profile" ? "flex" : "none" }}>
        <DoctorProfileSetup 
          onContinue={handleProfileContinue} 
          onCancel={handleCancel} 
        />
      </View>
      
      {step === "clinic" && (
        <ClinicSetup
          onClose={handleClinicClose}
          onBack={handleClinicClose}
          onSave={handleClinicSave}
          onSkip={handleClinicSave}
          isRegistration={true}
        />
      )}
    </View>
  );
}
