import { Alert, Platform, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@smileguard/supabase-client";
import { CurrentUser } from "../types/index";
import { Session } from "@supabase/supabase-js";
import { ClinicProvider } from "../contexts/ClinicContext";
import { registerForPushNotificationsAsync } from "../lib/pushNotificationService";
// Importing this module swaps the native Alert for the themed dialog app-wide
import AppAlertHost from "../components/ui/AppAlertHost";
import AppUpdateManager from "../components/ui/AppUpdateManager";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  // Listen for deep links from OAuth redirects
  useEffect(() => {
    const isOAuthUrl = (urlString?: string | null) => {
      if (!urlString) return false;
      return (
        urlString.includes("smileguard://") ||
        urlString.includes("smileguard-doctor://") ||
        urlString.includes("oauth-redirect") ||
        urlString.includes("redirect")
      );
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log("[RootLayout] Deep link received:", url);

      if (isOAuthUrl(url)) {
        console.log("[RootLayout] OAuth redirect detected");
      }
    });

    // Also check if app was launched FROM a deep link (cold start)
    Linking.getInitialURL()
      .then((url) => {
        if (isOAuthUrl(url)) {
          console.log("[RootLayout] App opened via deep link:", url);
        }
      })
      .catch((err) => {
        console.warn("[RootLayout] getInitialURL error:", err);
      });

    return () => subscription.remove();
  }, []);

  // Listen for user clicking a push notification while outside the app (background or quit state)
  useEffect(() => {
    const handleNotificationData = (data: any) => {
      if (!data) return;
      const appointmentId = data.appointmentId || data.id;
      if (appointmentId) {
        router.push({
          pathname: "/(doctor)/dashboard",
          params: { promptAppointmentId: appointmentId },
        });
      } else if (data?.screen === "dashboard") {
        router.push("/(doctor)/dashboard");
      }
    };

    // 1. App running or background: user tapped status bar notification
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("[RootLayout] Push notification tapped:", response.notification.request.content);
      const data = response.notification.request.content.data;
      handleNotificationData(data);
    });

    // 2. Cold start (app was fully closed when notification tapped)
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          console.log("[RootLayout] Cold start notification response:", response.notification.request.content);
          const data = response.notification.request.content.data;
          handleNotificationData(data);
        }
      })
      .catch((err) => {
        console.warn("[RootLayout] getLastNotificationResponseAsync error:", err);
      });

    return () => {
      responseSubscription.remove();
    };
  }, [router]);

  // Register push notifications when user is authenticated
  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        console.log("[RootLayout] Initial session check:", session ? "Found" : "Null");
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            role: session.user.user_metadata?.role || "doctor",
          });
        }
        setReady(true);
      })
      .catch((err) => {
        console.warn("[RootLayout] Initial getSession error:", err);
        setReady(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        console.log("[RootLayout] Auth state changed:", event, session ? "Session Found" : "No Session");

        if (session?.user) {
          console.log("[RootLayout] Setting user from auth state:", session.user.email);
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            role: session.user.user_metadata?.role || "doctor",
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
    const inAdminGroup = segments[0] === "(admin)";
    const inSetupProfile = segments[0] === "setup-profile";
    const inOAuthRedirect = segments[0] === "oauth-redirect" || segments[0] === "redirect";
    const inOnboarding = segments[0] === "onboarding";

    console.log("[RootLayout] Routing logic - Ready:", ready, "User:", !!user, "Segments:", segments);

    // Routing is paused during OAuth redirect and initial onboarding tour
    if (inOAuthRedirect || inOnboarding) return;

    if (!user) {
      if (inDoctorGroup || inAdminGroup || inSetupProfile) {
        console.log("[RootLayout] No user, routing to /");
        router.replace("/");
      }
    } else {
      if (inAdminGroup) {
        (async () => {
          const [activeRole, pendingRole] = await Promise.all([
            AsyncStorage.getItem("@active_session_role"),
            AsyncStorage.getItem("@pending_user_role"),
          ]);
          const currentRole = activeRole || pendingRole;
          if (currentRole && currentRole !== "admin") {
            console.log("[RootLayout] User in admin group with non-admin token, routing to /(doctor)/dashboard");
            router.replace("/(doctor)/dashboard");
          }
        })();
        return;
      }

      if (!inDoctorGroup && !inSetupProfile) {
        console.log("[RootLayout] User exists, checking profile before dashboard...");
        (async () => {
          try {
            const [savedCodeRaw, savedRole, activeRoleRaw, activeCodeRaw] = await Promise.all([
              AsyncStorage.getItem("@pending_doctor_access_code"),
              AsyncStorage.getItem("@pending_user_role"),
              AsyncStorage.getItem("@active_session_role"),
              AsyncStorage.getItem("@active_access_code"),
            ]);
            const savedCode = (savedCodeRaw || activeCodeRaw || "").trim().toUpperCase();
            const tokenRole = savedRole || activeRoleRaw;

            // 0. Check profiles table first
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();

            // The access code token acts on which dashboard is showing!
            const effectiveRole = tokenRole || profile?.role || "doctor";

            // Case A: ADMIN LOGIN -> token is admin
            if (effectiveRole === "admin") {
              await AsyncStorage.setItem("@active_session_role", "admin");
              if (savedCode) {
                await AsyncStorage.setItem("@active_access_code", savedCode);
                try {
                  await supabase.rpc("claim_admin_access", {
                    p_code: savedCode,
                    p_platform: Platform.OS,
                  });
                } catch (e) {
                  console.warn("[RootLayout] claim_admin_access note:", e);
                }
              }

              if (profile?.role !== "admin") {
                await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
              }

              await AsyncStorage.multiRemove(["@pending_doctor_access_code", "@pending_user_role"]);
              console.log("[RootLayout] Admin user detected, routing to /(admin)/dashboard");
              router.replace("/(admin)/dashboard");
              return;
            }

            // Case B: ASSISTANT LOGIN -> token is assistant
            if (effectiveRole === "assistant") {
              await AsyncStorage.setItem("@active_session_role", "assistant");
              if (savedCode) {
                await AsyncStorage.setItem("@active_access_code", savedCode);
              }

              console.log("[RootLayout] Querying assistants table for user_id:", user.id);
              const { data: assistantRecord } = await supabase
                .from("assistants")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

              if (!assistantRecord) {
                console.log("[RootLayout] No assistant profile found, routing to /setup-profile");
                router.replace("/setup-profile");
                return;
              }

              // Synchronize profiles table role so it reflects the assistant token for this session
              if (profile?.role !== "assistant") {
                await supabase.from("profiles").update({ role: "assistant" }).eq("id", user.id);
              }

              if (savedCode) {
                try {
                  await supabase.rpc("record_code_sign_in", {
                    p_code: savedCode,
                    p_platform: Platform.OS,
                  });
                } catch (e) {
                  console.warn("[RootLayout] record_code_sign_in note:", e);
                }
              }
              await AsyncStorage.multiRemove(["@pending_doctor_access_code", "@pending_user_role"]);
              console.log("[RootLayout] Assistant profile confirmed, routing to /(doctor)/dashboard");
              router.replace("/(doctor)/dashboard");
              return;
            }

            // Case C: DOCTOR LOGIN -> token is doctor
            await AsyncStorage.setItem("@active_session_role", "doctor");
            if (savedCode) {
              await AsyncStorage.setItem("@active_access_code", savedCode);
            }

            console.log("[RootLayout] Querying doctors table for user_id:", user.id);
            const { data: doctorRecord, error: doctorErr } = await supabase
              .from("doctors")
              .select("*")
              .or(`user_id.eq.${user.id},id.eq.${user.id}`)
              .maybeSingle();

            if (doctorErr) {
              console.warn("[RootLayout] Error querying doctors table:", doctorErr);
            }

            if (!doctorRecord) {
              console.log("[RootLayout] No doctor profile found in doctors table, routing to /setup-profile");
              router.replace("/setup-profile");
              return;
            }

            // Synchronize profiles table role so it reflects the doctor token for this session
            if (profile?.role !== "doctor") {
              await supabase.from("profiles").update({ role: "doctor" }).eq("id", user.id);
            }

            if (savedCode) {
              const { error: signInLogError } = await supabase.rpc("record_code_sign_in", {
                p_code: savedCode,
                p_platform: Platform.OS,
              });
              if (signInLogError) {
                console.warn("[RootLayout] Could not log sign-in:", signInLogError.message);
              }
            }
            await AsyncStorage.multiRemove(["@pending_doctor_access_code", "@pending_user_role"]);
            console.log("[RootLayout] Profile and access code role aligned, routing to /(doctor)/dashboard");
            router.replace("/(doctor)/dashboard");
          } catch (err) {
            console.error("[RootLayout] Error verifying doctor profile alignment:", err);
            router.replace("/setup-profile");
          }
        })();
      }
    }
  }, [user, ready, segments]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClinicProvider>
          <Slot />
          <AppAlertHost />
          <AppUpdateManager />
        </ClinicProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}


export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error?.message || "An unexpected error occurred."}</Text>
      <TouchableOpacity style={errorStyles.button} onPress={retry} activeOpacity={0.8}>
        <Text style={errorStyles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#00B4A0",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
});
