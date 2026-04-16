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
import { supabase } from '@smileguard/supabase-client';
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface FormData {
  name: string;
  email: string;
  phone: string;
  gender: string;
  notes: string;
  dateOfBirth: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  currentMedications: string;
  medicalConditions: string;
  pastSurgeries: string;
  smokingStatus: string;
  pregnancyStatus: string;
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    gender: "",
    notes: "",
    dateOfBirth: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    allergies: "",
    currentMedications: "",
    medicalConditions: "",
    pastSurgeries: "",
    smokingStatus: "",
    pregnancyStatus: "",
  });

  const genderOptions = ["Male", "Female", "Other"];

  // Helper function to get the number of days in a month
  const getDaysInMonth = (month: number, year: number): number => {
    if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31; // Jan, Mar, May, Jul, Aug, Oct, Dec
    if ([4, 6, 9, 11].includes(month)) return 30; // Apr, Jun, Sep, Nov
    // February
    if (month === 2) {
      return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
    }
    return 30;
  };

  // Get valid days for the selected month/year
  const getValidDays = (): number[] => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  // Ensure selected day is valid for the current month
  const getValidDay = (): number => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    return Math.min(selectedDay, daysInMonth);
  };

  // Get valid months based on selected year
  const getValidMonths = (): number[] => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-indexed

    if (selectedYear === currentYear) {
      return Array.from({ length: currentMonth }, (_, i) => i + 1);
    }
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  // Get valid days based on selected year and month
  const getValidDaysWithLimit = (): number[] => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();

    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const maxDays = 
      selectedYear === currentYear && selectedMonth === currentMonth
        ? currentDay
        : daysInMonth;

    return Array.from({ length: maxDays }, (_, i) => i + 1);
  };

  const handleDatePickerConfirm = () => {
    const validDay = getValidDay();
    const dateString = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(validDay).padStart(2, "0")}`;
    handleInputChange("dateOfBirth", dateString);
    setShowDatePicker(false);
  };

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

      // Create patient in dummy_accounts table with minimal required fields
      const patientData: any = {
        patient_name: formData.name,
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        created_by: currentUser?.name || currentUser?.email || "Unknown Doctor",
      };

      // Add optional fields only if they have values
      if (formData.gender) patientData.gender = formData.gender;
      if (formData.dateOfBirth) patientData.date_of_birth = formData.dateOfBirth;
      if (formData.address) patientData.address = formData.address;
      if (formData.emergencyContactName) patientData.emergency_contact_name = formData.emergencyContactName;
      if (formData.emergencyContactPhone) patientData.emergency_contact_phone = formData.emergencyContactPhone;
      if (formData.allergies) patientData.alergies = formData.allergies;
      if (formData.currentMedications) patientData.current_medications = formData.currentMedications;
      if (formData.medicalConditions) patientData.medical_conditions = formData.medicalConditions;
      if (formData.pastSurgeries) patientData.past_surgeries = formData.pastSurgeries;
      if (formData.smokingStatus) patientData.smoking_status = formData.smokingStatus;
      if (formData.pregnancyStatus) patientData.pregnancy_status = formData.pregnancyStatus;
      if (formData.notes) patientData.notes = formData.notes;

      const { data: dummyData, error: dummyError } = await supabase
        .from("dummy_accounts")
        .insert([patientData])
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
              <Image
                source={require("../../assets/images/icon/close.png")}
                style={{ width: 20, height: 20, tintColor: "#0b7fab" }}
              />
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
                    <Image
                      source={require("../../assets/images/icon/close.png")}
                      style={{ width: 20, height: 20, tintColor: "#0b7fab" }}
                    />
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

          {/* Medical Information Section */}
          <View style={{ borderTopWidth: 1, borderTopColor: "#ddd", paddingTop: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#0b7fab", marginBottom: 12 }}>
              Medical Information
            </Text>

            {/* Date of Birth */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Date of Birth
              </Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
                onPress={() => {
                  // Initialize date picker with current formData value if available
                  if (formData.dateOfBirth) {
                    const [year, month, day] = formData.dateOfBirth.split("-").map(Number);
                    setSelectedYear(year);
                    setSelectedMonth(month);
                    setSelectedDay(day);
                  }
                  setShowDatePicker(true);
                }}
                disabled={loading}
              >
                <Text style={{ fontSize: 14, color: formData.dateOfBirth ? "#333" : "#999" }}>
                  {formData.dateOfBirth || "Select date"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Address */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Address
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab" }]}
                placeholder="Enter address"
                placeholderTextColor="#999"
                value={formData.address}
                onChangeText={(value) => handleInputChange("address", value)}
                editable={!loading}
              />
            </View>

            {/* Emergency Contact Name */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Emergency Contact Name
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab" }]}
                placeholder="Enter name"
                placeholderTextColor="#999"
                value={formData.emergencyContactName}
                onChangeText={(value) => handleInputChange("emergencyContactName", value)}
                editable={!loading}
              />
            </View>

            {/* Emergency Contact Phone */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Emergency Contact Phone
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab" }]}
                placeholder="Enter phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                value={formData.emergencyContactPhone}
                onChangeText={(value) => handleInputChange("emergencyContactPhone", value)}
                editable={!loading}
              />
            </View>

            {/* Allergies */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Allergies
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab", height: 80, textAlignVertical: "top" }]}
                placeholder="List any allergies (comma separated)"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                value={formData.allergies}
                onChangeText={(value) => handleInputChange("allergies", value)}
                editable={!loading}
              />
            </View>

            {/* Current Medications */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Current Medications
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab", height: 80, textAlignVertical: "top" }]}
                placeholder="List current medications"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                value={formData.currentMedications}
                onChangeText={(value) => handleInputChange("currentMedications", value)}
                editable={!loading}
              />
            </View>

            {/* Medical Conditions */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Medical Conditions
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab", height: 80, textAlignVertical: "top" }]}
                placeholder="List any medical conditions"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                value={formData.medicalConditions}
                onChangeText={(value) => handleInputChange("medicalConditions", value)}
                editable={!loading}
              />
            </View>

            {/* Past Surgeries */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Past Surgeries
              </Text>
              <TextInput
                style={[styles.input, { borderColor: "#0b7fab", height: 80, textAlignVertical: "top" }]}
                placeholder="List any past surgeries"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                value={formData.pastSurgeries}
                onChangeText={(value) => handleInputChange("pastSurgeries", value)}
                editable={!loading}
              />
            </View>

            {/* Smoking Status */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                Smoking Status
              </Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
                onPress={() => setShowGenderPicker(true)}
                disabled={loading}
              >
                <Text style={{ fontSize: 14, color: formData.smokingStatus ? "#333" : "#999" }}>
                  {formData.smokingStatus || "Select status"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Pregnancy Status (only if not male) */}
            {formData.gender?.toLowerCase() !== 'male' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8 }}>
                  Pregnancy Status
                </Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center', paddingVertical: 12 }]}
                  disabled={loading}
                >
                  <Text style={{ fontSize: 14, color: formData.pregnancyStatus ? "#333" : "#999" }}>
                    {formData.pregnancyStatus || "Select status"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal transparent={true} animationType="slide" visible={showDatePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ fontSize: 14, color: '#0b7fab', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Select Date of Birth</Text>
                <TouchableOpacity onPress={handleDatePickerConfirm}>
                  <Text style={{ fontSize: 14, color: '#0b7fab', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Picker Body */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8 }}>
                {/* Year Picker */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>Year</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 121 }, (_, i) => new Date().getFullYear() - 120 + i).map((year) => (
                      <TouchableOpacity
                        key={year}
                        style={{ paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => setSelectedYear(year)}
                      >
                        <Text style={{ fontSize: 16, color: selectedYear === year ? '#0b7fab' : '#999', fontWeight: selectedYear === year ? '600' : '400' }}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Month Picker */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>Month</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {getValidMonths().map((month) => (
                      <TouchableOpacity
                        key={month}
                        style={{ paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => {
                          setSelectedMonth(month);
                          // Adjust day if it exceeds the days in the new month
                          const daysInMonth = getDaysInMonth(month, selectedYear);
                          if (selectedDay > daysInMonth) {
                            setSelectedDay(daysInMonth);
                          }
                        }}
                      >
                        <Text style={{ fontSize: 16, color: selectedMonth === month ? '#0b7fab' : '#999', fontWeight: selectedMonth === month ? '600' : '400' }}>
                          {String(month).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Day Picker */}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>Day</Text>
                  <ScrollView style={{ height: 150 }} showsVerticalScrollIndicator={false}>
                    {getValidDaysWithLimit().map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={{ paddingVertical: 10, alignItems: 'center' }}
                        onPress={() => setSelectedDay(day)}
                      >
                        <Text style={{ fontSize: 16, color: selectedDay === day ? '#0b7fab' : '#999', fontWeight: selectedDay === day ? '600' : '400' }}>
                          {String(day).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
