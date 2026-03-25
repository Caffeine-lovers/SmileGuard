/* eslint-disable react/react-in-jsx-scope */
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, SafeAreaView, ActivityIndicator
} from "react-native";
import { saveAppointment, Appointment } from "../../lib/database.ts";
import { getAllBlockedSlots, BlockedSlot } from "../../lib/appointmentService.ts";

const SERVICES = [
  { id: "cleaning",   name: "Cleaning",               duration: 30,  price: 1500  },
  { id: "whitening",  name: "Whitening",               duration: 60,  price: 5000  },
  { id: "fillings",   name: "Fillings",                duration: 45,  price: 2000  },
  { id: "root-canal", name: "Root Canal",              duration: 90,  price: 8000  },
  { id: "extraction", name: "Extraction",              duration: 30,  price: 1500  },
  { id: "braces",     name: "Braces Consultation",     duration: 60,  price: 35000 },
  { id: "implants",   name: "Implants Consultation",   duration: 60,  price: 45000 },
  { id: "xray",       name: "X-Ray",                   duration: 15,  price: 500   },
  { id: "checkup",    name: "Check-up",                duration: 20,  price: 300   },
];

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
  const [selectedDate, setSelectedDate]       = useState<string>("");
  const [selectedTime, setSelectedTime]       = useState<string>("");
  const [notes, setNotes]                     = useState<string>("");
  const [isBooking, setIsBooking]             = useState(false);
  const [blockedSlots, setBlockedSlots]       = useState<BlockedSlot[]>([]);
  const [loadingBlockedSlots, setLoadingBlockedSlots] = useState(true);
  const [fullyBookedDates, setFullyBookedDates]       = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAllBlockedSlots();
  }, []);

  const fetchAllBlockedSlots = async () => {
    setLoadingBlockedSlots(true);
    try {
      const slots = await getAllBlockedSlots();
      console.log("🔍 [DEBUG] Fetched blocked slots from Supabase:", slots);
      console.log(`📊 [DEBUG] Total blocked slots: ${slots.length}`);

      setBlockedSlots(slots);

      const dateCounts: Record<string, number> = {};
      for (const slot of slots) {
        dateCounts[slot.date] = (dateCounts[slot.date] ?? 0) + 1;
      }
      console.log("📅 [DEBUG] Booked slots per date:", dateCounts);

      const full = new Set(
        Object.entries(dateCounts)
          .filter(([, count]) => count >= TIME_SLOTS.length)
          .map(([date]) => date)
      );
      console.log("🚫 [DEBUG] Fully booked dates:", Array.from(full));

      setFullyBookedDates(full);
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching blocked slots:", error);
      setBlockedSlots([]);
    } finally {
      setLoadingBlockedSlots(false);
    }
  };

  const isTaken = (date: string, time: string): boolean => {
    const taken = blockedSlots.some((slot) => slot.date === date && slot.time === time);
    console.log(`⏰ [DEBUG] Checking slot - Date: ${date}, Time: ${time}, Taken: ${taken}`);
    return taken;
  };

  const availableDates = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date.toISOString().split("T")[0];
  });

  const getDayOfWeek = (dateStr: string) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[new Date(dateStr).getDay()];
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });

  const handleDateSelect = (date: string) => {
    console.log(`📍 [DEBUG] Selected date: ${date}`);
    console.log(`📍 [DEBUG] Blocked slots for this date:`, blockedSlots.filter(s => s.date === date));
    setSelectedDate(date);
    setSelectedTime("");
  };

  const handleBook = async () => {
    if (!selectedService) { Alert.alert("Error", "Please select a service.");  return; }
    if (!selectedDate)    { Alert.alert("Error", "Please select a date.");     return; }
    if (!selectedTime)    { Alert.alert("Error", "Please select a time.");     return; }

    console.log(`✅ [DEBUG] Attempting to book appointment:`);
    console.log(`   Service: ${selectedService.name}`);
    console.log(`   Date: ${selectedDate}`);
    console.log(`   Time: ${selectedTime}`);

    if (isTaken(selectedDate, selectedTime)) {
      console.warn(`⚠️ [DEBUG] Slot is taken! Aborting booking.`);
      Alert.alert("Not Available", "This slot was just taken. Please choose another.");
      return;
    }

    setIsBooking(true);
    try { 
      const appointmentData = {
        patient_id:       patientId,
        dentist_id:       dentistId || null,  // FIX: null instead of "" — empty string breaks UUID column
        service:          selectedService.name,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        status:           "scheduled" as const,
        notes,
      };

      console.log(`📤 [DEBUG] Sending appointment data to database:`, appointmentData);
      const result = await saveAppointment(appointmentData);
      console.log(`📥 [DEBUG] Booking result:`, result);

      if (result.success) {
        handleReset();
        onSuccess?.(result.data as Appointment);

        Alert.alert(
          "Appointment Booked!",
          `Service: ${selectedService.name}\nDate: ${formatDate(selectedDate)}\nTime: ${selectedTime}${result.offlineId ? "\n\nSaved offline. Will sync when connected." : ""}`
        );

        console.log(`🔄 [DEBUG] Refreshing blocked slots after successful booking...`);
        await fetchAllBlockedSlots();
      } else {
        console.error(`❌ [DEBUG] Booking failed:`, result.error);
        Alert.alert("Booking Failed", result.error || "Please try again.");
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Unexpected error during booking:`, error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsBooking(false);
    }
  };

  const handleReset = () => {
    setSelectedService(null);
    setSelectedDate("");
    setSelectedTime("");
    setNotes("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <Text style={styles.headerSubtitle}>Schedule your dental visit in a few simple steps</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Step 1: Service Selection */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>1</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Select Service</Text>
              <Text style={styles.sectionDescription}>Choose the dental service you need</Text>
            </View>
          </View>
          
          <View style={styles.serviceGrid}>
            {SERVICES.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceCard, selectedService?.id === service.id && styles.serviceCardSelected]}
                onPress={() => setSelectedService(service)}
              >
                <Text style={[styles.serviceName, selectedService?.id === service.id && styles.serviceNameSelected]}>
                  {service.name}
                </Text>
                <Text style={styles.serviceDuration}>{service.duration} mins</Text>
                <Text style={styles.servicePrice}>₱{service.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 2: Date Selection */}
        <View style={[styles.formSection, !selectedService && styles.disabledSection]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>2</Text>
            </View>
            <View>
              <Text style={[styles.sectionTitle, !selectedService && styles.disabledText]}>
                Select Date
              </Text>
              <Text style={[styles.sectionDescription, !selectedService && styles.disabledText]}>
                {!selectedService ? "Choose a service first" : "Pick your preferred date"}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateScroll}
          >
            {availableDates.map((date) => {
              const isFull = fullyBookedDates.has(date);
              return (
                <TouchableOpacity
                  key={date}
                  disabled={!selectedService || isFull}
                  style={[
                    styles.dateCard,
                    selectedDate === date && styles.dateCardSelected,
                    (!selectedService || isFull) && styles.dateCardDisabled,
                  ]}
                  onPress={() => handleDateSelect(date)}
                >
                  <Text style={[styles.dateDay, selectedDate === date && styles.dateTextSelected]}>
                    {getDayOfWeek(date)}
                  </Text>
                  <Text style={[styles.dateNumber, selectedDate === date && styles.dateTextSelected]}>
                    {new Date(date).getDate()}
                  </Text>
                  {isFull && <Text style={styles.fullText}>Full</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Step 3: Time Selection */}
        <View style={[styles.formSection, !selectedDate && styles.disabledSection]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>3</Text>
            </View>
            <View>
              <Text style={[styles.sectionTitle, !selectedDate && styles.disabledText]}>
                Select Time
              </Text>
              <Text style={[styles.sectionDescription, !selectedDate && styles.disabledText]}>
                {!selectedDate ? "Choose a date first" : "Pick your time slot"}
              </Text>
            </View>
          </View>

          {loadingBlockedSlots ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0b7fab" />
              <Text style={styles.loadingMessage}>Loading available slots...</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timeScroll}
            >
              {TIME_SLOTS.map((time) => {
                const taken = selectedDate ? isTaken(selectedDate, time) : false;
                return (
                  <TouchableOpacity
                    key={time}
                    disabled={!selectedDate || taken}
                    style={[
                      styles.timeCard,
                      selectedTime === time && styles.timeCardSelected,
                      (taken || !selectedDate) && styles.timeCardDisabled,
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text style={[
                      styles.timeCardText,
                      selectedTime === time && styles.timeTextSelected,
                      taken && styles.timeCardTextDisabled,
                    ]}>
                      {time}
                    </Text>
                    {taken && <Text style={styles.unavailableText}>Booked</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Step 4: Additional Notes */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>4</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Additional Information</Text>
              <Text style={styles.sectionDescription}>Optional: Share any special requests</Text>
            </View>
          </View>

          <Text style={styles.notesLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special requests, allergies, or medical conditions..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Appointment Summary */}
        {selectedService && selectedDate && selectedTime && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryIcon}>✓</Text>
              <Text style={styles.summaryTitle}>Appointment Summary</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service</Text>
              <Text style={styles.summaryValue}>{selectedService.name}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>{formatDate(selectedDate)}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>{selectedTime}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{selectedService.duration} min</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Estimated Cost</Text>
              <Text style={styles.totalValue}>₱{selectedService.price}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bookButton, isBooking && styles.bookButtonDisabled]}
            onPress={handleBook}
            disabled={isBooking}
          >
            <Text style={styles.bookButtonText}>
              {isBooking ? "Booking..." : "Book Now"}
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
  container:           { flex: 1, backgroundColor: "#f8fafc" },
  header:              { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerTitle:         { fontSize: 28, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  headerSubtitle:      { fontSize: 14, color: "#64748b", fontWeight: "500" },
  scrollView:          { flex: 1, padding: 24 },
  formSection:         { marginBottom: 32 },
  sectionHeader:       { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionNumber:       { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0b7fab", justifyContent: "center", alignItems: "center", marginRight: 12 },
  sectionNumberText:   { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  sectionTitle:        { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  sectionDescription: { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 12 },
  
  // Service Selection
  serviceGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  serviceCard:         { width: "48%", padding: 14, backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  serviceCardSelected: { borderColor: "#0b7fab", backgroundColor: "#f0f9ff", borderWidth: 2 },
  serviceName:         { fontSize: 13, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  serviceNameSelected: { color: "#0b7fab" },
  serviceDuration:     { fontSize: 12, color: "#64748b", marginTop: 6, fontWeight: "500" },
  servicePrice:        { fontSize: 13, color: "#0b7fab", fontWeight: "700", marginTop: 6 },
  
  // Date Selection
  dateScroll:          { marginBottom: 10 },
  dateCard:            { width: 72, height: 84, backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", marginRight: 12 },
  dateCardSelected:    { borderColor: "#0b7fab", backgroundColor: "#f0f9ff", borderWidth: 2 },
  dateCardDisabled:    { opacity: 0.5, backgroundColor: "#f3f4f6" },
  dateDay:             { fontSize: 12, color: "#64748b", fontWeight: "700" },
  dateNumber:          { fontSize: 20, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  dateTextSelected:    { color: "#0b7fab" },
  fullText:            { fontSize: 11, color: "#f97316", fontWeight: "700", marginTop: 3 },
  
  // Time Selection
  timeScroll:          { marginBottom: 10 },
  timeCard:            { width: 80, height: 80, backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center", marginRight: 12 },
  timeCardSelected:    { borderColor: "#0b7fab", backgroundColor: "#f0f9ff", borderWidth: 2 },
  timeCardDisabled:    { opacity: 0.5, backgroundColor: "#f3f4f6" },
  timeCardText:        { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  timeCardTextDisabled:{ color: "#9ca3af" },
  timeTextSelected:    { color: "#0b7fab" },
  unavailableText:     { fontSize: 11, color: "#ef4444", fontWeight: "700", marginTop: 3 },
  loadingContainer:    { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", padding: 40, alignItems: "center", justifyContent: "center", minHeight: 120 },
  loadingMessage:      { fontSize: 14, color: "#64748b", marginTop: 16, textAlign: "center", fontWeight: "500" },
  disabledSection:     { opacity: 0.5 },
  disabledText:        { color: "#9ca3af" },
  
  // Notes Input
  notesLabel:          { fontSize: 14, fontWeight: "600", color: "#0f172a", marginBottom: 10 },
  notesInput:          { backgroundColor: "#ffffff", borderRadius: 12, padding: 14, fontSize: 14, borderWidth: 1, borderColor: "#e5e7eb", minHeight: 100, color: "#0f172a" },
  notesPlaceholder:    { color: "#9ca3af" },
  
  // Summary Card
  summaryCard:         { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", padding: 20, marginTop: 24, marginBottom: 24 },
  summaryHeader:       { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  summaryIcon:         { fontSize: 20, marginRight: 10 },
  summaryTitle:        { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  summaryRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  summaryLabel:        { fontSize: 14, color: "#64748b", fontWeight: "600" },
  summaryValue:        { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  divider:             { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },
  totalRow:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12 },
  totalLabel:          { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  totalValue:          { fontSize: 18, fontWeight: "800", color: "#0b7fab" },
  
  // Action Buttons
  buttonContainer:     { flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 40 },
  resetButton:         { flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  resetButtonText:     { fontSize: 15, color: "#64748b", fontWeight: "700" },
  bookButton:          { flex: 2, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#0b7fab", alignItems: "center", justifyContent: "center" },
  bookButtonDisabled:  { backgroundColor: "#93c5fd" },
  bookButtonText:      { fontSize: 15, color: "#ffffff", fontWeight: "800" },
  cancelLink:          { alignItems: "center", marginTop: 8, marginBottom: 32 },
  cancelLinkText:      { fontSize: 15, color: "#64748b", fontWeight: "600" },
});