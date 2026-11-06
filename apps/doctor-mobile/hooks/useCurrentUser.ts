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
        // 1. Check profiles table first to determine account role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, name")
          .eq("id", sessionUser.id)
          .maybeSingle();

        const roleCandidate = profile?.role || sessionUser.user_metadata?.role;

        // 2. Admin: fetch from admins table
        if (roleCandidate === "admin") {
          const { data: adminRecord } = await supabase
            .from("admins")
            .select("id, first_name, last_name, phone")
            .eq("user_id", sessionUser.id)
            .maybeSingle();

          const adminName = adminRecord
            ? `${adminRecord.first_name || ""} ${adminRecord.last_name || ""}`.trim()
            : profile?.name || sessionUser.user_metadata?.name;

          setUser({
            id: sessionUser.id,
            email: sessionUser.email!,
            name: adminName,
            role: "admin",
          });
          return;
        }

        // 3. Assistant: fetch from assistants table (with fallback to doctors table)
        if (roleCandidate === "assistant") {
          const { data: assistantRecord } = await supabase
            .from("assistants")
            .select("id, first_name, last_name, phone")
            .eq("user_id", sessionUser.id)
            .maybeSingle();

          if (assistantRecord) {
            const assistantName = `${assistantRecord.first_name || ""} ${assistantRecord.last_name || ""}`.trim();
            setUser({
              id: sessionUser.id,
              email: sessionUser.email!,
              name: assistantName || profile?.name || sessionUser.user_metadata?.name,
              role: "assistant",
            });
            return;
          }

          // Legacy fallback: check if still in doctors table with role = 'assistant'
          const { data: legacyDoctorRecord } = await supabase
            .from("doctors")
            .select("id, role, first_name, last_name")
            .or(`user_id.eq.${sessionUser.id},id.eq.${sessionUser.id}`)
            .maybeSingle();

          if (legacyDoctorRecord?.role === "assistant") {
            const legacyName = `${legacyDoctorRecord.first_name || ""} ${legacyDoctorRecord.last_name || ""}`.trim();
            setUser({
              id: sessionUser.id,
              email: sessionUser.email!,
              name: legacyName || profile?.name || sessionUser.user_metadata?.name,
              role: "assistant",
            });
            return;
          }
        }

        // 4. Doctor: fetch from doctors table
        const { data: doctorRecord } = await supabase
          .from("doctors")
          .select("id, role, first_name, last_name")
          .or(`user_id.eq.${sessionUser.id},id.eq.${sessionUser.id}`)
          .maybeSingle();

        const doctorTableRole = (
          doctorRecord?.role ||
          (doctorRecord as any)?.ROLE ||
          ""
        ).toString().trim().toLowerCase();

        if (doctorTableRole === "assistant") {
          resolvedRole = "assistant";
        } else if (doctorTableRole === "doctor" || doctorRecord) {
          resolvedRole = "doctor";
        } else if (profile?.role === "assistant") {
          resolvedRole = "assistant";
        } else if (profile?.role === "admin") {
          resolvedRole = "admin";
        } else {
          resolvedRole = "doctor";
        }

        const docName = doctorRecord
          ? `${doctorRecord.first_name || ""} ${doctorRecord.last_name || ""}`.trim()
          : profile?.name || sessionUser.user_metadata?.name;

        setUser({
          id: sessionUser.id,
          email: sessionUser.email!,
          name: docName || sessionUser.user_metadata?.name,
          role: resolvedRole,
        });
        return;
      } catch (err) {
        console.warn("[useCurrentUser] Could not check role-specific tables:", err);
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
