import React from "react";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Linking from "expo-linking";
import { supabase } from "@smileguard/supabase-client";
import { CurrentUser } from "../types/index";
import { Session } from "@supabase/supabase-js";

const prefix = Linking.createURL("/");

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Handle deep links (OAuth callback)
    const handleDeepLink = ({ url }: { url: string }) => {
      console.log("🔗 Deep link received:", url);
      
      // Detect if this is an OAuth callback
      if (url.includes("auth/callback") || url.includes("access_token") || url.includes("refresh_token")) {
        console.log("✅ OAuth callback detected, processing...");
        // The auth listener below will handle the session creation
        // Just log it for now
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check initial URL (if app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url != null) {
        console.log("🔗 Initial deep link:", url);
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, []);

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
        console.log("🔐 Auth state changed:", event);
        
        if (event === "PASSWORD_RECOVERY") {
          router.push("/reset-password");
          return;
        }
        
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
          console.log("✅ User signed in or session updated");
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
    const inHome = segments[0] === undefined || segments[0] === "index";
    const inAuth = segments[0] === "auth";

    if (inResetPassword) return;

    if (!user) {
      // No user: route to home if in doctor routes
      if (inDoctorGroup) {
        router.replace("/");
      }
    } else {
      // User exists
      // Don't interfere if AuthModal is handling routing (on home or auth screens)
      if (inHome || inAuth) {
        console.log("📍 On auth/home screen - AuthModal will handle routing");
        return;
      }
      
      // If already in doctor group, stay there
      if (inDoctorGroup) {
        return;
      }
      
      // Otherwise, route to doctor dashboard
      console.log("🚀 Routing to doctor dashboard...");
      router.replace("/(doctor)/dashboard");
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