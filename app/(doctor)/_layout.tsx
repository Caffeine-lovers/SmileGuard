import React, { useEffect, useState } from "react";
import { Slot, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase.ts";
import { Session } from "@supabase/supabase-js";
import { ActivityIndicator, View } from "react-native";

export default function DoctorLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user?.user_metadata?.role;
      if (!session || role !== "doctor") {
        router.replace("/");
        return;
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0b7fab" />
      </View>
    );
  }

  return <Slot />;
}