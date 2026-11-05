import React, { useEffect, useState } from "react";
import { Slot, Redirect } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { ActivityIndicator, View } from "react-native";

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

      if (mounted) setIsAdmin(profile?.role === "admin");
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
