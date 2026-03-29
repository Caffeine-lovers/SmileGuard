import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Navigation from "../components/landing/Nav-Bar.tsx";
import Hero from "../components/landing/Hero.tsx";
import HowItWorks from "../components/landing/HowItWorks.tsx";
import Footer from "../components/landing/Footer.tsx";
import AuthModal from "../components/auth/AuthModal.tsx";

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const openPortal = (role: "patient" | "doctor") => {
    // For doctor-mobile app, only doctors should open the portal
    if (role === "doctor") {
      setShowAuthModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        <Navigation onOpenPortal={openPortal} />
        <Hero onOpenPortal={() => openPortal("doctor")} />
        <View style={styles.content}>
          <HowItWorks />
        </View>
        <Footer />
      </ScrollView>

      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)} // root layout handles redirect
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { paddingBottom: 40 },
});