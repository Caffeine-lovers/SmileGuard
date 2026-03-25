import React from "react";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase.ts";
import { CurrentUser } from "../types/index.ts";
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

    const inPatientGroup = segments[0] === "(patient)";
    const inDoctorGroup = segments[0] === "(doctor)";
    const inResetPassword = segments[0] === "reset-password"; // ← added

    if (inResetPassword) return; // ← never redirect away from reset page

    if (!user) {
      if (inPatientGroup || inDoctorGroup) {
        router.replace("/");
      }
    } else {
      if (!inPatientGroup && !inDoctorGroup) {
        if (user.role === "doctor") {
          router.replace("/(doctor)/dashboard");
        } else {
          router.replace("/(patient)/dashboard");
        }
      }
    }
  }, [user, ready, segments]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}