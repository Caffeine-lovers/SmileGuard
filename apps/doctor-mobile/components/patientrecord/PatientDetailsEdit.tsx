import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppointmentType } from "./PatientDetailsView";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const PHILIPPINES_PHONE_REGEX = /^\+639\d{2}-\d{3}-\d{4}$/;

interface PatientDetailsEditProps {
  visible: boolean;
  patient: AppointmentType | null;
  onClose: () => void;
  onSave: (updatedPatient: AppointmentType) => void;
}

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

export default function PatientDetailsEdit({ 
  visible, 
  patient, 
  onClose, 
  onSave 
}: PatientDetailsEditProps) {
  const [editedPatient, setEditedPatient] = useState<AppointmentType | null>(null);
  const [originalPatient, setOriginalPatient] = useState<AppointmentType | null>(null);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  useEffect(() => {
    if (visible && patient) {
      setEditedPatient({ ...patient });
      setOriginalPatient({ ...patient });
      // Initialize date picker with patient's DOB if available
      if (patient.dateOfBirth) {
        const [year, month, day] = patient.dateOfBirth.split("-").map(Number);
        setSelectedYear(year);
        setSelectedMonth(month);
        setSelectedDay(day);
      } else {
        const now = new Date();
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth() + 1);
        setSelectedDay(now.getDate());
      }
    }
  }, [visible, patient]);

  const handleSave = () => {
    if (editedPatient) {
      // Validate required fields
      if (!editedPatient.dateOfBirth || editedPatient.dateOfBirth.trim() === "") {
        Alert.alert("Validation Error", "Date of Birth is required");
        return;
      }
      if (!editedPatient.gender || editedPatient.gender.trim() === "") {
        Alert.alert("Validation Error", "Gender is required");
        return;
      }
      if (!editedPatient.address || editedPatient.address.trim() === "") {
        Alert.alert("Validation Error", "Address is required");
        return;
      }
      if (editedPatient.contact && !PHILIPPINES_PHONE_REGEX.test(editedPatient.contact)) {
        Alert.alert("Validation Error", "Phone must be in Philippines format: +639XXX-XXX-XXXX");
        return;
      }
      onSave(editedPatient);
      Alert.alert("Success", "Patient information updated successfully.");
      setPhoneError("");
      onClose();
    }
  };

  const handleCancel = () => {
    setShowGenderDropdown(false);
    setPhoneError("");
    onClose();
  };

  const handleDateChange = (text: string) => {
    if (editedPatient) {
      setEditedPatient({ ...editedPatient, dateOfBirth: text });
    }
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
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const validDay = Math.min(selectedDay, daysInMonth);
    const dateString = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(validDay).padStart(2, "0")}`;
    if (editedPatient) {
      setEditedPatient({ ...editedPatient, dateOfBirth: dateString });
    }
    setShowDatePicker(false);
  };

  const handlePhoneChange = (text: string) => {
    if (editedPatient) {
      // Remove all non-digit characters
      let cleaned = text.replace(/[^\d]/g, '');
      
      // Remove leading 0 if it starts with 0 (common in Philippines)
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
      }
      // Also remove leading 9 if the user types it since +639 is already there
      if (cleaned.startsWith('9')) {
        cleaned = cleaned.slice(1);
      }
      
      // Only keep up to 9 digits (since prefix already has +639)
      cleaned = cleaned.slice(0, 9);
      
      // Format as XX-XXX-XXXX (only the digits part)
      let formatted = cleaned;
      if (cleaned.length > 2) {
        // XX-
        formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2);
      }
      if (cleaned.length > 5) {
        // XX-XXX-
        formatted = cleaned.slice(0, 2) + '-' + cleaned.slice(2, 5) + '-' + cleaned.slice(5);
      }
      
      const fullNumber = '+639' + formatted;
      setEditedPatient({ ...editedPatient, contact: fullNumber });
      
      // Validate only if input is complete (9 digits)
      if (cleaned.length === 9) {
        if (!PHILIPPINES_PHONE_REGEX.test(fullNumber)) {
          setPhoneError("Phone must be in format: +639XX-XXX-XXXX");
        } else {
          setPhoneError("");
        }
      } else {
        setPhoneError("");
      }
    }
  };

  const handleEmergencyContactPhoneChange = (text: string) => {
    // Remove all non-digit characters
    let cleaned = text.replace(/[^\d]/g, '');
    
    // Limit to 11 digits
    cleaned = cleaned.slice(0, 11);
    
    if (editedPatient) {
      setEditedPatient({ ...editedPatient, emergencyContactPhone: cleaned });
    }
  };

  const isMale = editedPatient?.gender?.toLowerCase() === "male";

  // Helper function to get field style based on completion status
  const getRequiredFieldStyle = (value: string, isValid: boolean = true) => {
    const isComplete = value && value.trim().length > 0 && isValid;
    return {
      borderColor: isComplete ? "#4caf50" : "#ff9800",
      backgroundColor: isComplete ? "#e8f5e9" : "#fff3e0",
    };
  };

  // Helper function to check if a field has been changed
  const isFieldChanged = (fieldName: keyof AppointmentType): boolean => {
    if (!originalPatient || !editedPatient) return false;
    return originalPatient[fieldName] !== editedPatient[fieldName];
  };

  // Helper function to get conditional style for changed fields
  const getFieldStyle = (fieldName: keyof AppointmentType) => {
    if (isFieldChanged(fieldName)) {
      return { backgroundColor: "#fffacd" }; // Light yellow for edited fields
    }
    return { backgroundColor: "#fff" }; // White for unchanged fields
  };

  if (!editedPatient) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Image
              source={require("../../assets/images/icon/back.png")}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Patient</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Edit Form */}
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.section}>
            <Text style={styles.label}>
              Date of Birth: <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.requiredInput, getRequiredFieldStyle(editedPatient.dateOfBirth || '')]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: editedPatient.dateOfBirth ? "#333" : "#999", fontSize: 14 }}>
                {editedPatient.dateOfBirth || "Select date"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Gender: <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.requiredInput, getRequiredFieldStyle(editedPatient.gender || '')]}
              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
            >
              <Text style={{ color: editedPatient.gender ? "#333" : "#999", fontSize: 14 }}>
                {editedPatient.gender || "Select gender"}
              </Text>
            </TouchableOpacity>
            {showGenderDropdown && (
              <View style={styles.dropdown}>
                {GENDER_OPTIONS.map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setEditedPatient({ ...editedPatient, gender });
                      setShowGenderDropdown(false);
                    }}
                  >
                    <Text>{gender}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Phone: <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <View style={[styles.phoneInputContainer, styles.requiredPhoneContainer, getRequiredFieldStyle(editedPatient.contact || '', !phoneError && PHILIPPINES_PHONE_REGEX.test(editedPatient.contact || '')), phoneError ? { borderColor: "#ff6b6b" } : {}]}>
              <Text style={styles.phonePrefix}>+639</Text>
              <TextInput
                style={styles.phoneInput}
                value={editedPatient.contact ? editedPatient.contact.replace('+639', '') : ''}
                onChangeText={handlePhoneChange}
                placeholder="XX-XXX-XXXX"
                keyboardType="phone-pad"
              />
            </View>
            {phoneError ? (
              <Text style={styles.errorText}>{phoneError}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Address: <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
            <TextInput
              style={[styles.requiredInput, getRequiredFieldStyle(editedPatient.address || ''), { minHeight: 60, textAlignVertical: "top" }]}
              value={editedPatient.address || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, address: text })
              }
              placeholder="Enter address"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Emergency Contact Name:</Text>
            <TextInput
              style={[styles.input, getFieldStyle('emergencyContactName')]}
              value={editedPatient.emergencyContactName || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, emergencyContactName: text })
              }
              placeholder="Enter emergency contact name"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Emergency Contact Phone:</Text>
            <TextInput
              style={[styles.input, getFieldStyle('emergencyContactPhone')]}
              value={editedPatient.emergencyContactPhone || ""}
              onChangeText={handleEmergencyContactPhoneChange}
              placeholder="Enter phone number (10-11 digits)"
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Allergies:</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }, getFieldStyle('allergies')]}
              value={editedPatient.allergies || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, allergies: text })
              }
              placeholder="Enter allergies"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Current Medications:</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }, getFieldStyle('currentMedications')]}
              value={editedPatient.currentMedications || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, currentMedications: text })
              }
              placeholder="Enter current medications"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Medical Conditions:</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }, getFieldStyle('medicalConditions')]}
              value={editedPatient.medicalConditions || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, medicalConditions: text })
              }
              placeholder="Enter medical conditions"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Past Surgeries:</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }, getFieldStyle('pastSurgeries')]}
              value={editedPatient.pastSurgeries || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, pastSurgeries: text })
              }
              placeholder="Enter past surgeries"
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Smoking Status:</Text>
            <View style={styles.statusContainer}>
              {(["never", "former", "current"] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor:
                        editedPatient.smokingStatus === status
                          ? "#0b7fab"
                          : "#e0e0e0",
                    },
                  ]}
                  onPress={() =>
                    setEditedPatient({ ...editedPatient, smokingStatus: status })
                  }
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      {
                        color:
                          editedPatient.smokingStatus === status ? "#fff" : "#333",
                      },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!isMale && (
            <View style={styles.section}>
              <Text style={styles.label}>Pregnancy Status:</Text>
              <View style={styles.statusContainer}>
                {(["yes", "no", "na"] as const).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor:
                          editedPatient.pregnancyStatus === status
                            ? "#0b7fab"
                            : "#e0e0e0",
                      },
                    ]}
                    onPress={() =>
                      setEditedPatient({ ...editedPatient, pregnancyStatus: status })
                    }
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        {
                          color:
                            editedPatient.pregnancyStatus === status ? "#fff" : "#333",
                        },
                      ]}
                    >
                      {status.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Notes:</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }, getFieldStyle('notes')]}
              value={editedPatient.notes || ""}
              onChangeText={(text) =>
                setEditedPatient({ ...editedPatient, notes: text })
              }
              placeholder="Enter notes"
              multiline
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <Modal transparent={true} animationType="slide" visible={showDatePicker}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={handleDatePickerConfirm}>
                    <Text style={styles.datePickerConfirm}>Done</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerBody}>
                  {/* Year Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Year</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: 121 }, (_, i) => new Date().getFullYear() - 120 + i).map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[styles.pickerItem, selectedYear === year && styles.pickerItemSelected]}
                          onPress={() => setSelectedYear(year)}
                        >
                          <Text style={[styles.pickerItemText, selectedYear === year && styles.pickerItemTextSelected]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Month Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Month</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {getValidMonths().map((month) => (
                        <TouchableOpacity
                          key={month}
                          style={[styles.pickerItem, selectedMonth === month && styles.pickerItemSelected]}
                          onPress={() => {
                            setSelectedMonth(month);
                            // Adjust day if it exceeds the days in the new month
                            const daysInMonth = getDaysInMonth(month, selectedYear);
                            if (selectedDay > daysInMonth) {
                              setSelectedDay(daysInMonth);
                            }
                          }}
                        >
                          <Text style={[styles.pickerItemText, selectedMonth === month && styles.pickerItemTextSelected]}>
                            {String(month).padStart(2, "0")}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Day Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Day</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {getValidDaysWithLimit().map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[styles.pickerItem, selectedDay === day && styles.pickerItemSelected]}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text style={[styles.pickerItemText, selectedDay === day && styles.pickerItemTextSelected]}>
                            {String(day).padStart(2, "0")}
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: "#ff0000",
    fontWeight: "700",
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#333",
    justifyContent: "center",
  },
  requiredInput: {
    borderWidth: 1,
    borderColor: "#ff9800",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff3e0",
    color: "#333",
    justifyContent: "center",
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requiredPhoneContainer: {
    backgroundColor: '#fff3e0',
  },
  phonePrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 4,
  },
  phoneInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    padding: 0,
  },
  dropdown: {
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    maxHeight: 150,
  },
  dropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  helperText: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  datePickerContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: "#e0e0e0",
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  datePickerCancel: {
    fontSize: 16,
    color: "#999",
    fontWeight: "500",
  },
  datePickerConfirm: {
    fontSize: 16,
    color: "#0b7fab",
    fontWeight: "600",
  },
  datePickerBody: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
  },
  pickerColumn: {
    flex: 1,
    alignItems: "center",
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0b7fab",
    marginBottom: 8,
  },
  pickerScroll: {
    height: 200,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  pickerItemSelected: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 16,
    color: "#999",
    fontWeight: "400",
  },
  pickerItemTextSelected: {
    color: "#0b7fab",
    fontWeight: "700",
    fontSize: 18,
  },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d0d0d0",
  },
  statusButtonText: {
    fontWeight: "bold",
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopColor: "#ddd",
    borderTopWidth: 1,
    backgroundColor: "#fff",
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    backgroundColor: "#0b7fab",
  },
  cancelButton: {
    backgroundColor: "#e0e0e0",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  cancelButtonText: {
    color: "#333",
  },
});
