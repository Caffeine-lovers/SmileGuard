import React from "react";
import { useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import PatientDashboard from "../../components/dashboard/PatientDashboard.tsx";
import { useCurrentUser } from "../../hooks/useCurrentUser.ts";

export default function PatientDashboardPage() {
  const router = useRouter();
  const user = useCurrentUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!user) {
    return null; // or a loading screen
  }

  return <PatientDashboard user={user} onLogout={handleLogout} />;
}
