import React, { useEffect, useState } from "react";
import { Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "@smileguard/supabase-client";
import { ClinicProvider } from "../../contexts/ClinicContext";

/**
 * Blocks the Slot from mounting until the active session is confirmed.
 * This ensures useCurrentUser() inside child screens (e.g. DoctorDashboard)
 * immediately finds a valid session on their own getSession() call, so data
 * fetching starts correctly and doesn't exit early due to a null user.
 *
 * Auth-based redirects (sign-out → login screen) are handled entirely by
 * _layout.tsx — no redundant onAuthStateChange navigation needed here.
 */
export default function DoctorLayout() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mounted) {
        setSessionReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && mounted) {
        setSessionReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!sessionReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <ClinicProvider>
      <Slot />
    </ClinicProvider>
  );
}