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
  });

  const [newService, setNewService] = useState('');
  const [loading, setLoading] = useState(false);

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

    if (clinicData.services.length === 0) {
      Alert.alert('Error', 'Please add at least one service');
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
            <Text style={localStyles.sectionTitle}> Clinic Logo</Text>
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
            <Text style={localStyles.sectionTitle}> Address</Text>
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
            <Text style={localStyles.sectionTitle}>️ Clinic Pictures</Text>
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
            <Text style={localStyles.sectionTitle}>🦷 Services Offered</Text>
            <View style={localStyles.card}>
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

              <View style={localStyles.addServiceContainer}>
                <TextInput
                  style={localStyles.addServiceInput}
                  placeholder="Add a service..."
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
          </View>

          {/* Schedule Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}> Schedule</Text>
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
