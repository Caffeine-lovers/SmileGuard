import React, { useState, useEffect } from "react";
import { View, Alert, BackHandler, Keyboard } from "react-native";
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

    const normalizedRole = (savedRole || "").trim().toLowerCase();
    const normalizedCode = (savedCode || "").trim().toUpperCase();

    if (normalizedCode === "SMILEGUARD-STAFF" || normalizedRole === "assistant" || normalizedRole === "staff") {
      console.log("[SetupProfile] Assistant role detected, routing to onboarding");
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
              // Mark exiting flag first so RootLayout won't bounce back to /setup-profile while auth is signing out
              await AsyncStorage.setItem("@is_exiting_registration", "true");
              await supabase.auth.signOut();
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter(
                (k) =>
                  k.startsWith("sb-") ||
                  k.startsWith("supabase.") ||
                  k.startsWith("@pending_")
              );
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
              }
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

  // Intercept phone hardware back button on Android safely:
  // If soft keyboard is open, pressing back simply dismisses the keyboard without exiting.
  useEffect(() => {
    let keyboardVisible = false;
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisible = true;
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisible = false;
    });

    const onHardwareBack = () => {
      if (keyboardVisible || Keyboard.isVisible()) {
        Keyboard.dismiss();
        return true;
      }
      handleCancel();
      return true; // Prevent default OS pop which triggers route bounce loop
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onHardwareBack
    );

    return () => {
      showSub.remove();
      hideSub.remove();
      backSubscription.remove();
    };
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
