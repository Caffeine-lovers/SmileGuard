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

  // Redirect to dashboard if no user
  React.useEffect(() => {
    console.log("[CompleteProfile] Mounted - user:", user?.email);
    if (!user) {
      console.log("[CompleteProfile] No user, routing to /");
      router.replace("/");
    }
  }, [user, router]);

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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Help us set up your doctor account
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. John Smith"
              value={formData.name}
              onChangeText={(text) =>
                setFormData({ ...formData, name: text })
              }
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Specialization</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., General Dentistry"
              value={formData.specialization}
              onChangeText={(text) =>
                setFormData({ ...formData, specialization: text })
              }
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>License Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Your dental license number"
              value={formData.licenseNumber}
              onChangeText={(text) =>
                setFormData({ ...formData, licenseNumber: text })
              }
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 (555) 123-4567"
              value={formData.phoneNumber}
              onChangeText={(text) =>
                setFormData({ ...formData, phoneNumber: text })
              }
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Complete Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
