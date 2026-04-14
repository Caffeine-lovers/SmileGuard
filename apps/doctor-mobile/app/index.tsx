import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AuthModal from "../components/auth/AuthModal";

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(true);
  const router = useRouter();

  const openPortal = () => {
    setShowAuthModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(user) => {
          setShowAuthModal(false);
          // Root layout ignores navigation on index relative paths to prevent loops,
          // so we explicitly route upon successful login if user is a doctor.
          if (user?.role === "doctor") {
            router.replace("/(doctor)/dashboard");
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: "#fff" },
};