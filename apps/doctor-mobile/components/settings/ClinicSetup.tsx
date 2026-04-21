import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { supabase } from '@smileguard/supabase-client';
import { useAuth } from '../../hooks/useAuth';
import { pickImage, uploadClinicLogo, uploadClinicGalleryImage, pickMultipleImages, uploadMultipleClinicGalleryImages } from '../../lib/imageUploadService';

interface ClinicSetupProps {
  onClose?: () => void;
  onSave?: (clinicData: ClinicData) => void;
  styles?: any;
}

interface ClinicData {
  clinic_name: string;
  logo_url?: string;
  address: string;
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
  sunday: { isOpen: boolean; opening_time: string; closing_time: string };
  monday: { isOpen: boolean; opening_time: string; closing_time: string };
  tuesday: { isOpen: boolean; opening_time: string; closing_time: string };
  wednesday: { isOpen: boolean; opening_time: string; closing_time: string };
  thursday: { isOpen: boolean; opening_time: string; closing_time: string };
  friday: { isOpen: boolean; opening_time: string; closing_time: string };
  saturday: { isOpen: boolean; opening_time: string; closing_time: string };
}

// Define the day order explicitly
const DAY_ORDER: (keyof Schedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const defaultSchedule: Schedule = {
  sunday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  monday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  tuesday: { isOpen: false, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  wednesday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  thursday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  friday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  saturday: { isOpen: false, opening_time: '10:00 AM', closing_time: '3:00 PM' },
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
  const { currentUser } = useAuth();
  const [clinicData, setClinicData] = useState<ClinicData>({
    clinic_name: '',
    address: '',
    gallery_images: [],
    services: [],
    schedule: defaultSchedule,
  });

  const [newService, setNewService] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showServicesSection, setShowServicesSection] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);
  const [showOpeningTimePicker, setShowOpeningTimePicker] = useState<keyof Schedule | null>(null);
  const [showClosingTimePicker, setShowClosingTimePicker] = useState<keyof Schedule | null>(null);
  const [tempHours, setTempHours] = useState('09');
  const [tempMinutes, setTempMinutes] = useState('00');
  const [tempPeriod, setTempPeriod] = useState<'AM' | 'PM'>('AM');
  const today = new Date();
  const [blockoutDates, setBlockoutDates] = useState<any[]>([]);
  const [showBlockoutDatePicker, setShowBlockoutDatePicker] = useState(false);
  const [blockoutReason, setBlockoutReason] = useState('');
  const [selectedBlockoutDate, setSelectedBlockoutDate] = useState(new Date());
  const [tempBlockoutDay, setTempBlockoutDay] = useState(today.getDate().toString());
  const [tempBlockoutMonth, setTempBlockoutMonth] = useState((today.getMonth() + 1).toString());
  const [tempBlockoutYear, setTempBlockoutYear] = useState(today.getFullYear().toString());
  const [showImageFormatModal, setShowImageFormatModal] = useState(false);
  const [pendingImageUploadType, setPendingImageUploadType] = useState<'logo' | 'gallery' | null>(null);
  
  // Change tracking
  const [originalClinicData, setOriginalClinicData] = useState<ClinicData | null>(null);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());

  // Helper: Check if data has unsaved changes
  const hasUnsavedChanges = () => {
    if (!originalClinicData) return false;
    
    return (
      clinicData.clinic_name !== originalClinicData.clinic_name ||
      clinicData.address !== originalClinicData.address ||
      clinicData.logo_url !== originalClinicData.logo_url ||
      JSON.stringify(clinicData.gallery_images) !== JSON.stringify(originalClinicData.gallery_images) ||
      JSON.stringify(clinicData.services) !== JSON.stringify(originalClinicData.services) ||
      JSON.stringify(clinicData.schedule) !== JSON.stringify(originalClinicData.schedule)
    );
  };

  // Helper: Update changed fields tracking
  const updateChangedFields = () => {
    if (!originalClinicData) return;
    
    const changed = new Set<string>();
    
    if (clinicData.clinic_name !== originalClinicData.clinic_name) changed.add('clinic_name');
    if (clinicData.address !== originalClinicData.address) changed.add('address');
    if (clinicData.logo_url !== originalClinicData.logo_url) changed.add('logo_url');
    if (JSON.stringify(clinicData.gallery_images) !== JSON.stringify(originalClinicData.gallery_images)) changed.add('gallery_images');
    if (JSON.stringify(clinicData.services) !== JSON.stringify(originalClinicData.services)) changed.add('services');
    if (JSON.stringify(clinicData.schedule) !== JSON.stringify(originalClinicData.schedule)) changed.add('schedule');
    
    setChangedFields(changed);
  };

  // Load clinic data from database on component mount
  useEffect(() => {
    const loadClinicData = async () => {
      if (!currentUser?.id) {
        setInitialLoading(false);
        return;
      }

      try {
        // Load both clinic_setup and blockout_dates in parallel for faster loading
        const [clinicResponse, blockoutResponse] = await Promise.all([
          supabase
            .from('clinic_setup')
            .select('clinic_name, address, logo_url, gallery_images, services, schedule')
            .eq('user_id', currentUser.id)
            .single(),
          supabase
            .from('clinic_blockout_dates')
            .select('blockout_date, reason, is_blocked')
            .eq('user_id', currentUser.id)
            .order('blockout_date', { ascending: true }),
        ]);

        const { data, error } = clinicResponse;
        const { data: blockoutData, error: blockoutError } = blockoutResponse;

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading clinic data:', error);
        } else if (data) {
          // Helper to safely parse gallery images
          let galleryImages: string[] = [];
          if (data.gallery_images) {
            if (Array.isArray(data.gallery_images)) {
              galleryImages = data.gallery_images;
            } else if (typeof data.gallery_images === 'string') {
              try {
                galleryImages = JSON.parse(data.gallery_images);
                if (!Array.isArray(galleryImages)) {
                  galleryImages = [];
                }
              } catch (e) {
                console.warn('Failed to parse gallery_images:', e);
                galleryImages = [];
              }
            }
          }
          
          const loadedData = {
            clinic_name: data.clinic_name || '',
            address: data.address || '',
            logo_url: data.logo_url || undefined,
            gallery_images: galleryImages,
            services: data.services || [],
            schedule: data.schedule || defaultSchedule,
          };
          setClinicData(loadedData);
          setOriginalClinicData(loadedData);
          setChangedFields(new Set());
          
          // Set blockout dates if loaded successfully
          if (!blockoutError && blockoutData) {
            setBlockoutDates(blockoutData);
          }
        }
      } catch (error) {
        console.error('Failed to load clinic data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadClinicData();
  }, [currentUser?.id]);

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
    saveButtonChanged: {
      flex: 1,
      backgroundColor: '#d32f2f',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#ff6f00',
    },
    sectionChanged: {
      backgroundColor: '#fff3cd',
      borderLeftWidth: 4,
      borderLeftColor: '#ffc107',
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
      setClinicData(prev => {
        const updated = {
          ...prev,
          services: [
            ...prev.services,
            {
              id: Date.now().toString(),
              name: newService,
              description: '',
            },
          ],
        };
        setTimeout(() => updateChangedFields(), 0);
        return updated;
      });
      setNewService('');
    }
  };

  const handleRemoveService = (id: string) => {
    setClinicData(prev => {
      const updated = {
        ...prev,
        services: prev.services.filter(service => service.id !== id),
      };
      setTimeout(() => updateChangedFields(), 0);
      return updated;
    });
  };

  const handleUploadLogo = async () => {
    setPendingImageUploadType('logo');
    setShowImageFormatModal(true);
  };

  const performLogoUpload = async (aspectRatio?: [number, number]) => {
    try {
      const image = await pickImage(aspectRatio);
      if (!image) return;

      Alert.alert(
        'Confirm Logo Upload',
        'Do you want to use this image as your clinic logo?',
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Upload',
            onPress: async () => {
              setUploadingLogo(true);
              try {
                const logoUrl = await uploadClinicLogo(image, currentUser?.id || '');
                setClinicData(prev => ({
                  ...prev,
                  logo_url: logoUrl,
                }));
                Alert.alert('Success', 'Logo uploaded successfully');
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to upload logo';
                Alert.alert('Error', message);
              } finally {
                setUploadingLogo(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pick image';
      Alert.alert('Error', message);
    }
  };

  const handleUploadGalleryImage = async () => {
    setPendingImageUploadType('gallery');
    setShowImageFormatModal(true);
  };

  const performGalleryUpload = async (aspectRatio?: [number, number]) => {
    try {
      const images = await pickMultipleImages(aspectRatio);
      if (!images || images.length === 0) return;

      setUploadingGalleryImage(true);
      try {
        const imageUrls = await uploadMultipleClinicGalleryImages(images, currentUser?.id || '');
        
        if (imageUrls.length > 0) {
          setClinicData(prev => {
            const updated = {
              ...prev,
              gallery_images: [...(prev.gallery_images || []), ...imageUrls],
            };
            setTimeout(() => updateChangedFields(), 0);
            return updated;
          });
          Alert.alert('Success', `${imageUrls.length} image(s) added to gallery`);
        } else {
          Alert.alert('Error', 'No images were uploaded successfully');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload gallery images';
        Alert.alert('Error', message);
      } finally {
        setUploadingGalleryImage(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pick images';
      Alert.alert('Error', message);
    }
  };

  const handleRemoveGalleryImage = (imageUrl: string) => {
    setClinicData(prev => {
      const updated = {
        ...prev,
        gallery_images: prev.gallery_images?.filter(url => url !== imageUrl) || [],
      };
      setTimeout(() => updateChangedFields(), 0);
      return updated;
    });
  };

  const handleScheduleChange = (day: keyof Schedule, isOpen: boolean) => {
    setClinicData(prev => {
      const updated = {
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...prev.schedule[day],
            isOpen,
          },
        },
      };
      setTimeout(() => updateChangedFields(), 0);
      return updated;
    });
  };

  const handleOpeningTimeChange = (day: keyof Schedule, opening_time: string) => {
    setClinicData(prev => {
      const updated = {
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...prev.schedule[day],
            opening_time,
          },
        },
      };
      setTimeout(() => updateChangedFields(), 0);
      return updated;
    });
  };

  const handleClosingTimeChange = (day: keyof Schedule, closing_time: string) => {
    setClinicData(prev => {
      const updated = {
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...prev.schedule[day],
            closing_time,
          },
        },
      };
      setTimeout(() => updateChangedFields(), 0);
      return updated;
    });
  };

  // Helper function to parse time string (e.g., "9:00 AM") to hours, minutes, period
  const parseTimeString = (timeString: string) => {
    const [time, period] = timeString.split(' ');
    const [hours, minutes] = time.split(':');
    return { hours, minutes, period: period as 'AM' | 'PM' };
  };

  // Helper function to create time string from components
  const createTimeString = (hours: string, minutes: string, period: 'AM' | 'PM'): string => {
    return `${hours}:${minutes} ${period}`;
  };

  const openOpeningTimePicker = (day: keyof Schedule) => {
    const { hours, minutes, period } = parseTimeString(clinicData.schedule[day].opening_time);
    setTempHours(hours);
    setTempMinutes(minutes);
    setTempPeriod(period);
    setShowOpeningTimePicker(day);
  };

  const openClosingTimePicker = (day: keyof Schedule) => {
    const { hours, minutes, period } = parseTimeString(clinicData.schedule[day].closing_time);
    setTempHours(hours);
    setTempMinutes(minutes);
    setTempPeriod(period);
    setShowClosingTimePicker(day);
  };

  const confirmOpeningTime = (day: keyof Schedule | null) => {
    if (day) {
      handleOpeningTimeChange(day, createTimeString(tempHours, tempMinutes, tempPeriod));
    }
    setShowOpeningTimePicker(null);
  };

  const confirmClosingTime = (day: keyof Schedule | null) => {
    if (day) {
      handleClosingTimeChange(day, createTimeString(tempHours, tempMinutes, tempPeriod));
    }
    setShowClosingTimePicker(null);
  };

  const handleAddBlockoutDate = async (selectedDate: Date | null, month: number, day: number, year: number) => {
    if (!currentUser?.id) return;

    try {
      // Use the exact values selected to avoid timezone conversion issues
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Check if already exists
      const existing = blockoutDates.find(b => b.blockout_date === dateStr);
      if (existing) {
        Alert.alert('Error', 'This date is already blocked');
        return;
      }

      // Insert into database
      const { error } = await supabase
        .from('clinic_blockout_dates')
        .insert({
          user_id: currentUser.id,
          blockout_date: dateStr,
          reason: blockoutReason || 'Blocked',
          is_blocked: true,
        });

      if (error) throw error;

      // Add to local state
      setBlockoutDates(prev => [
        ...prev,
        { blockout_date: dateStr, reason: blockoutReason || 'Blocked', is_blocked: true }
      ]);
      
      setBlockoutReason('');
      setShowBlockoutDatePicker(false);
      Alert.alert('Success', 'Blockout date added');
    } catch (error) {
      console.error('Error adding blockout date:', error);
      Alert.alert('Error', 'Failed to add blockout date');
    }
  };

  const handleRemoveBlockoutDate = async (dateStr: string) => {
    if (!currentUser?.id) return;

    try {
      const { error } = await supabase
        .from('clinic_blockout_dates')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('blockout_date', dateStr);

      if (error) throw error;

      setBlockoutDates(prev => prev.filter(b => b.blockout_date !== dateStr));
      Alert.alert('Success', 'Blockout date removed');
    } catch (error) {
      console.error('Error removing blockout date:', error);
      Alert.alert('Error', 'Failed to remove blockout date');
    }
  };

  const handleSave = async () => {
    if (!clinicData.clinic_name.trim() || !clinicData.address.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        user_id: currentUser.id,
        clinic_name: clinicData.clinic_name,
        address: clinicData.address,
        logo_url: clinicData.logo_url || null,
        gallery_images: clinicData.gallery_images || [],
        services: clinicData.services || [],
        schedule: clinicData.schedule,
        updated_at: new Date().toISOString(),
      };

      // Try to upsert (insert or update) clinic data
      const { error } = await supabase
        .from('clinic_setup')
        .upsert(dataToSave, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }

      if (onSave) {
        await onSave(clinicData);
      }
      
      // Reset original data to current data after successful save
      setOriginalClinicData(clinicData);
      setChangedFields(new Set());

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
      {initialLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0b7fab" />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ padding: 16 }}>
          <Text style={localStyles.header}>Clinic Setup</Text>

          {/* Clinic Name Section */}
          <View style={[localStyles.section, changedFields.has('clinic_name') && localStyles.sectionChanged]}>
            <Text style={localStyles.sectionTitle}>Clinic Name</Text>
            <View style={localStyles.card}>
              <TextInput
                style={localStyles.input}
                placeholder="Enter clinic name"
                value={clinicData.clinic_name}
                onChangeText={(text) => {
                  setClinicData(prev => ({ ...prev, clinic_name: text }));
                  updateChangedFields();
                }}
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Clinic Logo Section */}
          <View style={[localStyles.section, changedFields.has('logo_url') && localStyles.sectionChanged]}>
            <Text style={localStyles.sectionTitle}> Clinic Logo</Text>
            <View style={localStyles.card}>
              <View style={localStyles.logoContainer}>
                <Image
                  source={{
                    uri: clinicData.logo_url || 'https://via.placeholder.com/120',
                  }}
                  style={localStyles.logoImage}
                />
                <TouchableOpacity 
                  style={localStyles.logoButton}
                  onPress={handleUploadLogo}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={localStyles.buttonText}>Upload Logo</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Address Section */}
          <View style={[localStyles.section, changedFields.has('address') && localStyles.sectionChanged]}>
            <Text style={localStyles.sectionTitle}> Address</Text>
            <View style={localStyles.card}>
              <TextInput
                style={localStyles.input}
                placeholder="Street Address"
                value={clinicData.address}
                onChangeText={(text) => {
                  setClinicData(prev => ({ ...prev, address: text }));
                  updateChangedFields();
                }}
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Clinic Gallery Section */}
          <View style={[localStyles.section, changedFields.has('gallery_images') && localStyles.sectionChanged]}>
            <Text style={localStyles.sectionTitle}>️ Clinic Pictures</Text>
            <View style={localStyles.card}>
              <View style={localStyles.galleryContainer}>
                {clinicData.gallery_images?.map((image, index) => (
                  <View key={index} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: image }}
                      style={localStyles.galleryImage}
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveGalleryImage(image)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: 8,
                        width: 24,
                        height: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity 
                  style={localStyles.addImageButton}
                  onPress={handleUploadGalleryImage}
                  disabled={uploadingGalleryImage}
                >
                  {uploadingGalleryImage ? (
                    <ActivityIndicator color="#0b7fab" />
                  ) : (
                    <Text style={localStyles.addImageText}>+</Text>
                  )}
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

          {/* Schedule Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}> Schedule</Text>
            <View style={localStyles.card}>
              {DAY_ORDER.map((day) => {
                const schedule = clinicData.schedule[day];
                return (
                  <View key={day} style={localStyles.scheduleDay}>
                    <View style={localStyles.dayColumn}>
                      <Text style={localStyles.dayName}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Text>
                      {schedule.isOpen && (
                        <>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity 
                              style={{
                                flex: 1,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: '#0b7fab',
                                borderRadius: 8,
                                padding: 12,
                                alignItems: 'center',
                              }}
                              onPress={() => openOpeningTimePicker(day as keyof Schedule)}
                            >
                              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>From</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b7fab' }}>
                                {schedule.opening_time}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={{
                                flex: 1,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: '#0b7fab',
                                borderRadius: 8,
                                padding: 12,
                                alignItems: 'center',
                              }}
                              onPress={() => openClosingTimePicker(day as keyof Schedule)}
                            >
                              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>To</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b7fab' }}>
                                {schedule.closing_time}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                      {!schedule.isOpen && (
                        <Text style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Closed</Text>
                      )}
                    </View>
                    <Switch
                      value={schedule.isOpen}
                      onValueChange={(value) =>
                        handleScheduleChange(day as keyof Schedule, value)
                      }
                      trackColor={{ false: '#ccc', true: '#81c784' }}
                      thumbColor={schedule.isOpen ? '#4caf50' : '#f44336'}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* One-Time Blockout Dates Section */}
          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>One-Time Blockout Dates</Text>
            <View style={localStyles.card}>
              <TouchableOpacity 
                onPress={() => {
                  const today = new Date();
                  setTempBlockoutDay(today.getDate().toString());
                  setTempBlockoutMonth((today.getMonth() + 1).toString());
                  setTempBlockoutYear(today.getFullYear().toString());
                  setBlockoutReason('');
                  setShowBlockoutDatePicker(true);
                }}
                style={{
                  backgroundColor: '#0b7fab',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add Blockout Date</Text>
              </TouchableOpacity>

              {blockoutDates.length === 0 ? (
                <Text style={{ fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 12 }}>
                  No blockout dates set
                </Text>
              ) : (
                <View>
                  {blockoutDates.map((blockout) => (
                    <View key={blockout.blockout_date} style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#eee',
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#333', fontWeight: '600' }}>
                          {new Date(blockout.blockout_date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Text>
                        {blockout.reason && (
                          <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                            {blockout.reason}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity 
                        onPress={() => handleRemoveBlockoutDate(blockout.blockout_date)}
                        style={{ padding: 8 }}
                      >
                        <Text style={{ color: '#d32f2f', fontSize: 20, fontWeight: 'bold' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
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
                style={hasUnsavedChanges() ? localStyles.saveButtonChanged : localStyles.saveButton}
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
        </>
      )}

      {/* Time Pickers */}
      <Modal
        visible={showOpeningTimePicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOpeningTimePicker(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Select Opening Time</Text>
              <TouchableOpacity onPress={() => setShowOpeningTimePicker(null)}>
                <Text style={{ fontSize: 28, color: '#999' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, alignItems: 'center', marginBottom: 24 }}>
              {/* Hours */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let h = parseInt(tempHours) || 1;
                    h = h === 12 ? 1 : h + 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 32,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 70,
                    color: '#0b7fab',
                  }}
                  value={tempHours}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempHours('');
                    } else {
                      let num = parseInt(cleaned);
                      if (num > 12) num = 12;
                      if (num < 1) num = 1;
                      setTempHours(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1"
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let h = parseInt(tempHours) || 1;
                    h = h === 1 ? 12 : h - 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#333' }}>:</Text>

              {/* Minutes */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let m = parseInt(tempMinutes) || 0;
                    m = m + 1;
                    if (m >= 60) m = 0;
                    setTempMinutes(m.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 32,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 70,
                    color: '#0b7fab',
                  }}
                  value={tempMinutes}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempMinutes('');
                    } else {
                      let num = parseInt(cleaned);
                      if (num > 59) num = 59;
                      setTempMinutes(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let m = parseInt(tempMinutes) || 0;
                    m = m - 1;
                    if (m < 0) m = 59;
                    setTempMinutes(m.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Period */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => setTempPeriod(tempPeriod === 'AM' ? 'PM' : 'AM')}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 28,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 70,
                    color: '#0b7fab',
                  }}
                  value={tempPeriod}
                  editable={false}
                />
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => setTempPeriod(tempPeriod === 'AM' ? 'PM' : 'AM')}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => setShowOpeningTimePicker(null)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#0b7fab',
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => confirmOpeningTime(showOpeningTimePicker)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showClosingTimePicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowClosingTimePicker(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Select Closing Time</Text>
              <TouchableOpacity onPress={() => setShowClosingTimePicker(null)}>
                <Text style={{ fontSize: 28, color: '#999' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, alignItems: 'center', marginBottom: 24 }}>
              {/* Hours */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let h = parseInt(tempHours) || 1;
                    h = h === 12 ? 1 : h + 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 32,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 70,
                    color: '#0b7fab',
                  }}
                  value={tempHours}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempHours('');
                    } else {
                      let num = parseInt(cleaned);
                      if (num > 12) num = 12;
                      if (num < 1) num = 1;
                      setTempHours(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1"
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let h = parseInt(tempHours) || 1;
                    h = h === 1 ? 12 : h - 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#333' }}>:</Text>

              {/* Minutes */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let m = parseInt(tempMinutes) || 0;
                    m = m + 1;
                    if (m >= 60) m = 0;
                    setTempMinutes(m.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 32,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 70,
                    color: '#0b7fab',
                  }}
                  value={tempMinutes}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempMinutes('');
                    } else {
                      let num = parseInt(cleaned);
                      if (num > 59) num = 59;
                      setTempMinutes(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0"
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => {
                    let m = parseInt(tempMinutes) || 0;
                    m = m - 1;
                    if (m < 0) m = 59;
                    setTempMinutes(m.toString());
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Period */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => setTempPeriod(tempPeriod === 'AM' ? 'PM' : 'AM')}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 28,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 70,
                    color: '#0b7fab',
                  }}
                  value={tempPeriod}
                  editable={false}
                />
                <TouchableOpacity
                  style={{ padding: 12 }}
                  onPress={() => setTempPeriod(tempPeriod === 'AM' ? 'PM' : 'AM')}
                >
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => setShowClosingTimePicker(null)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#0b7fab',
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => confirmClosingTime(showClosingTimePicker)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Format Selection Modal */}
      <Modal
        visible={showImageFormatModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImageFormatModal(false);
          setPendingImageUploadType(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '80%', maxWidth: 400 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' }}>
              Choose Image Format
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: '#f5f5f5',
                borderWidth: 2,
                borderColor: '#0b7fab',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                alignItems: 'center',
              }}
              onPress={() => {
                setShowImageFormatModal(false);
                if (pendingImageUploadType === 'logo') {
                  performLogoUpload([1, 1]);
                } else if (pendingImageUploadType === 'gallery') {
                  performGalleryUpload([1, 1]);
                }
                setPendingImageUploadType(null);
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0b7fab' }}>Square (1:1)</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Fixed square aspect ratio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#f5f5f5',
                borderWidth: 2,
                borderColor: '#0b7fab',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                alignItems: 'center',
              }}
              onPress={() => {
                setShowImageFormatModal(false);
                if (pendingImageUploadType === 'logo') {
                  performLogoUpload(undefined);
                } else if (pendingImageUploadType === 'gallery') {
                  performGalleryUpload(undefined);
                }
                setPendingImageUploadType(null);
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0b7fab' }}>Free Form</Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Crop any size you want</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                borderWidth: 2,
                borderColor: '#ddd',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center',
              }}
              onPress={() => {
                setShowImageFormatModal(false);
                setPendingImageUploadType(null);
              }}
            >
              <Text style={{ color: '#666', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blockout Date Picker Modal */}
      <Modal
        visible={showBlockoutDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBlockoutDatePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Add Blockout Date</Text>
              <TouchableOpacity onPress={() => setShowBlockoutDatePicker(false)}>
                <Text style={{ fontSize: 28, color: '#999' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 16 }}>Select Date</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center', marginBottom: 24 }}>
              {/* Month */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    let m = parseInt(tempBlockoutMonth) || 1;
                    m = m === 12 ? 1 : m + 1;
                    setTempBlockoutMonth(m.toString());
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 18,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 50,
                    color: '#0b7fab',
                  }}
                  value={tempBlockoutMonth}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempBlockoutMonth('');
                    } else {
                      let num = parseInt(cleaned);
                      const currentYear = today.getFullYear();
                      const currentMonth = today.getMonth() + 1;
                      const selectedYear = parseInt(tempBlockoutYear) || currentYear;
                      
                      if (num > 12) num = 12;
                      if (num < 1) num = 1;
                      
                      // If year is current, don't allow month below current month
                      if (selectedYear === currentYear && num < currentMonth) {
                        num = currentMonth;
                      }
                      
                      setTempBlockoutMonth(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1"
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    let m = parseInt(tempBlockoutMonth) || 1;
                    let y = parseInt(tempBlockoutYear) || today.getFullYear();
                    const currentYear = today.getFullYear();
                    const currentMonth = today.getMonth() + 1;
                    
                    // Don't go below current month if it's current year
                    if (y === currentYear && m <= currentMonth) {
                      return;
                    }
                    
                    m = m === 1 ? 12 : m - 1;
                    setTempBlockoutMonth(m.toString());
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>/</Text>

              {/* Day */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    let d = parseInt(tempBlockoutDay) || 1;
                    d = d === 31 ? 1 : d + 1;
                    setTempBlockoutDay(d.toString());
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 18,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 50,
                    color: '#0b7fab',
                  }}
                  value={tempBlockoutDay}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempBlockoutDay('');
                    } else {
                      let num = parseInt(cleaned);
                      const currentYear = today.getFullYear();
                      const currentMonth = today.getMonth() + 1;
                      const currentDay = today.getDate();
                      const selectedYear = parseInt(tempBlockoutYear) || currentYear;
                      const selectedMonth = parseInt(tempBlockoutMonth) || 1;
                      
                      if (num > 31) num = 31;
                      if (num < 1) num = 1;
                      
                      // If year and month are current, don't allow day below current day
                      if (selectedYear === currentYear && selectedMonth === currentMonth && num < currentDay) {
                        num = currentDay;
                      }
                      
                      setTempBlockoutDay(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1"
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    let d = parseInt(tempBlockoutDay) || 1;
                    let m = parseInt(tempBlockoutMonth) || 1;
                    let y = parseInt(tempBlockoutYear) || today.getFullYear();
                    const currentYear = today.getFullYear();
                    const currentMonth = today.getMonth() + 1;
                    const currentDay = today.getDate();
                    
                    // Don't go below current day if it's current month and year
                    if (y === currentYear && m === currentMonth && d <= currentDay) {
                      return;
                    }
                    
                    d = d === 1 ? 31 : d - 1;
                    setTempBlockoutDay(d.toString());
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>/</Text>

              {/* Year */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    let y = parseInt(tempBlockoutYear) || new Date().getFullYear();
                    setTempBlockoutYear((y + 1).toString());
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b7fab' }}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 18,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    width: 60,
                    color: '#0b7fab',
                  }}
                  value={tempBlockoutYear}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (cleaned === '') {
                      setTempBlockoutYear('');
                    } else {
                      let num = parseInt(cleaned);
                      const currentYear = new Date().getFullYear();
                      if (num < currentYear) num = currentYear;
                      setTempBlockoutYear(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder={new Date().getFullYear().toString()}
                  placeholderTextColor="#ccc"
                />
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => {
                    let y = parseInt(tempBlockoutYear) || new Date().getFullYear();
                    const currentYear = new Date().getFullYear();
                    // Don't go below current year
                    if (y <= currentYear) {
                      return;
                    }
                    setTempBlockoutYear((y - 1).toString());
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b7fab' }}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                marginBottom: 24,
                color: '#333',
              }}
              placeholder="Reason (optional)"
              placeholderTextColor="#999"
              value={blockoutReason}
              onChangeText={setBlockoutReason}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 2,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowBlockoutDatePicker(false);
                  setBlockoutReason('');
                  const resetToday = new Date();
                  setTempBlockoutDay(resetToday.getDate().toString());
                  setTempBlockoutMonth((resetToday.getMonth() + 1).toString());
                  setTempBlockoutYear(resetToday.getFullYear().toString());
                }}
              >
                <Text style={{ color: '#666', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#0b7fab',
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
                onPress={() => {
                  const month = parseInt(tempBlockoutMonth) || 1;
                  const day = parseInt(tempBlockoutDay) || 1;
                  const year = parseInt(tempBlockoutYear) || 2026;
                  handleAddBlockoutDate(null, month, day, year);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
