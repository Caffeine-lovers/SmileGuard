import React from "react";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@smileguard/supabase-client";
import { CurrentUser } from "../types/index";
import { Session } from "@supabase/supabase-js";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        const role = session.user.user_metadata?.role;
        setUser({ 
          id: session.user.id,
          email: session.user.email!, 
          name: session.user.user_metadata?.name,
          role 
        });
      }
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        if (event === "PASSWORD_RECOVERY") {
          router.push("/reset-password");
          return;
        }
        if (session?.user) {
          const role = session.user.user_metadata?.role;
          setUser({ 
            id: session.user.id,
            email: session.user.email!, 
            name: session.user.user_metadata?.name,
            role 
          });
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const inDoctorGroup = segments[0] === "(doctor)";
    const inResetPassword = segments[0] === "reset-password";
    const inCompleteProfile = segments[0] === "complete-profile";

    if (inResetPassword || inCompleteProfile) return;

    if (!user) {
      if (inDoctorGroup) {
        router.replace("/");
      }
    } else {
      if (!inDoctorGroup) {
        router.replace("/(doctor)/dashboard");
      }
    }
  }, [user, ready, segments]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}