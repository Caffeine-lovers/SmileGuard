import { Alert, Platform } from "react-native";
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
        // The session will be automatically set by Supabase auth listener
        // Just log it so we know it arrived
      }
    });

    // Also check if app was launched FROM a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (isOAuthUrl(url)) {
        console.log("[RootLayout] App opened via deep link:", url);
      }
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
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("[RootLayout] Cold start notification response:", response.notification.request.content);
        const data = response.notification.request.content.data;
        handleNotificationData(data);
      }
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
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        console.log("[RootLayout] Auth state changed:", event, session ? "Session Found" : "No Session");
        if (event === "PASSWORD_RECOVERY") {
          router.push("/reset-password");
          return;
        }
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
    const inResetPassword = segments[0] === "reset-password";
    const inSetupProfile = segments[0] === "setup-profile";
    const inOAuthRedirect = segments[0] === "oauth-redirect";
    const inOnboarding = segments[0] === "onboarding";

    console.log("[RootLayout] Routing logic - Ready:", ready, "User:", !!user, "Segments:", segments);

    // Routing is paused during password reset or initial onboarding tour
    // We only pause routing logic if on reset-password or onboarding
    if (inResetPassword || inOnboarding) return;

    if (!user) {
      if (inDoctorGroup || inAdminGroup || inSetupProfile) {
        console.log("[RootLayout] No user, routing to /");
        router.replace("/");
      }
    } else {
      if (inAdminGroup) return; // (admin)/_layout.tsx owns its own guard

      if (!inDoctorGroup && !inSetupProfile) {
        console.log("[RootLayout] User exists, checking profile before dashboard...");
        (async () => {
          try {
            const [savedCodeRaw, savedRole] = await Promise.all([
              AsyncStorage.getItem("@pending_doctor_access_code"),
              AsyncStorage.getItem("@pending_user_role"),
            ]);
            const savedCode = (savedCodeRaw || "").trim().toUpperCase();

            // 0. Authoritative admin check — admins are profiles-only rows (no
            // doctors-table record), so they must be routed before the doctor
            // lookup below, which would otherwise bounce them to /setup-profile.
            const { data: adminProfile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();

            // (admin)/_layout.tsx confirms this with the server before showing anything.
            if (adminProfile?.role === "admin" || savedRole === "admin") {
              console.log("[RootLayout] Admin user detected, routing to /(admin)/dashboard");
              router.replace("/(admin)/dashboard");
              return;
            }

            // 1. Authoritative check directly on public.doctors table (ignoring profiles table)
            console.log("[RootLayout] Querying doctors table for user_id:", user.id);
            const { data: doctorRecord, error: doctorErr } = await supabase
              .from("doctors")
              .select("*")
              .or(`user_id.eq.${user.id},id.eq.${user.id}`)
              .maybeSingle();

            if (doctorErr) {
              console.warn("[RootLayout] Error querying doctors table:", doctorErr);
            }

            // If no record found in doctors table, route to profile setup
            if (!doctorRecord) {
              console.log("[RootLayout] No doctor profile found in doctors table, routing to /setup-profile");
              router.replace("/setup-profile");
              return;
            }

            // Extract the role specifically from the doctors table
            const doctorTableRole = (
              doctorRecord.role ||
              (doctorRecord as any).ROLE ||
              (doctorRecord as any).Role ||
              ""
            ).toString().trim().toLowerCase();

            console.log("[RootLayout] doctors table role:", doctorTableRole, "| entered access code:", savedCode);

            // 2. Authoritative check: verify access code entered aligns with doctors.role
            if (savedCode.length > 0) {
              const isAssistantCode = savedRole === "assistant";
              const isDoctorCode = savedRole === "doctor";

              const handleAccessBlock = (message: string) => {
                Alert.alert(
                  "Access Blocked",
                  message,
                  [
                    {
                      text: "OK",
                      onPress: async () => {
                        try {
                          await supabase.auth.signOut();
                          await AsyncStorage.multiRemove([
                            "supabase.auth.token",
                            "supabase.auth.refreshToken",
                            "supabase.auth.user",
                            "@pending_doctor_access_code",
                            "@pending_user_role",
                          ]);
                        } catch (e) {
                          console.warn("[RootLayout] Sign out error on access block:", e);
                        } finally {
                          router.replace("/");
                        }
                      },
                    },
                  ],
                  { cancelable: false }
                );
              };

              // Case A: User entered an assistant access code, but doctors table says 'doctor'
              if (isAssistantCode && doctorTableRole === "doctor") {
                console.warn("[RootLayout] Access Blocked: assistant code entered for doctor role in doctors table");
                handleAccessBlock(
                  "This account is registered as a Doctor. Please use your Doctor Clinic Access Code to log in."
                );
                return;
              }

              // Case B: User entered a doctor access code, but doctors table says 'assistant'
              if (isDoctorCode && doctorTableRole === "assistant") {
                console.warn("[RootLayout] Access Blocked: Doctor code entered for assistant role in doctors table");
                handleAccessBlock(
                  "This account is registered as a Clinic Assistant. Please use your Assistant Access Code to log in."
                );
                return;
              }
            }

            // 3. Roles align: log the sign-in, clear pending code and proceed to dashboard
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
