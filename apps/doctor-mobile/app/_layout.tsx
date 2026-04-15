import React from "react";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import * as Linking from "expo-linking";
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

  // Listen for deep links from OAuth redirects
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log("[RootLayout] Deep link received:", url);
      if (url.includes('smileguard://redirect')) {
        console.log("[RootLayout] OAuth redirect detected");
        // The session will be automatically set by Supabase auth listener
        // Just log it so we know it arrived
      }
    });

    // Also check if app was launched FROM a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('smileguard://redirect')) {
        console.log("[RootLayout] App opened via deep link:", url);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      console.log("[RootLayout] Initial session check:", session ? "Found" : "Null");
      if (session?.user) {
        const role = session.user.user_metadata?.role;
        console.log("[RootLayout] Initial user role:", role);
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
        console.log("[RootLayout] Auth state changed:", event, session ? "Session Found" : "No Session");
        if (event === "PASSWORD_RECOVERY") {
          router.push("/reset-password");
          return;
        }
        if (session?.user) {
          const role = session.user.user_metadata?.role;
          console.log("[RootLayout] Setting user from auth state. Role:", role);
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            role
          });
        } else {
          console.log("[RootLayout] Setting user to null");
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

    console.log("[RootLayout] Routing logic - Ready:", ready, "User:", !!user, "Segments:", segments);

    if (inResetPassword || inCompleteProfile) return;

    if (!user) {
      if (inDoctorGroup) {
        console.log("[RootLayout] No user, routing to /");
        router.replace("/");
      }
    } else {
      if (!inDoctorGroup) {
        console.log("[RootLayout] User exists, routing to /(doctor)/dashboard");
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