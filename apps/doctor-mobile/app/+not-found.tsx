import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Fallback any unmatched routes safely back to root
    router.replace("/");
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
      <ActivityIndicator size="large" color="#00B4A0" />
    </View>
  );
}

