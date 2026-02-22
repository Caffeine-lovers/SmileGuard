import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAppointments, saveAppointment, Appointment } from "../../lib/database";

// Available services
const SERVICES = [
  { id: "cleaning", name: "Cleaning", duration: 30, price: 1500 },
  { id: "whitening", name: "Whitening", duration: 60, price: 5000 },
  { id: "fillings", name: "Fillings", duration: 45, price: 2000 },
  { id: "root-canal", name: "Root Canal", duration: 90, price: 8000 },
  { id: "extraction", name: "Extraction", duration: 30, price: 1500 },
  { id: "braces", name: "Braces Consultation", duration: 60, price: 35000 },
  { id: "implants", name: "Implants Consultation", duration: 60, price: 45000 },
  { id: "xray", name: "X-Ray", duration: 15, price: 500 },
  { id: "checkup", name: "Check-up", duration: 20, price: 300 },
];

// Available time slots
const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

interface BookAppointmentProps {
  patientId: string;
  dentistId?: string;
  onSuccess?: (appointment: Appointment) => void;
  onCancel?: () => void;
}

export default function BookAppointment({
  patientId,
  dentistId,
  onSuccess,
  onCancel,
}: BookAppointmentProps) {
  const [selectedService, setSelectedService] = useState<typeof SERVICES[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  
  // Generate next 30 days
  const availableDates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date.toISOString().split("T")[0];
  });

  // Get day of week
  const getDayOfWeek = (dateStr: string) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date(dateStr).getDay()];
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Check if slot is available (mock - in production check against existing appointments)
  const isSlotAvailable = async (date: string, time: string): Promise<boolean> => {
    // In production, query the database for existing appointments
    // For now, return true (all slots available)
    return true;
  };

  // Handle booking
  const handleBook = async () => {
    if (!selectedService) {
      Alert.alert("Error", "Please select a service.");
      return;
    }
    if (!selectedDate) {
      Alert.alert("Error", "Please select a date.");
      return;
    }
    if (!selectedTime) {
      Alert.alert("Error", "Please select a time.");
      return;
    }

    setIsBooking(true);

    try {
      // Check availability
      const available = await isSlotAvailable(selectedDate, selectedTime);
      if (!available) {
        Alert.alert("Not Available", "This time slot is already booked. Please choose another.");
        setIsBooking(false);
        return;
      }

      const appointmentData = {
        patient_id: patientId,
        dentist_id: dentistId || "",
        service: selectedService.name,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        status: "scheduled" as const,
        notes: notes,
      };

      const result = await saveAppointment(appointmentData);

      if (result.success) {
        Alert.alert(
          "Appointment Booked!",
          `Service: ${selectedService.name}\nDate: ${formatDate(selectedDate)}\nTime: ${selectedTime}\n\n${result.offlineId ? "Saved offline. Will sync when connected." : ""}`,
          [
            {
              text: "OK",
              onPress: () => onSuccess?.(result.data as Appointment),
            },
          ]
        );
      } else {
        Alert.alert("Booking Failed", result.error || "Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsBooking(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedService(null);
    setSelectedDate("");
    setSelectedTime("");
    setNotes("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Book Appointment</Text>

        {/* Service Selection */}
        <Text style={styles.sectionTitle}>Select Service</Text>
        <View style={styles.serviceGrid}>
          {SERVICES.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[
                styles.serviceCard,
                selectedService?.id === service.id && styles.serviceCardSelected,
              ]}
              onPress={() => setSelectedService(service)}
            >
              <Text
                style={[
                  styles.serviceName,
                  selectedService?.id === service.id && styles.serviceNameSelected,
                ]}
              >
                {service.name}
              </Text>
              <Text style={styles.serviceDuration}>{service.duration} mins</Text>
              <Text style={styles.servicePrice}>₱{service.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Selection */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {availableDates.map((date) => (
            <TouchableOpacity
              key={date}
              style={[
                styles.dateCard,
                selectedDate === date && styles.dateCardSelected,
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text
                style={[
                  styles.dateDay,
                  selectedDate === date && styles.dateTextSelected,
                ]}
              >
                {getDayOfWeek(date)}
              </Text>
              <Text
                style={[
                  styles.dateNumber,
                  selectedDate === date && styles.dateTextSelected,
                ]}
              >
                {new Date(date).getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time Selection */}
        <Text style={styles.sectionTitle}>Select Time</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeSlot,
                selectedTime === time && styles.timeSlotSelected,
              ]}
              onPress={() => setSelectedTime(time)}
            >
              <Text
                style={[
                  styles.timeText,
                  selectedTime === time && styles.timeTextSelected,
                ]}
              >
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special requests or medical conditions we should know about..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Summary */}
        {selectedService && selectedDate && selectedTime && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Appointment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service:</Text>
              <Text style={styles.summaryValue}>{selectedService.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time:</Text>
              <Text style={styles.summaryValue}>{selectedTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration:</Text>
              <Text style={styles.summaryValue}>{selectedService.duration} minutes</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Estimated Cost:</Text>
              <Text style={styles.totalValue}>₱{selectedService.price}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
            onPress={handleBook}
            disabled={isBooking}
          >
            <Text style={styles.bookButtonText}>
              {isBooking ? "Booking..." : "Book Appointment"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 12,
    marginTop: 20,
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  serviceCard: {
    width: "30%",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  serviceCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  serviceName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a2e",
    textAlign: "center",
  },
  serviceNameSelected: {
    color: "#4CAF50",
  },
  serviceDuration: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  servicePrice: {
    fontSize: 11,
    color: "#4CAF50",
    fontWeight: "600",
    marginTop: 4,
  },
  dateScroll: {
    marginBottom: 10,
  },
  dateCard: {
    width: 60,
    height: 70,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  dateCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  dateDay: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginTop: 4,
  },
  dateTextSelected: {
    color: "#4CAF50",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timeSlot: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  timeSlotSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  timeText: {
    fontSize: 14,
    color: "#1a1a2e",
  },
  timeTextSelected: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  notesInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 100,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#1a1a2e",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 15,
    marginTop: 30,
  },
  resetButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 16,
    color: "#666",
  },
  bookButton: {
    flex: 2,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  bookButtonDisabled: {
    backgroundColor: "#a5d6a7",
  },
  bookButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
  },
  cancelLink: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  cancelLinkText: {
    fontSize: 16,
    color: "#666",
  },
});
