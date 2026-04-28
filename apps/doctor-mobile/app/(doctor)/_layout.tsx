import React, { useEffect, useState } from "react";
import { Slot, useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { ActivityIndicator, View } from "react-native";
import { ClinicProvider } from "../../contexts/ClinicContext";

export default function DoctorLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[DoctorLayout] Initial session check:", session ? "Found" : "Null");
      // In doctor mobile app, we assume authenticated users are doctors
      // Google OAuth doesn't set role automatically
      if (!session) {
        console.log("[DoctorLayout] No session, routing to /");
        router.replace("/");
        return;
      }
      setChecking(false);
    });

    // Listen for auth state changes (including logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log("[DoctorLayout] Auth changed:", event);
        if (!session) {
          console.log("[DoctorLayout] No session on auth change, routing to /");
          router.replace("/");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0b7fab" />
      </View>
    );
  }

  return (
    <ClinicProvider>
      <Slot />
    </ClinicProvider>
  );
}