import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";

/**
 * This route handles the OAuth callback from Google
 * It closes the browser and lets AuthModal handle token processing via deep link listener
 */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const closeAndReturn = async () => {
      try {
        // Complete the browser session - this is critical for WebBrowser to return control
        await WebBrowser.maybeCompleteAuthSession();
        console.log("✅ WebBrowser session completed");

        // Wait a moment then navigate back
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        router.replace("/");
      } catch (error) {
        console.error("Error in callback:", error);
        router.replace("/");
      }
    };

    closeAndReturn();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
      <ActivityIndicator size="large" color="#0b7fab" />
      <Text style={{ color: "#fff", marginTop: 16, fontSize: 14 }}>Completing sign-in...</Text>
    </View>
  );
}



