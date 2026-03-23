import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase.ts";
import { CurrentUser } from "../types/index.ts";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check existing session on app load
    supabase.auth.getSession().then(({ data: { session } }: any) => {
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        if (event === "PASSWORD_RECOVERY") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (router as any).push("/reset-password");
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

    if (!user) {
      // Not logged in — send to landing if trying to access protected routes
      if (inPatientGroup || inDoctorGroup) {
        router.replace("/");
      }
    } else {
      // Logged in — send away from auth/landing screens
      if (!inPatientGroup && !inDoctorGroup) {
        if (user.role === "doctor") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (router as any).replace("/(doctor)/dashboard");
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (router as any).replace("/(patient)/dashboard");
        }
      }
    }
  }, [user, ready, segments]);

  if (!ready) return null; // or a splash screen

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
