import React, { useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import { Session } from "@supabase/supabase-js";

export default function PatientLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!session) {
        router.replace("/");
        return;
      }
      const role = session.user.user_metadata?.role;
      if (role !== "patient") {
        router.replace("/"); // wrong role
      }
    });
  }, []);

  return <Slot />;
}
