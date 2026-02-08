import React, { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// Components
import Navigation from "./components/landing/Navigation";
import Hero from "./components/landing/Hero";
import HowItWorks from "./components/landing/HowItWorks";
import Footer from "./components/landing/Footer";
import AuthModal from "./components/auth/AuthModal";
import PatientDashboard from "./components/dashboard/PatientDashboard";
import DoctorDashboard from "./components/dashboard/DoctorDashboard";

// Hooks & Types
import { useAuth } from "./hooks/useAuth";

export default function App() {
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

  // If user is logged in, show their dashboard
  if (currentUser) {
    return currentUser.role === "doctor" ? (
      <DoctorDashboard user={currentUser} onLogout={logout} />
    ) : (
      <PatientDashboard user={currentUser} onLogout={logout} />
    );
  }

  // Landing page
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          <Navigation onOpenPortal={openPortal} />
          <Hero onOpenPortal={openPortal} />
          <HowItWorks />
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
});
