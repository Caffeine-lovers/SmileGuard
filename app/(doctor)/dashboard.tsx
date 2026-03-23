import React from "react";
import { useRouter } from "expo-router";

import { supabase } from "../../lib/supabase.ts";
import DoctorDashboard from "../../components/dashboard/DoctorDashboard.tsx";
import { useCurrentUser } from "../../hooks/useCurrentUser.ts";

export default function DoctorDashboardPage() {
  const router = useRouter();
  const user = useCurrentUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!user) {
    return null; // or a loading screen
  }

  return <DoctorDashboard user={user} onLogout={handleLogout} />;
}
