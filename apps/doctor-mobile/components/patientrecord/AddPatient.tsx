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
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface FormData {
  name: string;
  email: string;
  phone: string;
  gender: string;
  service: string;
  notes: string;
}

export default function AddPatient() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    gender: "",
    service: "",
    notes: "",
  });

  const genderOptions = ["Male", "Female", "Other"];
  const serviceOptions = ["Cleaning", "Whitening", "Fillings", "Root Canal", "Extraction", "Braces Consultation", "Implants Consultation",
    "X-Ray", "Checkup"];

  const handleInputChange = (field: keyof FormData, value: string) => {
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

    setLoading(true);
    try {
      // Create patient in dummy_accounts table with new schema
      const { data: dummyData, error: dummyError } = await supabase
        .from("dummy_accounts")
        .insert([
          {
            patient_name: formData.name,
            email: formData.email,
            phone: formData.phone,
            gender: formData.gender || "",
            service: formData.service || "General",
            notes: formData.notes || "",
            created_by: currentUser?.name || currentUser?.email || "Unknown Doctor",
          },
        ])
        .select()
        .single();

      if (dummyError) {
        throw new Error(`Failed to create patient in dummy accounts: ${dummyError.message}`);
      }

      if (!dummyData) {
        throw new Error("Failed to create patient in dummy accounts");
      }

      Alert.alert("Success", "Patient added successfully to dummy accounts", [
        {
          text: "OK",
          onPress: () => {
            router.back();
            // Pass a parameter to the dashboard to show records tab
            router.setParams({ activeTab: 'records' });
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
            <TouchableOpacity onPress={() => router.back()}>
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

          {/* Service */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
              Service Type
            </Text>
            <TouchableOpacity
              style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
              onPress={() => setShowServicePicker(true)}
              disabled={loading}
            >
              <Text style={{ fontSize: 14, color: formData.service ? "#333" : "#999" }}>
                {formData.service || "Select service type"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Service Picker Modal */}
          <Modal
            visible={showServicePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowServicePicker(false)}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
              <View style={{ backgroundColor: '#fff', paddingBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Select Service Type</Text>
                  <TouchableOpacity onPress={() => setShowServicePicker(false)}>
                    <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {serviceOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                    onPress={() => {
                      handleInputChange('service', option);
                      setShowServicePicker(false);
                    }}
                  >
                    <Text style={{ fontSize: 14, color: formData.service === option ? '#0b7fab' : '#333', fontWeight: formData.service === option ? '600' : '400' }}>
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
              onPress={() => router.back()}
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
