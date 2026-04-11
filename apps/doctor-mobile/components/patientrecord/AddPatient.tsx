import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from "../../lib/supabase";
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface FormData {
  name: string;
  email: string;
  phone: string;
  gender: string;
  notes: string;
}

interface AddPatientProps {
  onPatientAdded?: (patientId: string) => void;
}

export default function AddPatient({ onPatientAdded }: AddPatientProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    gender: "",
    notes: "",
  });

  const genderOptions = ["Male", "Female", "Other"];

  const handleInputChange = (field: keyof FormData, value: string) => {
    // Normalize email to lowercase
    if (field === 'email') {
      value = value.toLowerCase().trim();
    }
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddPatient = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      Alert.alert("Error", "Patient name is required");
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert("Error", "Email is required");
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert("Error", "Phone number is required");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      // Check if email already exists in dummy_accounts
      const { data: existingDummyAccount, error: checkDummyError } = await supabase
        .from("dummy_accounts")
        .select("id")
        .eq("email", formData.email.trim().toLowerCase())
        .single();

      if (existingDummyAccount) {
        Alert.alert("Error", "This email is already registered as a dummy patient");
        setLoading(false);
        return;
      }

      // Check if email already exists in profiles
      const { data: existingProfile, error: checkProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", formData.email.trim().toLowerCase())
        .single();

      if (existingProfile) {
        Alert.alert("Error", "This email is already registered as a patient");
        setLoading(false);
        return;
      }

      // Create patient in dummy_accounts table with new schema
      const { data: dummyData, error: dummyError } = await supabase
        .from("dummy_accounts")
        .insert([
          {
            patient_name: formData.name,
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone,
            gender: formData.gender || "",
            notes: formData.notes || "",
            created_by: currentUser?.name || currentUser?.email || "Unknown Doctor",
          },
        ])
        .select()
        .single();

      if (dummyError) {
        if (dummyError.message.includes("duplicate")) {
          Alert.alert("Error", "This email is already registered. Please use a different email.");
        } else {
          throw new Error(`Failed to create patient in dummy accounts: ${dummyError.message}`);
        }
        return;
      }

      if (!dummyData) {
        throw new Error("Failed to create patient in dummy accounts");
      }

      // Get the source to determine where to navigate back to
      const source = (params?.source as string) || 'records';
      console.log('📱 Patient created, source:', source, 'Patient ID:', dummyData.id);

      // If used as modal within appointmentAdd
      if (onPatientAdded) {
        console.log('📤 Patient added via modal callback');
        try {
          await AsyncStorage.setItem('newlyAddedPatientId', dummyData.id);
          console.log('💾 Stored newly added patient ID:', dummyData.id);
        } catch (error) {
          console.error('Error storing newly added patient ID:', error);
        }
        
        // Call the callback to close the modal
        onPatientAdded(dummyData.id);
        return;
      }

      // Otherwise, use traditional navigation flow
      Alert.alert("Success", "Patient added successfully", [
        {
          text: "OK",
          onPress: async () => {
            if (source === 'appointment') {
              // Store the newly added patient ID in AsyncStorage for appointmentAdd to pick up
              try {
                await AsyncStorage.setItem('newlyAddedPatientId', dummyData.id);
                console.log('💾 Stored newly added patient ID:', dummyData.id);
              } catch (error) {
                console.error('Error storing newly added patient ID:', error);
              }
            }
            
            router.back();

            // If returning to records tab, set the active tab param
            if (source !== 'appointment') {
              setTimeout(() => {
                router.setParams({ activeTab: 'records' });
              }, 100);
            }
          },
        },
      ]);
    } catch (error) {
      console.error("Error adding patient:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to add patient"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomColor: "#ddd", borderBottomWidth: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 25, fontWeight: "bold", color: "#0b7fab", marginBottom: 4 }}>
              Add New Patient
            </Text>
            <TouchableOpacity onPress={() => {
              if (onPatientAdded) {
                onPatientAdded('');  // Pass empty string to indicate cancel
              } else {
                router.back();
              }
            }}>
              <Text style={{ fontSize: 18, color: "#0b7fab", fontWeight: "600" }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form */}
        <View style={{ padding: 16 }}>
          {/* Patient Name */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
              Patient Name *
            </Text>
            <TextInput
              style={[styles.input, { borderColor: "#0b7fab" }]}
              placeholder="Enter patient's full name"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(value) => handleInputChange("name", value)}
              editable={!loading}
            />
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
              Email *
            </Text>
            <TextInput
              style={[styles.input, { borderColor: "#0b7fab" }]}
              placeholder="Enter patient's email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={formData.email}
              onChangeText={(value) => handleInputChange("email", value)}
              editable={!loading}
            />
          </View>

          {/* Phone */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
              Phone Number *
            </Text>
            <TextInput
              style={[styles.input, { borderColor: "#0b7fab" }]}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(value) => handleInputChange("phone", value)}
              editable={!loading}
            />
          </View>

          {/* Gender */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
              Gender
            </Text>
            <TouchableOpacity
              style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
              onPress={() => setShowGenderPicker(true)}
              disabled={loading}
            >
              <Text style={{ fontSize: 14, color: formData.gender ? "#333" : "#999" }}>
                {formData.gender || "Select gender"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Gender Picker Modal */}
          <Modal
            visible={showGenderPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowGenderPicker(false)}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
              <View style={{ backgroundColor: '#fff', paddingBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Select Gender</Text>
                  <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                    <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {genderOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                    onPress={() => {
                      handleInputChange('gender', option);
                      setShowGenderPicker(false);
                    }}
                  >
                    <Text style={{ fontSize: 14, color: formData.gender === option ? '#0b7fab' : '#333', fontWeight: formData.gender === option ? '600' : '400' }}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Modal>

          {/* Notes */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
              Medical Notes
            </Text>
            <TextInput
              style={[styles.input, { borderColor: "#0b7fab", height: 100, textAlignVertical: "top" }]}
              placeholder="Enter any relevant medical notes"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={formData.notes}
              onChangeText={(value) => handleInputChange("notes", value)}
              editable={!loading}
            />
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                if (onPatientAdded) {
                  onPatientAdded('');  // Pass empty string to indicate cancel
                } else {
                  router.back();
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0b7fab" />
              ) : (
                <Text style={{ color: "#0b7fab", fontWeight: "600", fontSize: 14 }}>Cancel</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleAddPatient}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Add Patient</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#333",
    borderColor: "#0b7fab",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#e8f4f8",
    borderWidth: 1,
    borderColor: "#0b7fab",
  },
  submitButton: {
    backgroundColor: "#0b7fab",
  },
});
