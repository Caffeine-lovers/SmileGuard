import React, { useEffect, useState } from "react";
import { Slot, Redirect } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { ActivityIndicator, View } from "react-native";
import { ClinicProvider } from "../../contexts/ClinicContext";

export default function DoctorLayout() {
  // undefined = still checking, null = no session, Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[DoctorLayout] Initial session check:", session ? "Found" : "Null");
      if (mounted) {
        // In doctor mobile app, we assume authenticated users are doctors
        // Google OAuth doesn't set role automatically
        setSession(session);
      }
    });

    // Listen for auth state changes (including logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log("[DoctorLayout] Auth changed:", event);
        if (mounted) {
          setSession(session);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!session) {
    // Declarative redirect avoids navigating before the navigator is mounted
    return <Redirect href="/" />;
  }

  return (
    <ClinicProvider>
      <Slot />
    </ClinicProvider>
  );
}
