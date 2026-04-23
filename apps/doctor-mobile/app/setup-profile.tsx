import React, { useState } from "react";
import { View, Modal } from "react-native";
import DoctorProfileSetup from "../components/auth/DoctorProfileSetup";
import ClinicSetup from "../components/settings/ClinicSetup";
import { useRouter } from "expo-router";

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

  const handleProfileContinue = () => {
    console.log("[SetupProfile] Profile setup complete, moving to clinic setup");
    setStep("clinic");
  };

  const handleClinicClose = () => {
    console.log("[SetupProfile] Clinic setup cancelled, back to profile");
    setStep("profile");
  };

  const handleClinicSave = async () => {
    console.log("[SetupProfile] Clinic setup complete, routing to dashboard");
    // Navigate to dashboard after successful clinic setup
    router.replace("/(doctor)/dashboard");
  };

  const handleCancel = () => {
    console.log("[SetupProfile] User cancelled setup");
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      {step === "profile" && (
        <DoctorProfileSetup 
          onContinue={handleProfileContinue} 
          onCancel={handleCancel} 
        />
      )}
      
      {step === "clinic" && (
        <ClinicSetup
          onClose={handleClinicClose}
          onSave={handleClinicSave}
        />
      )}
    </View>
  );
}
