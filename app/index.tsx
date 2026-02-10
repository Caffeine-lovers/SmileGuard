import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// Components
import Navigation from "../components/landing/Nav-Bar";
import Hero from "../components/landing/Hero";
import HowItWorks from "../components/landing/HowItWorks";
import Footer from "../components/landing/Footer";
import AuthModal from "../components/auth/AuthModal";
import PatientDashboard from "../components/dashboard/PatientDashboard";
import DoctorDashboard from "../components/dashboard/DoctorDashboard";

// Hooks
import { useAuth } from "../hooks/useAuth";
import { CurrentUser } from "../types";

export default function LandingPage() {
  const { currentUser, setCurrentUser, login, register, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRole, setAuthRole] = useState<"patient" | "doctor">("patient");

  const openPortal = (role: "patient" | "doctor") => {
    setAuthRole(role);
    setShowAuthModal(true);
  };

// Handle successful login or registration by setting the current user and closing the modal

  const handleAuthSuccess = (userData: CurrentUser) => {
    setCurrentUser(userData);
    setShowAuthModal(false);
  };

  // --- VIEW LOGIC ---
  
  // If logged in, show the Dashboard instead of the Landing Page
  // This is a simple conditional render. In production, likely use React Navigation or a similar library for proper routing.
  if (currentUser) {
    return (
      <SafeAreaProvider>
        {currentUser.role === "doctor" ? (
          <DoctorDashboard user={currentUser} onLogout={logout} />
        ) : (
          <PatientDashboard user={currentUser} onLogout={logout} />
        )}
      </SafeAreaProvider>
    );
  }

  // Otherwise, show the actual Landing Page
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
          <Navigation onOpenPortal={openPortal} />
          <Hero onOpenPortal={() => openPortal("patient")} />
          
          <View style={styles.content}>
            <HowItWorks />
            {/* You can add more sections here like Testimonials or Pricing */}
          </View>
          
          <Footer />
        </ScrollView>

        <AuthModal
          visible={showAuthModal}
          role={authRole}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
          onLogin={login}
          onRegister={register}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingBottom: 40,
  }
});