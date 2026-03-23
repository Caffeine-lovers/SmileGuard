import { useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase.ts";

export default function PatientLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
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
