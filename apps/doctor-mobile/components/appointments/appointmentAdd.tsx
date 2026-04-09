import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface AppointmentAddProps {
  visible: boolean;
  doctorId: string;
  onClose: () => void;
  onSave: () => void;
}

interface Patient {
  id: string;
  name: string;
  email: string;
}

const SERVICES = [
  'General Check-up',
  'Cleaning',
  'Whitening',
  'Cavity Filling',
  'Root Canal',
  'Extraction',
  'Aligners',
  'Crown',
  'Bridge',
  'Implant',
  'Orthodontics',
  'Emergency',
];

const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled', 'no-show'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function AppointmentAdd({
  visible,
  doctorId,
  onClose,
  onSave,
}: AppointmentAddProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [appointmentTime, setAppointmentTime] = useState<string>('10:00');
  const [selectedService, setSelectedService] = useState<string>('General Check-up');
  const [selectedStatus, setSelectedStatus] = useState<'scheduled' | 'completed' | 'cancelled' | 'no-show'>('scheduled');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingPatients, setFetchingPatients] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // Fetch patients on mount or when modal becomes visible
  useEffect(() => {
    if (visible) {
      fetchPatients();
      // Initialize date picker with current appointment date
      if (appointmentDate) {
        const [year, month, day] = appointmentDate.split('-').map(Number);
        setSelectedYear(year);
        setSelectedMonth(month);
        // Ensure selected day doesn't exceed max days in that month
        const maxDays = new Date(year, month, 0).getDate();
        setSelectedDay(Math.min(day, maxDays));
      }
      // Initialize time picker with current appointment time
      if (appointmentTime) {
        const [hour, minute] = appointmentTime.split(':').map(Number);
        setSelectedHour(hour);
        setSelectedMinute(minute);
      }
    }
  }, [visible]);

  // Adjust selectedMonth and selectedDay based on selected year and month
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentDay = new Date().getDate();

    // If selected year is current year and selected month is before current month, reset to current month
    if (selectedYear === currentYear && selectedMonth < currentMonth) {
      setSelectedMonth(currentMonth);
    }

    // If selected year and month are current year/month and selected day is before today, reset to today
    if (selectedYear === currentYear && selectedMonth === currentMonth && selectedDay < currentDay) {
      setSelectedDay(currentDay);
    }

    // Adjust selectedDay if it exceeds max days in the selected month
    const maxDays = getDaysInMonth(selectedYear, selectedMonth);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedMonth]);

  const fetchPatients = async () => {
    try {
      setFetchingPatients(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'patient')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching patients:', error);
        Alert.alert('Error', 'Failed to fetch patients');
        return;
      }

      setPatients(data || []);
      if (data && data.length > 0) {
        setSelectedPatient(data[0].id);
      }
    } catch (error) {
      console.error('Exception fetching patients:', error);
      Alert.alert('Error', 'Failed to load patients');
    } finally {
      setFetchingPatients(false);
    }
  };

  const handleDateChange = (text: string) => {
    // Basic validation: YYYY-MM-DD format
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (dateRegex.test(text) || text === '') {
      setAppointmentDate(text);
    }
  };

  const handleTimeChange = (text: string) => {
    // Basic validation: HH:MM format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]?$/;
    if (timeRegex.test(text) || text === '') {
      setAppointmentTime(text);
    }
  };

  const handleDatePickerConfirm = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentDay = new Date().getDate();

    if (isUnavailableDay(selectedYear, selectedMonth, selectedDay)) {
      Alert.alert('Clinic Closed', 'The clinic is closed on Sundays and Tuesdays. Please select another day.');
      return;
    }

    // Ensure month is valid for selected year
    let validMonth = selectedMonth;
    if (selectedYear === currentYear && validMonth < currentMonth) {
      validMonth = currentMonth;
    }

    // Ensure day is valid for the selected month
    const maxDays = getDaysInMonth(selectedYear, validMonth);
    let validDay = Math.min(selectedDay, maxDays);

    // Ensure day is not in the past for current year/month
    if (selectedYear === currentYear && validMonth === currentMonth && validDay < currentDay) {
      validDay = currentDay;
    }

    const dateString = `${selectedYear}-${String(validMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
    setAppointmentDate(dateString);
    setShowDatePicker(false);
  };

  const handleTimePickerConfirm = () => {
    const timeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    setAppointmentTime(timeString);
    setShowTimePicker(false);
  };

  const getPatientName = (patientId: string): string => {
    const patient = patients.find((p) => p.id === patientId);
    return patient?.name || 'Select Patient';
  };

  const isUnavailableDay = (year: number, month: number, day: number): boolean => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 2 = Tuesday (clinic closed)
    return dayOfWeek === 0 || dayOfWeek === 2;
  };

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const validateForm = (): boolean => {
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!selectedPatient) {
      Alert.alert('Error', 'Please select a patient');
      return false;
    }
    if (!appointmentDate || !dateRegex.test(appointmentDate)) {
      Alert.alert('Error', 'Please enter a valid date (YYYY-MM-DD)');
      return false;
    }
    if (!appointmentTime || !timeRegex.test(appointmentTime)) {
      Alert.alert('Error', 'Please enter a valid time (HH:MM)');
      return false;
    }
    if (!selectedService) {
      Alert.alert('Error', 'Please select a service');
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setSelectedPatient(patients.length > 0 ? patients[0].id : '');
    setAppointmentDate(new Date().toISOString().split('T')[0]);
    setAppointmentTime('10:00');
    setSelectedService('General Check-up');
    setSelectedStatus('scheduled');
    setNotes('');
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const appointmentData = {
        patient_id: selectedPatient,
        dentist_id: doctorId,
        service: selectedService,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: selectedStatus,
        notes: notes || null,
      };

      console.log('📝 Creating appointment:', appointmentData);

      const { data, error } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select();

      if (error) {
        console.error('Error creating appointment:', error);
        Alert.alert('Error', error.message || 'Failed to create appointment');
        return;
      }

      console.log('✅ Appointment created successfully:', data);
      Alert.alert('Success', 'Appointment created successfully');
      onSave();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Exception creating appointment:', error);
      Alert.alert('Error', 'Failed to create appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Image
              source={require('../../assets/images/icon/back.png')}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Appointment</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Content */}
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
          {fetchingPatients ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
              <ActivityIndicator size="large" color="#0b7fab" />
              <Text style={{ marginTop: 12, color: '#666' }}>Loading patients...</Text>
            </View>
          ) : (
            <>
              {/* Patient Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Patient Information</Text>

                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowPatientPicker(!showPatientPicker)}
                >
                  <Text style={styles.dropdownText}>
                    👤 {getPatientName(selectedPatient)}
                  </Text>
                  <Text style={{ color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>

                {showPatientPicker && (
                  <View style={styles.pickerContainer}>
                    {patients.length === 0 ? (
                      <Text style={styles.emptyText}>No patients found</Text>
                    ) : (
                      patients.map((patient) => (
                        <TouchableOpacity
                          key={patient.id}
                          style={[
                            styles.pickerItem,
                            selectedPatient === patient.id && styles.pickerItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedPatient(patient.id);
                            setShowPatientPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              selectedPatient === patient.id && styles.pickerItemTextSelected,
                            ]}
                          >
                            {patient.name}
                          </Text>
                          <Text style={styles.pickerItemSubText}>{patient.email}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              {/* Date & Time Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Appointment Time</Text>

                {/* Date Picker Button */}
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: appointmentDate ? '#333' : '#999', fontSize: 14 }}>
                    📅 {appointmentDate || 'Select date'}
                  </Text>
                </TouchableOpacity>

                {/* Time Picker Button */}
                <TouchableOpacity
                  style={[styles.dropdown, { marginTop: 12 }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={{ color: appointmentTime ? '#333' : '#999', fontSize: 14 }}>
                    ⏰ {appointmentTime || 'Select time'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Service Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Service</Text>

                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowServicePicker(!showServicePicker)}
                >
                  <Text style={styles.dropdownText}>🔧 {selectedService}</Text>
                  <Text style={{ color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>

                {showServicePicker && (
                  <View style={styles.pickerContainer}>
                    {SERVICES.map((service) => (
                      <TouchableOpacity
                        key={service}
                        style={[
                          styles.pickerItem,
                          selectedService === service && styles.pickerItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedService(service);
                          setShowServicePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            selectedService === service && styles.pickerItemTextSelected,
                          ]}
                        >
                          {service}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Status Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Status</Text>

                <View style={styles.statusContainer}>
                  {STATUS_OPTIONS.map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        selectedStatus === status && styles.statusButtonSelected,
                      ]}
                      onPress={() => setSelectedStatus(status)}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          selectedStatus === status && styles.statusButtonTextSelected,
                        ]}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any notes or special instructions..."
                  placeholderTextColor="#999"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        {!fetchingPatients && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading || !selectedPatient}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Appointment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

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
                      {Array.from({ length: 2 }, (_, i) => new Date().getFullYear() + i).map((year) => (
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
                      {Array.from({ length: 12 }, (_, i) => i + 1)
                        .filter((month) => {
                          const currentYear = new Date().getFullYear();
                          const currentMonth = new Date().getMonth() + 1;
                          // If selected year is current year, only show months from now onwards
                          if (selectedYear === currentYear) {
                            return month >= currentMonth;
                          }
                          // If selected year is in the future, show all months
                          return true;
                        })
                        .map((month) => (
                          <TouchableOpacity
                            key={month}
                            style={[styles.pickerItem, selectedMonth === month && styles.pickerItemSelected]}
                            onPress={() => setSelectedMonth(month)}
                          >
                            <Text style={[styles.pickerItemText, selectedMonth === month && styles.pickerItemTextSelected]}>
                              {MONTH_NAMES[month - 1]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>

                  {/* Day Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Day</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1)
                        .filter((day) => {
                          const currentYear = new Date().getFullYear();
                          const currentMonth = new Date().getMonth() + 1;
                          const currentDay = new Date().getDate();
                          // If selected year is current year and selected month is current month, only show days from today onwards
                          if (selectedYear === currentYear && selectedMonth === currentMonth) {
                            return day >= currentDay;
                          }
                          // Otherwise show all days in that month
                          return true;
                        })
                        .map((day) => {
                          const isUnavailable = isUnavailableDay(selectedYear, selectedMonth, day);
                          return (
                            <TouchableOpacity
                              key={day}
                              style={[
                                styles.pickerItem,
                                selectedDay === day && styles.pickerItemSelected,
                                isUnavailable && styles.pickerItemDisabled,
                              ]}
                              onPress={() => !isUnavailable && setSelectedDay(day)}
                              disabled={isUnavailable}
                            >
                              <Text
                                style={[
                                  styles.pickerItemText,
                                  selectedDay === day && styles.pickerItemTextSelected,
                                  isUnavailable && styles.pickerItemTextDisabled,
                                ]}
                              >
                                {String(day).padStart(2, '0')}
                              </Text>
                              {isUnavailable && (
                                <Text style={styles.closedLabel}>CLOSED</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <Modal transparent={true} animationType="slide" visible={showTimePicker}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Time</Text>
                  <TouchableOpacity onPress={handleTimePickerConfirm}>
                    <Text style={styles.datePickerConfirm}>Done</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerBody}>
                  {/* Hour Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Hour</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: 6 }, (_, i) => 10 + i).map((hour) => (
                        <TouchableOpacity
                          key={hour}
                          style={[styles.pickerItem, selectedHour === hour && styles.pickerItemSelected]}
                          onPress={() => setSelectedHour(hour)}
                        >
                          <Text style={[styles.pickerItemText, selectedHour === hour && styles.pickerItemTextSelected]}>
                            {String(hour).padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Minute Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Minute</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                        <TouchableOpacity
                          key={minute}
                          style={[styles.pickerItem, selectedMinute === minute && styles.pickerItemSelected]}
                          onPress={() => setSelectedMinute(minute)}
                        >
                          <Text style={[styles.pickerItemText, selectedMinute === minute && styles.pickerItemTextSelected]}>
                            {String(minute).padStart(2, '0')}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0b7fab',
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b7fab',
    marginBottom: 12,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  dropdownIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#0b7fab',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: '#0b7fab',
    fontWeight: '700',
  },
  pickerItemSubText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
  inputField: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0b7fab',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  inputValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  statusButtonSelected: {
    borderColor: '#0b7fab',
    backgroundColor: '#e3f2fd',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextSelected: {
    color: '#0b7fab',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 100,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    borderTopColor: '#ddd',
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#0b7fab',
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#fff',
  },
  cancelButtonText: {
    color: '#666',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 0,
    maxHeight: '80%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  datePickerCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b7fab',
  },
  datePickerConfirm: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0b7fab',
  },
  datePickerBody: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  pickerColumn: {
    flex: 1,
    height: 300,
  },
  pickerLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#0b7fab',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItemDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  pickerItemTextDisabled: {
    color: '#ccc',
    fontWeight: '400',
  },
  closedLabel: {
    fontSize: 10,
    color: '#ff6b6b',
    fontWeight: '700',
    marginTop: 2,
  },
});

