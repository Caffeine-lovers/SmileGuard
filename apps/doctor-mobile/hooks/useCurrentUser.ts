import { useEffect, useState } from "react";
import { supabase } from "@smileguard/supabase-client";
import { CurrentUser } from "../types/index";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const resolveUser = async (sessionUser: any) => {
      if (!sessionUser) {
        setUser(null);
        return;
      }

      let resolvedRole = sessionUser.user_metadata?.role || "doctor";

      try {
        // Authoritative doctor check: verify if doctor record exists in doctors table
        const { data: doctorRecord } = await supabase
          .from("doctors")
          .select("id")
          .eq("user_id", sessionUser.id)
          .maybeSingle();

        if (doctorRecord) {
          resolvedRole = "doctor";
          // If auth metadata was stuck as 'patient' (e.g. from Google OAuth), synchronize it
          if (sessionUser.user_metadata?.role !== "doctor") {
            console.log("[useCurrentUser] Synchronizing auth user_metadata role to 'doctor'");
            supabase.auth.updateUser({ data: { role: "doctor" } }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn("[useCurrentUser] Could not check doctors table:", err);
      }

      setUser({
        id: sessionUser.id,
        email: sessionUser.email!,
        name: sessionUser.user_metadata?.name,
        role: resolvedRole,
      });
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) {
        resolveUser(session.user);
      }
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_OUT") {
          console.log("[useCurrentUser] User signed out");
          setUser(null);
        } else if (session?.user) {
          console.log("[useCurrentUser] Auth state changed, updating user:", session.user.id);
          resolveUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return user;
}
