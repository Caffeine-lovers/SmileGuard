import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@smileguard/supabase-client";
import DoctorDashboard from "../../components/dashboard/DoctorDashboard";
import { useCurrentUser } from "../../hooks/useCurrentUser";

export default function DoctorDashboardPage() {
  const user = useCurrentUser();

  const handleLogout = async () => {
    try {
      // Sign out from Supabase (this will trigger onAuthStateChange in the layout)
      await supabase.auth.signOut();
      
      // Clear any persisted session data from AsyncStorage
      await AsyncStorage.multiRemove([
        "supabase.auth.token",
        "supabase.auth.refreshToken",
        "supabase.auth.user",
      ]);
    } catch (error) {
      console.error("Logout error:", error);
      // Layout will handle redirect via auth state change listener
    }
  };

  if (!user) {
    return null; // or a loading screen
  }

  return <DoctorDashboard user={user} onLogout={handleLogout} />;
}
