import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";
import { useAuth } from "../hooks/useAuth";

/**
 * Complete Profile Page
 * 
 * Shown to new users after OAuth sign-up to collect doctor information.
 * This is the equivalent of Step 2 in the AuthModal flow.
 */
export default function CompleteProfile() {
  const router = useRouter();
  const { currentUser: user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    specialization: "",
    licenseNumber: "",
    phoneNumber: "",
  });
  const [loading, setLoading] = useState(false);

  // We rely on _layout.tsx to handle the protective routing, 
  // so we don't kick the user out here while useAuth might still be initializing.
  React.useEffect(() => {
    console.log("[CompleteProfile] Mounted - user:", user?.email);
  }, [user]);

  const handleSubmit = async () => {
    try {
      console.log("[CompleteProfile] Form submission started");
      
      // Validate form
      if (!formData.name.trim()) {
        Alert.alert("Error", "Please enter your name");
        return;
      }
      if (!formData.specialization.trim()) {
        Alert.alert("Error", "Please enter your specialization");
        return;
      }
      if (!formData.licenseNumber.trim()) {
        Alert.alert("Error", "Please enter your license number");
        return;
      }

      setLoading(true);

      // Update Supabase user metadata
      console.log("[CompleteProfile] Updating user metadata...");
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: formData.name,
          specialization: formData.specialization,
          licenseNumber: formData.licenseNumber,
          phoneNumber: formData.phoneNumber,
        },
      });

      if (updateError) throw updateError;
      console.log("[CompleteProfile] User metadata updated");

      // Create or update doctor profile
      console.log("[CompleteProfile] Inserting doctor profile...");
      const { error: insertError } = await supabase.from("doctors").insert([
        {
          user_id: user?.id,
          name: formData.name,
          specialization: formData.specialization,
          license_number: formData.licenseNumber,
          phone_number: formData.phoneNumber,
        },
      ]);

      if (insertError && insertError.code !== "23505") {
        // 23505 is duplicate key error - if doctor exists, that's ok
        throw insertError;
      }
      console.log("[CompleteProfile] Doctor profile inserted");

      console.log("✅ Profile completed successfully");
      Alert.alert("Success", "Profile updated successfully!");

      // Navigate to dashboard
      console.log("[CompleteProfile] Routing to dashboard");
      router.replace("/(doctor)/dashboard");
    } catch (error) {
      console.error("❌ Error completing profile:", error);
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.modalFull}>
      <View style={styles.bordercard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepContent}>
            {/* App Logo/Name */}
            <View style={styles.logoSection}>
              <Text style={styles.appName}>SmileGuard</Text>
            </View>

            <View style={styles.header}>
              <Text style={styles.h2}> Doctor Professional Details</Text>
              <Text style={styles.subtitle}>
                Fill in your professional information
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dr. John Smith"
                  placeholderTextColor="#9ca3af"
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Specialization</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., General Dentistry"
                  placeholderTextColor="#9ca3af"
                  value={formData.specialization}
                  onChangeText={(text) =>
                    setFormData({ ...formData, specialization: text })
                  }
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>License Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your dental license number"
                  placeholderTextColor="#9ca3af"
                  value={formData.licenseNumber}
                  onChangeText={(text) =>
                    setFormData({ ...formData, licenseNumber: text })
                  }
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Phone Number (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor="#9ca3af"
                  value={formData.phoneNumber}
                  onChangeText={(text) =>
                    setFormData({ ...formData, phoneNumber: text })
                  }
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Complete Profile</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalFull: {
    flex: 1,
    padding: 30,
    backgroundColor: "#fff"
  },
  bordercard: {
    flex: 1,
    maxWidth: 540,
    alignSelf: "center",
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  stepContent: {
    marginTop: 20,
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 45,
    padding: 24,
    backgroundColor: "#fff",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0b7fab",
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  h2: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 15,
    paddingHorizontal: 16,
    height: 55,
    fontSize: 16,
    backgroundColor: "#f9fafb",
    color: "#1f2937",
  },
  btn: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 30,
    height: 56,
    borderWidth: 1,
    borderColor: "transparent",
    marginTop: 10,
  },
  primaryBtn: {
    backgroundColor: "#3b82f6",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
