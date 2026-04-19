import React from "react";
import { View } from "react-native";
import DoctorProfileSetup from "../components/auth/DoctorProfileSetup";
import { useRouter } from "expo-router";

/**
 * Setup Profile Page (OAuth redirect - Step 2)
 * 
 * After Google OAuth login, doctors land here to complete their profile.
 * Uses the full-featured DoctorProfileSetup component with:
 * - Image upload
 * - Professional bio
 * - Multi-step registration (details + credentials)
 */
export default function SetupProfilePage() {
  const router = useRouter();

  const handleSuccess = (user: { name: string; email: string; role: "doctor" }) => {
    console.log("[SetupProfile] Registration success:", user);
    // Navigate to dashboard after successful profile setup
    router.replace("/(doctor)/dashboard");
  };

  const handleCancel = () => {
    console.log("[SetupProfile] User cancelled setup");
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <DoctorProfileSetup onSuccess={handleSuccess} onCancel={handleCancel} />
    </View>
  );
}
