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
        // Check profiles table FIRST for admin — admins have no doctors-table row
        // and must never be silently routed into the doctor dashboard.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, name")
          .eq("id", sessionUser.id)
          .maybeSingle();

        if (profile?.role === "admin") {
          setUser({
            id: sessionUser.id,
            email: sessionUser.email!,
            name: sessionUser.user_metadata?.name || profile.name,
            role: "admin",
          });
          return;
        }

        // Check doctors table record and role (authoritative source of truth)
        const { data: doctorRecord } = await supabase
          .from("doctors")
          .select("id, role")
          .or(`user_id.eq.${sessionUser.id},id.eq.${sessionUser.id}`)
          .maybeSingle();

        const doctorRole = (
          doctorRecord?.role ||
          (doctorRecord as any)?.ROLE ||
          ""
        ).toString().trim().toLowerCase();

        if (doctorRole === "assistant") {
          resolvedRole = "assistant";
        } else if (doctorRole === "doctor") {
          resolvedRole = "doctor";
        } else if (profile?.role === "assistant" || sessionUser.user_metadata?.role === "assistant") {
          resolvedRole = "assistant";
        } else if (profile?.role === "doctor" || doctorRecord) {
          resolvedRole = "doctor";
        }
      } catch (err) {
        console.warn("[useCurrentUser] Could not check profiles or doctors table:", err);
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
