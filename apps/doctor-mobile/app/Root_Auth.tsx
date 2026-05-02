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
  const [exchangingSession, setExchangingSession] = useState(false);

  const extractAuthParams = (url: string) => {
    const params = new URLSearchParams();
    const queryIndex = url.indexOf("?");
    const hashIndex = url.indexOf("#");

    if (queryIndex >= 0) {
      const query = url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
      const queryParams = new URLSearchParams(query);
      queryParams.forEach((value, key) => params.set(key, value));
    }

    if (hashIndex >= 0) {
      const hash = url.slice(hashIndex + 1);
      const hashParams = new URLSearchParams(hash);
      hashParams.forEach((value, key) => params.set(key, value));
    }

    return {
      code: params.get("code"),
      accessToken: params.get("access_token"),
      refreshToken: params.get("refresh_token")
    };
  }; // Handle OAuth deep link redirect


  useEffect(() => {
    const handleUrl = async (url: string) => {
      const isAuthRedirect = url.includes("oauth-redirect") || url.includes("smileguard://redirect");
      if (!isAuthRedirect) return;
      console.log("[RootLayout] OAuth redirect received:", url);
      setExchangingSession(true);

      try {
        const {
          data: {
            session: existingSession
          }
        } = await supabase.auth.getSession();

        if (existingSession?.user) {
          console.log("[RootLayout] Session already present, skipping callback completion");
          return;
        }

        const {
          code,
          accessToken,
          refreshToken
        } = extractAuthParams(url);
        console.log("[RootLayout] Callback params:", {
          hasCode: !!code,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken
        });

        if (accessToken && refreshToken) {
          const {
            error
          } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) throw error;
          return;
        }

        if (code) {
          const {
            error
          } = await supabase.auth.exchangeCodeForSession(url);
          if (error) throw error;
          return;
        }

        console.log("[RootLayout] Redirect URL had no code/tokens; waiting for auth state change");
      } catch (err) {
        console.error("[RootLayout] Exchange failed:", err);
      } finally {
        setExchangingSession(false);
      }
    };

    const subscription = Linking.addEventListener('url', ({
      url
    }) => handleUrl(url));
    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });
    return () => subscription.remove();
  }, []); // Auth state listener

  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      console.log("[RootLayout] Initial session check:", session ? "Found" : "Null");

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          role: session.user.user_metadata?.role
        });
      }

      setReady(true);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[RootLayout] Auth state changed:", event, session ? "Session Found" : "No Session");

      if (event === "PASSWORD_RECOVERY") {
        router.push("/reset-password");
        return;
      }

      if (session?.user) {
        console.log("[RootLayout] Setting user. Role:", session.user.user_metadata?.role);
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          role: session.user.user_metadata?.role
        });
      } else {
        console.log("[RootLayout] Setting user to null");
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // Routing logic

  useEffect(() => {
    // Don't route while session is being exchanged or app isn't ready
    if (!ready || exchangingSession) return;
    const inDoctorGroup = segments[0] === "(doctor)";
    const inResetPassword = segments[0] === "reset-password";
    const inSetupProfile = segments[0] === "setup-profile";
    console.log("[RootLayout] Routing - Ready:", ready, "User:", !!user, "Segments:", segments);
    if (inResetPassword) return;

    if (!user) {
      if (inDoctorGroup || inSetupProfile) {
        console.log("[RootLayout] No user, routing to /");
        router.replace("/");
      }
    } else {
      if (!inDoctorGroup && !inSetupProfile) {
        console.log("[RootLayout] User found, checking doctor profile...");
        supabase.from("doctors").select("id").eq("user_id", user.id).single().then(({
          data,
          error
        }) => {
          if (error?.code === "PGRST116" || !data) {
            console.log("[RootLayout] No profile, routing to /setup-profile");
            router.replace("/setup-profile");
          } else {
            console.log("[RootLayout] Profile found, routing to dashboard");
            router.replace("/(doctor)/dashboard");
          }
        });
      }
    }
  }, [user, ready, segments, exchangingSession]);
  if (!ready) return null;
  return <GestureHandlerRootView style={{
    flex: 1
  }}>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </GestureHandlerRootView>;
}