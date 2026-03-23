import { useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase.ts";

export default function DoctorLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) {
        router.replace("/");
        return;
      }
      if (session.user.user_metadata?.role !== "doctor") {
        router.replace("/");
      }
    });
  }, []);

  return <Slot />;
}
