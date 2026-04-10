import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from 'react-native';

interface ClinicSetupProps {
  onClose?: () => void;
  onSave?: (clinicData: ClinicData) => void;
  styles?: any;
}

interface ClinicData {
  logo_url?: string;
  address: string;
  city: string;
  phone: string;
  gallery_images?: string[];
  services: Service[];
  schedule: Schedule;
  // Booking Settings
  min_advance_booking_hours: number;
  max_advance_booking_days: number;
  min_appointment_duration_mins: number;
  max_daily_appointments: number;
  // Cancellation Policy
  cancellation_policy_text: string;
  cancellation_fee_percentage: number;
  min_hours_to_cancel: number;
  min_hours_to_reschedule: number;
  // No-Show Penalty
  allow_no_show_penalty: boolean;
  no_show_penalty_percentage: number;
  // Appointment Spacing
  break_between_appointments_mins: number;
  buffer_before_lunch_mins: number;
  lunch_start_time: string;
  lunch_end_time: string;
  // Reminders & Capacity
  send_appointment_reminders: boolean;
  reminder_before_hours: number;
  max_patients_per_slot: number;
  // Bookings & Forms
  allow_walk_ins: boolean;
  require_new_patient_form: boolean;
  auto_approve_appointments: boolean;
  // Payment
  require_payment_upfront: boolean;
  accepted_payment_methods: string[];
  // Additional
  clinic_notes: string;
  policies_url: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
}

interface Schedule {
  monday: { isOpen: boolean; hours: string };
  tuesday: { isOpen: boolean; hours: string };
  wednesday: { isOpen: boolean; hours: string };
  thursday: { isOpen: boolean; hours: string };
  friday: { isOpen: boolean; hours: string };
  saturday: { isOpen: boolean; hours: string };
  sunday: { isOpen: boolean; hours: string };
}

const defaultSchedule: Schedule = {
  monday: { isOpen: true, hours: '9:00 AM - 6:00 PM' },
  tuesday: { isOpen: true, hours: '9:00 AM - 6:00 PM' },
  wednesday: { isOpen: true, hours: '9:00 AM - 6:00 PM' },
  thursday: { isOpen: true, hours: '9:00 AM - 6:00 PM' },
  friday: { isOpen: true, hours: '9:00 AM - 6:00 PM' },
  saturday: { isOpen: false, hours: '10:00 AM - 2:00 PM' },
  sunday: { isOpen: false, hours: 'Closed' },
};

const PREDEFINED_SERVICES = [
  "Cleaning", "Whitening", "Fillings", "Root Canal", "Extraction", "Braces Consultation", "Implants Consultation",
    "X-Ray", "Checkup"
];

export default function ClinicSetup({
  onClose,
  onSave,
  styles: externalStyles,
}: ClinicSetupProps) {
  const [clinicData, setClinicData] = useState<ClinicData>({
    address: '',
    city: '',
    phone: '',
    gallery_images: [],
    services: [],
    schedule: defaultSchedule,
    // Booking Settings
    min_advance_booking_hours: 24,
    max_advance_booking_days: 30,
    min_appointment_duration_mins: 30,
    max_daily_appointments: 20,
    // Cancellation Policy
    cancellation_policy_text: '',
    cancellation_fee_percentage: 0,
    min_hours_to_cancel: 24,
    min_hours_to_reschedule: 12,
    // No-Show Penalty
    allow_no_show_penalty: false,
    no_show_penalty_percentage: 0,
    // Appointment Spacing
    break_between_appointments_mins: 10,
    buffer_before_lunch_mins: 15,
    lunch_start_time: '12:00 PM',
    lunch_end_time: '1:00 PM',
    // Reminders & Capacity
    send_appointment_reminders: true,
    reminder_before_hours: 24,
    max_patients_per_slot: 1,
    // Bookings & Forms
    allow_walk_ins: false,
    require_new_patient_form: true,
    auto_approve_appointments: true,
    // Payment
    require_payment_upfront: false,
    accepted_payment_methods: ['credit_card', 'debit_card'],
    // Additional
    clinic_notes: '',
    policies_url: '',
  });

  const [newService, setNewService] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServicesSection, setShowServicesSection] = useState(false);

  const localStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 24,
      marginTop: 16,
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#0b7fab',
      marginBottom: 12,
    },
    card: {
      backgroundColor: '#f5f5f5',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#eee',
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    logoImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: '#e0e0e0',
      marginBottom: 12,
    },
    logoButton: {
      backgroundColor: '#0b7fab',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    input: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      marginBottom: 12,
    },
    galleryContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    galleryImage: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: '#e0e0e0',
    },
    addImageButton: {
      width: 80,
      height: 80,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#0b7fab',
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addImageText: {
      color: '#0b7fab',
      fontSize: 28,
    },
    serviceItem: {
      backgroundColor: '#e3f2fd',
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    serviceText: {
      color: '#0b7fab',
      fontWeight: '500',
      flex: 1,
    },
    removeButton: {
      color: '#d32f2f',
      fontWeight: 'bold',
      fontSize: 18,
    },
    addServiceContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    addServiceInput: {
      flex: 1,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
    },
    addServiceButton: {
      backgroundColor: '#0b7fab',
      borderRadius: 8,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scheduleDay: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dayColumn: {
      flex: 1,
    },
    dayName: {
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
    },
    dayHours: {
      fontSize: 12,
      color: '#999',
    },
    footerButtons: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    cancelButton: {
      flex: 1,
      borderWidth: 2,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveButton: {
      flex: 1,
      backgroundColor: '#0b7fab',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    cancelButtonText: {
      color: '#666',
      fontWeight: '600',
      fontSize: 14,
    },
  });

  const handleAddService = () => {
    if (newService.trim()) {
      setClinicData(prev => ({
        ...prev,
        services: [
          ...prev.services,
          {
            id: Date.now().toString(),
            name: newService,
            description: '',
          },
        ],
      }));
      setNewService('');
    }
  };

  const handleRemoveService = (id: string) => {
    setClinicData(prev => ({
      ...prev,
      services: prev.services.filter(service => service.id !== id),
    }));
  };

  const handleScheduleChange = (day: keyof Schedule, isOpen: boolean) => {
    setClinicData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          isOpen,
        },
      },
    }));
  };

  const handleScheduleHoursChange = (day: keyof Schedule, hours: string) => {
    setClinicData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          hours,
        },
      },
    }));
  };

  const handleSave = async () => {
    if (!clinicData.address.trim() || !clinicData.city.trim() || !clinicData.phone.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!clinicData.cancellation_policy_text.trim()) {
      Alert.alert('Error', 'Please enter a cancellation policy');
      return;
    }

    setLoading(true);
    try {
      if (onSave) {
        await onSave(clinicData);
      }
      Alert.alert('Success', 'Clinic information saved successfully');
      onClose?.();
    } catch (error) {
      console.error('Failed to save clinic data:', error);
      Alert.alert('Error', 'Failed to save clinic information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={localStyles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ padding: 16 }}>
          <Text style={localStyles.header}>Clinic Setup</Text>

          {/* Clinic Logo Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Clinic Logo</Text>
            <View style={localStyles.card}>
              <View style={localStyles.logoContainer}>
                <Image
                  source={{
                    uri: clinicData.logo_url || 'https://via.placeholder.com/120',
                  }}
                  style={localStyles.logoImage}
                />
                <TouchableOpacity style={localStyles.logoButton}>
                  <Text style={localStyles.buttonText}>Upload Logo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Address Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Address</Text>
            <View style={localStyles.card}>
              <TextInput
                style={localStyles.input}
                placeholder="Street Address"
                value={clinicData.address}
                onChangeText={(text) =>
                  setClinicData(prev => ({ ...prev, address: text }))
                }
                placeholderTextColor="#999"
              />
              <TextInput
                style={localStyles.input}
                placeholder="City"
                value={clinicData.city}
                onChangeText={(text) =>
                  setClinicData(prev => ({ ...prev, city: text }))
                }
                placeholderTextColor="#999"
              />
              <TextInput
                style={localStyles.input}
                placeholder="Phone Number"
                value={clinicData.phone}
                onChangeText={(text) =>
                  setClinicData(prev => ({ ...prev, phone: text }))
                }
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Clinic Gallery Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Clinic Pictures</Text>
            <View style={localStyles.card}>
              <View style={localStyles.galleryContainer}>
                {clinicData.gallery_images?.map((image, index) => (
                  <Image
                    key={index}
                    source={{ uri: image }}
                    style={localStyles.galleryImage}
                  />
                ))}
                <TouchableOpacity style={localStyles.addImageButton}>
                  <Text style={localStyles.addImageText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Services Offered Section */}
          <View style={localStyles.section}>
            <TouchableOpacity
              onPress={() => setShowServicesSection(!showServicesSection)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                padding: 12,
                backgroundColor: '#f5f5f5',
                borderRadius: 8,
              }}
            >
              <Text style={localStyles.sectionTitle}>
                Services Offered {clinicData.services.length > 0 ? `(${clinicData.services.length})` : ''}
              </Text>
              <Text style={{ fontSize: 18, color: '#0b7fab' }}>
                {showServicesSection ? '−' : '+'}
              </Text>
            </TouchableOpacity>

            {showServicesSection && (
              <View style={localStyles.card}>
                {/* Added Services */}
                {clinicData.services.length > 0 && (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 10 }}>Added Services:</Text>
                    {clinicData.services.map((service) => (
                      <View key={service.id} style={localStyles.serviceItem}>
                        <Text style={localStyles.serviceText}>{service.name}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveService(service.id)}
                        >
                          <Text style={localStyles.removeButton}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 }} />
                  </>
                )}

                {/* Predefined Services */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 10 }}>Available Services:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {PREDEFINED_SERVICES.map((service) => (
                    <View
                      key={service}
                      style={{
                        backgroundColor: '#f5f5f5',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#ddd',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '500',
                          color: '#333',
                        }}
                      >
                        {service}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Custom Service Input */}
                <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 10 }}>Add Custom Service:</Text>
                <View style={localStyles.addServiceContainer}>
                  <TextInput
                    style={localStyles.addServiceInput}
                    placeholder="Enter custom service..."
                    value={newService}
                    onChangeText={setNewService}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    style={localStyles.addServiceButton}
                    onPress={handleAddService}
                  >
                    <Text style={{ color: '#fff', fontSize: 20 }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Booking Settings Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Booking Settings</Text>
            <View style={localStyles.card}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Min Advance Booking (hours)
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 24"
                value={clinicData.min_advance_booking_hours.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    min_advance_booking_hours: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Max Advance Booking (days)
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 30"
                value={clinicData.max_advance_booking_days.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    max_advance_booking_days: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Min Appointment Duration (mins)
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 30"
                value={clinicData.min_appointment_duration_mins.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    min_appointment_duration_mins: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Max Daily Appointments
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 20"
                value={clinicData.max_daily_appointments.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    max_daily_appointments: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Appointment Timing Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Appointment Timing</Text>
            <View style={localStyles.card}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Break Between Appointments (mins)
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 10"
                value={clinicData.break_between_appointments_mins.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    break_between_appointments_mins: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Buffer Before Lunch (mins)
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 15"
                value={clinicData.buffer_before_lunch_mins.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    buffer_before_lunch_mins: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Lunch Start Time
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 12:00 PM"
                value={clinicData.lunch_start_time}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    lunch_start_time: text,
                  }))
                }
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Lunch End Time
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 1:00 PM"
                value={clinicData.lunch_end_time}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    lunch_end_time: text,
                  }))
                }
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Cancellation Policy Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Cancellation Policy</Text>
            <View style={localStyles.card}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Cancellation Policy Text
              </Text>
              <TextInput
                style={[localStyles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Enter your cancellation policy..."
                value={clinicData.cancellation_policy_text}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    cancellation_policy_text: text,
                  }))
                }
                multiline={true}
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Cancellation Fee (%)
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 0"
                value={clinicData.cancellation_fee_percentage.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    cancellation_fee_percentage: parseInt(text) || 0,
                  }))
                }
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Min Hours to Cancel
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 24"
                value={clinicData.min_hours_to_cancel.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    min_hours_to_cancel: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Min Hours to Reschedule
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 12"
                value={clinicData.min_hours_to_reschedule.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    min_hours_to_reschedule: parseInt(text) || 0,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* No-Show Penalty Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>No-Show Penalty</Text>
            <View style={localStyles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Allow No-Show Penalty
                </Text>
                <Switch
                  value={clinicData.allow_no_show_penalty}
                  onValueChange={(value) =>
                    setClinicData(prev => ({
                      ...prev,
                      allow_no_show_penalty: value,
                    }))
                  }
                  trackColor={{ false: '#ccc', true: '#81c784' }}
                  thumbColor={clinicData.allow_no_show_penalty ? '#4caf50' : '#f44336'}
                />
              </View>
              {clinicData.allow_no_show_penalty && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                    No-Show Penalty (%)
                  </Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder="e.g., 0"
                    value={clinicData.no_show_penalty_percentage.toString()}
                    onChangeText={(text) =>
                      setClinicData(prev => ({
                        ...prev,
                        no_show_penalty_percentage: parseInt(text) || 0,
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholderTextColor="#999"
                  />
                </>
              )}
            </View>
          </View>

          {/* Reminders Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Appointments & Reminders</Text>
            <View style={localStyles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Send Appointment Reminders
                </Text>
                <Switch
                  value={clinicData.send_appointment_reminders}
                  onValueChange={(value) =>
                    setClinicData(prev => ({
                      ...prev,
                      send_appointment_reminders: value,
                    }))
                  }
                  trackColor={{ false: '#ccc', true: '#81c784' }}
                  thumbColor={clinicData.send_appointment_reminders ? '#4caf50' : '#f44336'}
                />
              </View>
              {clinicData.send_appointment_reminders && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                    Reminder Before (hours)
                  </Text>
                  <TextInput
                    style={localStyles.input}
                    placeholder="e.g., 24"
                    value={clinicData.reminder_before_hours.toString()}
                    onChangeText={(text) =>
                      setClinicData(prev => ({
                        ...prev,
                        reminder_before_hours: parseInt(text) || 0,
                      }))
                    }
                    keyboardType="number-pad"
                    placeholderTextColor="#999"
                  />
                </>
              )}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Max Patients Per Slot
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., 1"
                value={clinicData.max_patients_per_slot.toString()}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    max_patients_per_slot: parseInt(text) || 1,
                  }))
                }
                keyboardType="number-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Bookings & Forms Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Bookings & Forms</Text>
            <View style={localStyles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Allow Walk-ins
                </Text>
                <Switch
                  value={clinicData.allow_walk_ins}
                  onValueChange={(value) =>
                    setClinicData(prev => ({
                      ...prev,
                      allow_walk_ins: value,
                    }))
                  }
                  trackColor={{ false: '#ccc', true: '#81c784' }}
                  thumbColor={clinicData.allow_walk_ins ? '#4caf50' : '#f44336'}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Require New Patient Form
                </Text>
                <Switch
                  value={clinicData.require_new_patient_form}
                  onValueChange={(value) =>
                    setClinicData(prev => ({
                      ...prev,
                      require_new_patient_form: value,
                    }))
                  }
                  trackColor={{ false: '#ccc', true: '#81c784' }}
                  thumbColor={clinicData.require_new_patient_form ? '#4caf50' : '#f44336'}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Auto Approve Appointments
                </Text>
                <Switch
                  value={clinicData.auto_approve_appointments}
                  onValueChange={(value) =>
                    setClinicData(prev => ({
                      ...prev,
                      auto_approve_appointments: value,
                    }))
                  }
                  trackColor={{ false: '#ccc', true: '#81c784' }}
                  thumbColor={clinicData.auto_approve_appointments ? '#4caf50' : '#f44336'}
                />
              </View>
            </View>
          </View>

          {/* Payment Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Payment Settings</Text>
            <View style={localStyles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#333' }}>
                  Require Payment Upfront
                </Text>
                <Switch
                  value={clinicData.require_payment_upfront}
                  onValueChange={(value) =>
                    setClinicData(prev => ({
                      ...prev,
                      require_payment_upfront: value,
                    }))
                  }
                  trackColor={{ false: '#ccc', true: '#81c784' }}
                  thumbColor={clinicData.require_payment_upfront ? '#4caf50' : '#f44336'}
                />
              </View>
              {clinicData.require_payment_upfront && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                    Accepted Payment Methods
                  </Text>
                  <View style={{ marginBottom: 12 }}>
                    {['credit_card', 'debit_card', 'upi', 'wallet'].map((method) => (
                      <View
                        key={method}
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                      >
                        <Switch
                          value={clinicData.accepted_payment_methods.includes(method)}
                          onValueChange={(value) => {
                            setClinicData(prev => ({
                              ...prev,
                              accepted_payment_methods: value
                                ? [...prev.accepted_payment_methods, method]
                                : prev.accepted_payment_methods.filter(m => m !== method),
                            }));
                          }}
                          trackColor={{ false: '#ccc', true: '#81c784' }}
                          thumbColor="#4caf50"
                        />
                        <Text style={{ fontSize: 13, marginLeft: 10, color: '#333', fontWeight: '500' }}>
                          {method === 'credit_card'
                            ? 'Credit Card'
                            : method === 'debit_card'
                            ? 'Debit Card'
                            : method === 'upi'
                            ? 'UPI'
                            : 'Wallet'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Additional Notes & Policies Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Additional Information</Text>
            <View style={localStyles.card}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Clinic Notes
              </Text>
              <TextInput
                style={[localStyles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Any additional notes for patients..."
                value={clinicData.clinic_notes}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    clinic_notes: text,
                  }))
                }
                multiline={true}
                placeholderTextColor="#999"
              />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
                Policies URL
              </Text>
              <TextInput
                style={localStyles.input}
                placeholder="e.g., https://clinicpolicies.com"
                value={clinicData.policies_url}
                onChangeText={(text) =>
                  setClinicData(prev => ({
                    ...prev,
                    policies_url: text,
                  }))
                }
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Schedule Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Schedule</Text>
            <View style={localStyles.card}>
              {(Object.entries(clinicData.schedule) as Array<[keyof Schedule, Schedule[keyof Schedule]]>).map(
                ([day, hours]) => (
                  <View key={day} style={localStyles.scheduleDay}>
                    <View style={localStyles.dayColumn}>
                      <Text style={localStyles.dayName}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Text>
                      <TextInput
                        style={[
                          localStyles.dayHours,
                          { marginTop: 4, padding: 4, borderWidth: 1, borderColor: '#ddd', borderRadius: 4 },
                        ]}
                        value={hours.hours}
                        onChangeText={(text) =>
                          handleScheduleHoursChange(day, text)
                        }
                        editable={hours.isOpen}
                        placeholder="HH:MM - HH:MM"
                        placeholderTextColor="#ccc"
                      />
                    </View>
                    <Switch
                      value={hours.isOpen}
                      onValueChange={(value) =>
                        handleScheduleChange(day, value)
                      }
                      trackColor={{ false: '#ccc', true: '#81c784' }}
                      thumbColor={hours.isOpen ? '#4caf50' : '#f44336'}
                    />
                  </View>
                )
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          paddingVertical: 16,
        }}
      >
        <View style={localStyles.footerButtons}>
          <TouchableOpacity
            style={localStyles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={localStyles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={localStyles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={localStyles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
