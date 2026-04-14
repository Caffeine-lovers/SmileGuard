import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthModal from "../components/auth/AuthModal";

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(true);

  const openPortal = () => {
    setShowAuthModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)} // root layout handles redirect
      />
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: "#fff" },
};