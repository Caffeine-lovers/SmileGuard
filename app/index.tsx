import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// Components
import Navigation from "../components/landing/Navigation";
import Hero from "../components/landing/Hero";
import HowItWorks from "../components/landing/HowItWorks";
import Footer from "../components/landing/Footer";
import AuthModal from "../components/auth/AuthModal";
import PatientDashboard from "../components/dashboard/PatientDashboard";
import DoctorDashboard from "../components/dashboard/DoctorDashboard";

// Hooks
import { useAuth } from "../hooks/useAuth";

export default function LandingPage() {
  const { currentUser, setCurrentUser, login, register, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRole, setAuthRole] = useState<"patient" | "doctor">("patient");

  const openPortal = (role: "patient" | "doctor") => {
    setAuthRole(role);
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (userData: { name: string; email: string; role: string }) => {
    setCurrentUser(userData);
    setShowAuthModal(false);
  };

  // --- VIEW LOGIC ---
  
  // If logged in, show the Dashboard instead of the Landing Page
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