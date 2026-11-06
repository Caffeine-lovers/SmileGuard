import React, { useEffect, useState } from "react";
import { Slot, Redirect } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { ActivityIndicator, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AdminLayout() {
  // undefined = still checking, null = not an admin, true = confirmed admin
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async (session: Session | null) => {
      if (!session?.user) {
        if (mounted) setIsAdmin(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.warn("[AdminLayout] Error checking admin role:", error);
      }

      let confirmed = profile?.role === "admin";

      // Admin rights come from the server, which re-checks the code entered at sign-in.
      if (!confirmed) {
        const [savedCode, savedRole] = await Promise.all([
          AsyncStorage.getItem("@pending_doctor_access_code"),
          AsyncStorage.getItem("@pending_user_role"),
        ]);

        if (savedCode && savedRole === "admin") {
          const { data: granted, error: claimError } = await supabase.rpc("claim_admin_access", {
            p_code: savedCode,
            p_platform: Platform.OS,
          });
          if (claimError) {
            console.warn("[AdminLayout] Could not confirm admin access:", claimError.message);
          }
          confirmed = granted === true;
        }
      }

      if (confirmed) {
        await AsyncStorage.multiRemove(["@pending_doctor_access_code", "@pending_user_role"]);
      }

      if (mounted) setIsAdmin(confirmed);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAdmin(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        checkAdmin(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isAdmin === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  if (!isAdmin) {
    // Not an admin profile — never silently fall through to the doctor dashboard
    return <Redirect href="/(doctor)/dashboard" />;
  }

  return <Slot />;
}
