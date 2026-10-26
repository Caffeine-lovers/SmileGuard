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
  Modal,
  Platform,
} from 'react-native';
import {
  X,
  Check,
  Camera,
  Building2,
  Clock,
  Calendar,
  Plus,
  Trash2,
  MapPin,
  Sparkles,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react-native';
import { supabase } from '@smileguard/supabase-client';
import { useAuth } from '../../hooks/useAuth';
import { useClinic } from '../../contexts/ClinicContext';
import {
  pickImage,
  uploadClinicLogo,
  pickMultipleImages,
  uploadMultipleClinicGalleryImages,
} from '../../lib/imageUploadService';

const APP_LOGO = require('../../assets/images/SmileGuard-Doc-Logo.png');

export interface ClinicSetupProps {
  onClose?: () => void;
  onSave?: (clinicData: ClinicData) => void;
  onSkip?: () => void;
  isRegistration?: boolean;
  styles?: any;
  initialMode?: 'view' | 'edit';
}

export interface ClinicData {
  clinic_name: string;
  logo_url?: string;
  address: string;
  gallery_images?: string[];
  services: Service[];
  schedule: Schedule;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price?: number;
}

export interface DaySchedule {
  isOpen: boolean;
  opening_time: string;
  closing_time: string;
}

export interface Schedule {
  sunday: DaySchedule;
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
}

export interface BlockoutDate {
  blockout_date: string;
  reason?: string;
  is_blocked?: boolean;
}

const DAY_ORDER: (keyof Schedule)[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const DAY_LABELS: Record<keyof Schedule, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const defaultSchedule: Schedule = {
  sunday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  monday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  tuesday: { isOpen: false, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  wednesday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  thursday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  friday: { isOpen: true, opening_time: '10:00 AM', closing_time: '3:00 PM' },
  saturday: { isOpen: false, opening_time: '10:00 AM', closing_time: '3:00 PM' },
};

export const DEFAULT_SERVICE_PRICES: Record<string, number> = {
  'Cleaning': 1500,
  'Whitening': 5000,
  'Fillings': 2000,
  'Root Canal': 8000,
  'Extraction': 1500,
  'Braces Consultation': 35000,
  'Implants Consultation': 45000,
  'X-Ray': 500,
  'Checkup': 300,
};

const PREDEFINED_SERVICES = [
  'Cleaning',
  'Whitening',
  'Fillings',
  'Root Canal',
  'Extraction',
  'Braces Consultation',
  'Implants Consultation',
  'X-Ray',
  'Checkup',
];

const DEFAULT_SERVICES: Service[] = PREDEFINED_SERVICES.map((name, index) => ({
  id: `default_service_${index + 1}`,
  name,
  description: '',
  price: DEFAULT_SERVICE_PRICES[name] || 1500,
}));

export default function ClinicSetup({
  onClose,
  onSave,
  onSkip,
  isRegistration = false,
  initialMode = 'view',
}: ClinicSetupProps) {
  const { currentUser } = useAuth();
  const { refetch: refetchClinic } = useClinic();

  const [isEditing, setIsEditing] = useState(initialMode === 'edit');
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noClinicRecord, setNoClinicRecord] = useState(false);
  const [clinicSetupId, setClinicSetupId] = useState<string | null>(null);

  const [clinicData, setClinicData] = useState<ClinicData>({
    clinic_name: '',
    address: '',
    gallery_images: [],
    services: DEFAULT_SERVICES,
    schedule: defaultSchedule,
  });

  const [originalClinicData, setOriginalClinicData] = useState<ClinicData | null>(null);
  const [blockoutDates, setBlockoutDates] = useState<BlockoutDate[]>([]);

  // Editing state
  const [newService, setNewService] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [lastCustomLogoUrl, setLastCustomLogoUrl] = useState<string | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Time Picker states
  const [showOpeningTimePicker, setShowOpeningTimePicker] = useState<keyof Schedule | null>(null);
  const [showClosingTimePicker, setShowClosingTimePicker] = useState<keyof Schedule | null>(null);
  const [tempHours, setTempHours] = useState('09');
  const [tempMinutes, setTempMinutes] = useState('00');
  const [tempPeriod, setTempPeriod] = useState<'AM' | 'PM'>('AM');

  // Blockout Date Picker states
  const today = new Date();
  const [showBlockoutDatePicker, setShowBlockoutDatePicker] = useState(false);
  const [blockoutReason, setBlockoutReason] = useState('');
  const [tempBlockoutDay, setTempBlockoutDay] = useState(today.getDate().toString());
  const [tempBlockoutMonth, setTempBlockoutMonth] = useState((today.getMonth() + 1).toString());
  const [tempBlockoutYear, setTempBlockoutYear] = useState(today.getFullYear().toString());

  // Image Format Modal state
  const [showImageFormatModal, setShowImageFormatModal] = useState(false);
  const [pendingUploadType, setPendingUploadType] = useState<'logo' | 'gallery' | null>(null);

  // Load clinic data and blockout dates
  useEffect(() => {
    const loadClinicData = async () => {
      try {
        setInitialLoading(true);
        const [clinicResponse, blockoutResponse] = await Promise.all([
          supabase
            .from('clinic_setup')
            .select('id, clinic_name, address, logo_url, gallery_images, services, schedule')
            .limit(1),
          supabase
            .from('clinic_blockout_dates')
            .select('blockout_date, reason, is_blocked')
            .order('blockout_date', { ascending: true }),
        ]);

        const { data: clinicArray, error: clinicError } = clinicResponse;
        const { data: blockoutData, error: blockoutError } = blockoutResponse;

        if (clinicError) {
          console.error('[ClinicSetup] Error loading clinic data:', clinicError);
        }

        const data = clinicArray && clinicArray.length > 0 ? clinicArray[0] : null;

        if (data) {
          let galleryImages: string[] = [];
          if (data.gallery_images) {
            if (Array.isArray(data.gallery_images)) {
              galleryImages = data.gallery_images;
            } else if (typeof data.gallery_images === 'string') {
              try {
                galleryImages = JSON.parse(data.gallery_images);
                if (!Array.isArray(galleryImages)) galleryImages = [];
              } catch {
                galleryImages = [];
              }
            }
          }

          let servicesList: Service[] = [];
          if (data.services) {
            if (Array.isArray(data.services)) {
              servicesList = data.services.map((s: any, idx: number) => {
                if (typeof s === 'string') {
                  return {
                    id: `service_${idx}_${Date.now()}`,
                    name: s,
                    description: '',
                    price: DEFAULT_SERVICE_PRICES[s] || 1500,
                  };
                }
                const parsedPrice =
                  typeof s.price === 'number'
                    ? s.price
                    : parseFloat(s.price) || DEFAULT_SERVICE_PRICES[s.name] || 1500;
                return {
                  ...s,
                  price: parsedPrice,
                };
              });
            } else if (typeof data.services === 'string') {
              try {
                const parsed = JSON.parse(data.services);
                if (Array.isArray(parsed)) {
                  servicesList = parsed.map((s: any, idx: number) => {
                    if (typeof s === 'string') {
                      return {
                        id: `service_${idx}_${Date.now()}`,
                        name: s,
                        description: '',
                        price: DEFAULT_SERVICE_PRICES[s] || 1500,
                      };
                    }
                    const parsedPrice =
                      typeof s.price === 'number'
                        ? s.price
                        : parseFloat(s.price) || DEFAULT_SERVICE_PRICES[s.name] || 1500;
                    return {
                      ...s,
                      price: parsedPrice,
                    };
                  });
                }
              } catch {
                servicesList = [];
              }
            }
          }

          // Fallback to standard clinic services if none are currently saved in the database
          if (servicesList.length === 0) {
            servicesList = DEFAULT_SERVICES;
          }

          const loadedData: ClinicData = {
            clinic_name: data.clinic_name || '',
            address: data.address || '',
            logo_url: data.logo_url || undefined,
            gallery_images: galleryImages,
            services: servicesList,
            schedule: data.schedule || defaultSchedule,
          };

          setClinicSetupId(data.id);
          setClinicData(loadedData);
          setOriginalClinicData(loadedData);
          if (data.logo_url && data.logo_url !== 'APP_LOGO') {
            setLastCustomLogoUrl(data.logo_url);
          }
          setNoClinicRecord(false);

          if (!blockoutError && blockoutData) {
            setBlockoutDates(blockoutData);
          }
        } else {
          setNoClinicRecord(true);
          setIsEditing(true);
        }
      } catch (error) {
        console.error('[ClinicSetup] Failed to load data:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadClinicData();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SERVICES HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleAddService = (nameToAdd?: string, priceToAdd?: number) => {
    const serviceName = (nameToAdd || newService).trim();
    if (!serviceName) return;

    if (clinicData.services.some((s) => s.name.toLowerCase() === serviceName.toLowerCase())) {
      Alert.alert('Notice', 'This service has already been added.');
      return;
    }

    const price =
      priceToAdd !== undefined
        ? priceToAdd
        : newServicePrice
        ? parseFloat(newServicePrice.replace(/[^0-9.]/g, '')) || (DEFAULT_SERVICE_PRICES[serviceName] || 1500)
        : (DEFAULT_SERVICE_PRICES[serviceName] || 1500);

    setClinicData((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          id: Date.now().toString(),
          name: serviceName,
          description: '',
          price,
        },
      ],
    }));
    if (!nameToAdd) {
      setNewService('');
      setNewServicePrice('');
    }
  };

  const handleUpdateServicePrice = (id: string, priceText: string) => {
    const numeric = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
    setClinicData((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, price: numeric } : s)),
    }));
  };

  const handleRemoveService = (id: string) => {
    setClinicData((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s.id !== id),
    }));
  };

  // ─────────────────────────────────────────────────────────────
  // LOGO UPLOAD HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleUploadLogoPress = () => {
    setPendingUploadType('logo');
    setShowImageFormatModal(true);
  };

  const performLogoUpload = async (aspectRatio?: [number, number]) => {
    try {
      const image = await pickImage(aspectRatio);
      if (!image) return;

      setUploadingLogo(true);
      try {
        const logoUrl = await uploadClinicLogo(image, currentUser?.id || 'clinic');
        setClinicData((prev) => ({
          ...prev,
          logo_url: logoUrl,
        }));
        setLastCustomLogoUrl(logoUrl);
        Alert.alert('Success', 'Clinic custom logo updated successfully!');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload logo';
        Alert.alert('Upload Failed', message);
      } finally {
        setUploadingLogo(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pick image';
      Alert.alert('Error', message);
    }
  };

  const handleSelectAppLogo = () => {
    setClinicData((prev) => ({
      ...prev,
      logo_url: 'APP_LOGO',
    }));
  };

  const handleSelectCustomLogo = () => {
    if (lastCustomLogoUrl) {
      setClinicData((prev) => ({
        ...prev,
        logo_url: lastCustomLogoUrl,
      }));
    } else {
      handleUploadLogoPress();
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert('Clinic Logo Option', 'Choose how you want to manage your clinic logo:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use App Logo',
        onPress: () => {
          setClinicData((prev) => ({
            ...prev,
            logo_url: 'APP_LOGO',
          }));
        },
      },
      {
        text: 'Clear Logo',
        style: 'destructive',
        onPress: () => {
          setClinicData((prev) => ({
            ...prev,
            logo_url: undefined,
          }));
          setLastCustomLogoUrl(null);
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────
  // GALLERY UPLOAD HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleUploadGalleryPress = () => {
    if (Platform.OS === 'ios') {
      setPendingUploadType('gallery');
      setShowImageFormatModal(true);
    } else {
      performGalleryUpload();
    }
  };

  const performGalleryUpload = async (aspectRatio?: [number, number]) => {
    try {
      const images = await pickMultipleImages(aspectRatio);
      if (!images || images.length === 0) return;

      setUploadingGallery(true);
      try {
        const imageUrls = await uploadMultipleClinicGalleryImages(images, currentUser?.id || 'clinic');
        if (imageUrls.length > 0) {
          setClinicData((prev) => ({
            ...prev,
            gallery_images: [...(prev.gallery_images || []), ...imageUrls],
          }));
          Alert.alert('Success', `${imageUrls.length} picture(s) added to clinic gallery.`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload gallery images';
        Alert.alert('Error', message);
      } finally {
        setUploadingGallery(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pick images';
      Alert.alert('Error', message);
    }
  };

  const handleRemoveGalleryImage = (imageUrl: string) => {
    Alert.alert('Remove Photo', 'Remove this photo from clinic gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setClinicData((prev) => ({
            ...prev,
            gallery_images: prev.gallery_images?.filter((u) => u !== imageUrl) || [],
          }));
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────────────────────
  // SCHEDULE HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleScheduleToggle = (day: keyof Schedule, isOpen: boolean) => {
    setClinicData((prev) => ({
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

  const parseTimeString = (timeString: string) => {
    const [time, period] = (timeString || '09:00 AM').split(' ');
    const [hours, minutes] = (time || '09:00').split(':');
    return { hours: hours || '09', minutes: minutes || '00', period: (period as 'AM' | 'PM') || 'AM' };
  };

  const createTimeString = (hours: string, minutes: string, period: 'AM' | 'PM'): string => {
    const formattedHours = hours.padStart(2, '0');
    const formattedMinutes = minutes.padStart(2, '0');
    return `${formattedHours}:${formattedMinutes} ${period}`;
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
      const newTime = createTimeString(tempHours, tempMinutes, tempPeriod);
      setClinicData((prev) => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...prev.schedule[day],
            opening_time: newTime,
          },
        },
      }));
    }
    setShowOpeningTimePicker(null);
  };

  const confirmClosingTime = (day: keyof Schedule | null) => {
    if (day) {
      const newTime = createTimeString(tempHours, tempMinutes, tempPeriod);
      setClinicData((prev) => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: {
            ...prev.schedule[day],
            closing_time: newTime,
          },
        },
      }));
    }
    setShowClosingTimePicker(null);
  };

  // ─────────────────────────────────────────────────────────────
  // BLOCKOUT DATES HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleAddBlockoutDate = async (month: number, day: number, year: number) => {
    try {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const existing = blockoutDates.find((b) => b.blockout_date === dateStr);
      if (existing) {
        Alert.alert('Error', 'This date is already blocked.');
        return;
      }

      const { error } = await supabase.from('clinic_blockout_dates').insert({
        blockout_date: dateStr,
        reason: blockoutReason.trim() || 'Blocked',
        is_blocked: true,
      });

      if (error) throw error;

      setBlockoutDates((prev) => [
        ...prev,
        { blockout_date: dateStr, reason: blockoutReason.trim() || 'Blocked', is_blocked: true },
      ]);
      setBlockoutReason('');
      setShowBlockoutDatePicker(false);
      Alert.alert('Success', 'Blockout date added.');
    } catch (error) {
      console.error('[ClinicSetup] Error adding blockout date:', error);
      Alert.alert('Error', 'Failed to add blockout date.');
    }
  };

  const handleRemoveBlockoutDate = async (dateStr: string) => {
    try {
      const { error } = await supabase
        .from('clinic_blockout_dates')
        .delete()
        .eq('blockout_date', dateStr);

      if (error) throw error;

      setBlockoutDates((prev) => prev.filter((b) => b.blockout_date !== dateStr));
      Alert.alert('Success', 'Blockout date removed.');
    } catch (error) {
      console.error('[ClinicSetup] Error removing blockout date:', error);
      Alert.alert('Error', 'Failed to remove blockout date.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SAVE CLINIC DATA
  // ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!clinicData.clinic_name.trim()) {
      Alert.alert('Validation Error', 'Clinic Name is required.');
      return;
    }
    if (!clinicData.address.trim()) {
      Alert.alert('Validation Error', 'Clinic Address is required.');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        clinic_name: clinicData.clinic_name.trim(),
        address: clinicData.address.trim(),
        logo_url: clinicData.logo_url || null,
        gallery_images: clinicData.gallery_images || [],
        services: clinicData.services || [],
        schedule: clinicData.schedule,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (clinicSetupId) {
        const result = await supabase
          .from('clinic_setup')
          .update(dataToSave)
          .eq('id', clinicSetupId);
        error = result.error;
      } else {
        const result = await supabase
          .from('clinic_setup')
          .insert(dataToSave)
          .select('id')
          .single();
        error = result.error;
        if (result.data?.id) {
          setClinicSetupId(result.data.id);
        }
      }

      if (error) throw error;

      if (onSave) {
        await onSave(clinicData);
      }

      setOriginalClinicData(clinicData);
      setNoClinicRecord(false);
      await refetchClinic();

      Alert.alert('Success', 'Clinic setup saved successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('[ClinicSetup] Failed to save clinic setup:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save clinic information.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (originalClinicData) {
      setClinicData(originalClinicData);
      setIsEditing(false);
    } else if (onClose) {
      onClose();
    } else {
      setIsEditing(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else if (onSave) {
      onSave(clinicData);
    } else if (onClose) {
      onClose();
    }
  };

  // Change tracking for glowing inputs and dynamic buttons
  const isNameChanged =
    originalClinicData !== null &&
    clinicData.clinic_name.trim() !== (originalClinicData.clinic_name || '').trim();

  const isAddressChanged =
    originalClinicData !== null &&
    clinicData.address.trim() !== (originalClinicData.address || '').trim();

  const isLogoChanged =
    originalClinicData !== null &&
    clinicData.logo_url !== originalClinicData.logo_url;

  const isGalleryChanged =
    originalClinicData !== null &&
    JSON.stringify(clinicData.gallery_images || []) !==
    JSON.stringify(originalClinicData.gallery_images || []);

  const isServicesChanged =
    originalClinicData !== null &&
    JSON.stringify(clinicData.services || []) !==
    JSON.stringify(originalClinicData.services || []);

  const isScheduleChanged =
    originalClinicData !== null &&
    JSON.stringify(clinicData.schedule || {}) !==
    JSON.stringify(originalClinicData.schedule || {});

  const hasAnyChanges =
    isNameChanged ||
    isAddressChanged ||
    isLogoChanged ||
    isGalleryChanged ||
    isServicesChanged ||
    isScheduleChanged;

  // Calculate today's operating status
  const currentDayKey = DAY_ORDER[new Date().getDay()];
  const currentDaySchedule = clinicData.schedule?.[currentDayKey];
  const isTodayOpen = currentDaySchedule?.isOpen;

  const isUsingAppLogo = clinicData.logo_url === 'APP_LOGO';
  const isUsingCustomLogo = Boolean(clinicData.logo_url && clinicData.logo_url !== 'APP_LOGO');

  // ─────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading clinic information...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EMPTY STATE (FIRST TIME SETUP)
  // ─────────────────────────────────────────────────────────────
  if (noClinicRecord && !isEditing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏥 Clinic Setup</Text>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#047857" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Building2 size={46} color="#10B981" />
          </View>
          <Text style={styles.emptyTitle}>No Clinic Profile Configured</Text>
          <Text style={styles.emptySubtitle}>
            Your clinic does not have setup information yet. Configure your clinic details, hours, and dental services to get started.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setIsEditing(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Set Up Clinic Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIEW MODE (MATCHING DOCTOR PROFILE VIEWING UI/UX)
  // ─────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Clinic Profile</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isRegistration || Boolean(onSkip) ? (
              <TouchableOpacity style={styles.headerSkipBtn} onPress={handleSkip}>
                <Text style={styles.headerSkipBtnText}>Skip</Text>
                <ChevronRight size={15} color="#047857" />
              </TouchableOpacity>
            ) : onClose ? (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={20} color="#047857" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Clinic Logo */}
          <View style={styles.profileImageContainer}>
            {isUsingAppLogo ? (
              <Image
                source={APP_LOGO}
                style={[styles.profileImage, { backgroundColor: '#F8FAFC' }]}
                resizeMode="contain"
              />
            ) : clinicData.logo_url ? (
              <Image source={{ uri: clinicData.logo_url }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Building2 size={44} color="#047857" />
              </View>
            )}
          </View>

          {/* Basic Info */}
          <View style={styles.basicInfo}>
            <Text style={styles.doctorName}>{clinicData.clinic_name || 'Clinic Name Not Set'}</Text>
            <Text style={styles.specialization}>
              {clinicData.address || 'Address Not Set'}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isTodayOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed,
              ]}
            >
              {isTodayOpen ? (
                <>
                  <Text style={styles.statusLabelText}>Open Today:</Text>
                  <Text style={styles.statusTimeText}>
                    {currentDaySchedule?.opening_time} - {currentDaySchedule?.closing_time}
                  </Text>
                </>
              ) : (
                <Text style={styles.statusTextClosed}>Closed Today</Text>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Clinic Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clinic Details</Text>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Clinic Name:</Text>
              <Text style={styles.value}>{clinicData.clinic_name || 'N/A'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Clinic Logo:</Text>
              <Text style={styles.value}>
                {isUsingAppLogo
                  ? 'SmileGuard App Logo'
                  : isUsingCustomLogo
                    ? 'Custom Clinic Logo'
                    : 'None (Default Icon)'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Location / Address:</Text>
              <Text style={styles.value}>{clinicData.address || 'N/A'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Services Available:</Text>
              <Text style={styles.value}>
                {clinicData.services?.length || 0}{' '}
                {clinicData.services?.length === 1 ? 'service' : 'services'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Gallery Pictures:</Text>
              <Text style={styles.value}>
                {clinicData.gallery_images?.length || 0}{' '}
                {clinicData.gallery_images?.length === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Operating Hours Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operating Hours</Text>
            <View style={styles.scheduleViewContainer}>
              {DAY_ORDER.map((dayKey) => {
                const daySched = clinicData.schedule[dayKey];
                const isCurrentDay = dayKey === currentDayKey;
                return (
                  <View
                    key={dayKey}
                    style={[
                      styles.scheduleViewRow,
                      isCurrentDay && styles.scheduleViewRowCurrent,
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.scheduleDayName,
                          isCurrentDay && styles.scheduleDayNameCurrent,
                        ]}
                      >
                        {DAY_LABELS[dayKey]}
                      </Text>
                      {isCurrentDay && (
                        <View style={styles.todayPill}>
                          <Text style={styles.todayPillText}>Today</Text>
                        </View>
                      )}
                    </View>
                    {daySched.isOpen ? (
                      <View style={styles.hoursBadgeOpen}>
                        <Text style={styles.hoursTextOpen}>
                          {daySched.opening_time} - {daySched.closing_time}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.hoursBadgeClosed}>
                        <Text style={styles.hoursTextClosed}>Closed</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Services Offered Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Services Offered ({clinicData.services?.length || 0})
            </Text>
            {clinicData.services && clinicData.services.length > 0 ? (
              <View style={styles.chipsContainer}>
                {clinicData.services.map((service) => (
                  <View key={service.id} style={styles.serviceChipView}>
                    <Text style={styles.serviceChipText}>{service.name}</Text>
                    <View style={styles.servicePriceBadge}>
                      <Text style={styles.servicePriceBadgeText}>
                        ₱{(service.price ?? 1500).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.mutedPlaceholderText}>No dental services configured yet.</Text>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Clinic Gallery Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Clinic Gallery ({clinicData.gallery_images?.length || 0})
            </Text>
            {clinicData.gallery_images && clinicData.gallery_images.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryViewScroll}
              >
                {clinicData.gallery_images.map((imgUrl, index) => (
                  <View key={index} style={styles.galleryPhotoCard}>
                    <Image source={{ uri: imgUrl }} style={styles.galleryPhotoThumb} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.mutedPlaceholderText}>No clinic pictures uploaded yet.</Text>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Blockout Dates Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Blockout Dates ({blockoutDates.length})
            </Text>
            {blockoutDates.length > 0 ? (
              <View style={styles.blockoutListContainer}>
                {blockoutDates.map((blockout) => (
                  <View key={blockout.blockout_date} style={styles.blockoutViewRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockoutDateText}>
                        {new Date(blockout.blockout_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {Boolean(blockout.reason) && (
                        <Text style={styles.blockoutReasonText}>{blockout.reason}</Text>
                      )}
                    </View>
                    <View style={styles.blockedBadge}>
                      <Text style={styles.blockedBadgeText}>Blocked</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.mutedPlaceholderText}>No special blockout dates scheduled.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EDIT MODE (MATCHING DOCTOR PROFILE EDIT UI/UX)
  // ─────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.editScrollContent}>
      {/* Header */}
      <View style={styles.editHeader}>
        <Text style={styles.editHeaderTitle}>Edit Clinic Setup</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {(isRegistration || Boolean(onSkip)) && !hasAnyChanges && (
            <TouchableOpacity style={styles.headerSkipBtn} onPress={handleSkip}>
              <Text style={styles.headerSkipBtnText}>Skip</Text>
              <ChevronRight size={15} color="#047857" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleCancelEdit}
            disabled={saving || uploadingLogo || uploadingGallery}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color="#047857" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Clinic Logo Branding Card */}
      <View style={styles.avatarCard}>
        <View style={styles.logoCardHeader}>
          <Text style={styles.logoCardTitle}>Clinic Logo</Text>
          <Text style={styles.logoCardSubtitle}>
            Select the default SmileGuard app logo or upload a custom logo for your clinic
          </Text>
        </View>

        {/* Logo Selection Options */}
        <View style={styles.logoOptionsRow}>
          {/* Option 1: App Logo */}
          <TouchableOpacity
            style={[
              styles.logoOptionCard,
              isUsingAppLogo && styles.logoOptionCardSelected,
            ]}
            onPress={handleSelectAppLogo}
            disabled={saving || uploadingLogo}
            activeOpacity={0.7}
          >
            <View style={styles.logoOptionHeader}>
              <View
                style={[
                  styles.logoRadioCircle,
                  isUsingAppLogo && styles.logoRadioCircleSelected,
                ]}
              >
                {isUsingAppLogo && <View style={styles.logoRadioDot} />}
              </View>
              {isUsingAppLogo && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>

            <View style={styles.logoOptionThumbContainer}>
              <Image
                source={APP_LOGO}
                style={styles.logoOptionThumb}
                resizeMode="contain"
              />
            </View>

            <Text
              style={[
                styles.logoOptionName,
                isUsingAppLogo && styles.logoOptionNameSelected,
              ]}
            >
              App Logo
            </Text>
            <Text style={styles.logoOptionSubtext}>SmileGuard Default</Text>
          </TouchableOpacity>

          {/* Option 2: Custom Logo */}
          <TouchableOpacity
            style={[
              styles.logoOptionCard,
              isUsingCustomLogo && styles.logoOptionCardSelected,
            ]}
            onPress={handleSelectCustomLogo}
            disabled={saving || uploadingLogo}
            activeOpacity={0.7}
          >
            <View style={styles.logoOptionHeader}>
              <View
                style={[
                  styles.logoRadioCircle,
                  isUsingCustomLogo && styles.logoRadioCircleSelected,
                ]}
              >
                {isUsingCustomLogo && <View style={styles.logoRadioDot} />}
              </View>
              {isUsingCustomLogo && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>

            <View style={styles.logoOptionThumbContainer}>
              {lastCustomLogoUrl || isUsingCustomLogo ? (
                <Image
                  source={{ uri: (isUsingCustomLogo ? clinicData.logo_url : lastCustomLogoUrl)! }}
                  style={styles.logoOptionThumb}
                />
              ) : (
                <View style={styles.logoOptionThumbPlaceholder}>
                  <Camera size={20} color="#047857" />
                </View>
              )}
            </View>

            <Text
              style={[
                styles.logoOptionName,
                isUsingCustomLogo && styles.logoOptionNameSelected,
              ]}
            >
              Custom Logo
            </Text>
            <Text style={styles.logoOptionSubtext}>
              {lastCustomLogoUrl || isUsingCustomLogo ? 'Custom Uploaded' : 'Upload Image'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected Logo Preview & Management */}
        <View style={styles.logoPreviewContainer}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => {
              if (isUsingAppLogo) {
                Alert.alert(
                  'SmileGuard App Logo',
                  'You are currently using the default app logo. Would you like to upload a custom clinic logo?',
                  [
                    { text: 'Keep App Logo', style: 'cancel' },
                    { text: 'Upload Custom Logo', onPress: handleUploadLogoPress },
                  ]
                );
              } else {
                handleUploadLogoPress();
              }
            }}
            disabled={saving || uploadingLogo}
            activeOpacity={0.8}
          >
            {isUsingAppLogo ? (
              <Image
                source={APP_LOGO}
                style={[styles.avatarImage, { backgroundColor: '#F8FAFC' }]}
                resizeMode="contain"
              />
            ) : clinicData.logo_url ? (
              <Image
                source={{ uri: clinicData.logo_url }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Building2 size={44} color="#94A3B8" />
              </View>
            )}

            {uploadingLogo ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.cameraBadge}>
                {isUsingAppLogo ? (
                  <Check size={14} color="#FFFFFF" />
                ) : (
                  <Camera size={14} color="#FFFFFF" />
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleUploadLogoPress}
              disabled={saving || uploadingLogo}
              style={styles.changePhotoBtn}
            >
              {uploadingLogo ? (
                <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
              ) :
                <Text style={styles.changePhotoText}>
                  {uploadingLogo
                    ? 'Uploading...'
                    : isUsingCustomLogo
                      ? 'Change Custom Logo'
                      : 'Upload Custom Logo'}
                </Text>
              }
            </TouchableOpacity>


            {!isUsingAppLogo && (
              <TouchableOpacity
                onPress={handleSelectAppLogo}
                disabled={saving || uploadingLogo}
                style={styles.useAppLogoBtn}
              >
                <Text style={styles.useAppLogoBtnText}>Use App Logo</Text>
              </TouchableOpacity>
            )}

            {Boolean(clinicData.logo_url) && (
              <TouchableOpacity
                onPress={handleRemoveLogo}
                disabled={saving || uploadingLogo}
                style={styles.removeLogoBtn}
              >
                <Trash2 size={14} color="#DC2626" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Form Card */}
      <View style={styles.stepContent}>
        <Text style={styles.h2}>Clinic Information</Text>
        <Text style={styles.p}>Update your clinic profile details, location, and operating hours</Text>

        {/* Section: Basic Details */}
        <Text style={styles.sectionHeader}>Clinic Details</Text>

        <Text style={styles.inputLabel}>
          Clinic Name *{' '}
          {isNameChanged && <Text style={styles.editedBadgeText}>● Modified</Text>}
        </Text>
        <TextInput
          style={[styles.input, isNameChanged && styles.inputGlowing]}
          placeholder="e.g. SmileGuard Dental Clinic"
          value={clinicData.clinic_name}
          onChangeText={(text) => setClinicData((prev) => ({ ...prev, clinic_name: text }))}
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.inputLabel}>
          Clinic Address *{' '}
          {isAddressChanged && <Text style={styles.editedBadgeText}>● Modified</Text>}
        </Text>
        <TextInput
          style={[styles.input, isAddressChanged && styles.inputGlowing]}
          placeholder="e.g. 123 Healthcare Ave, Suite 400"
          value={clinicData.address}
          onChangeText={(text) => setClinicData((prev) => ({ ...prev, address: text }))}
          placeholderTextColor="#9ca3af"
        />

        {/* Section: Clinic Gallery */}
        <Text style={styles.sectionHeader}>
          Clinic Gallery ({clinicData.gallery_images?.length || 0})
        </Text>
        <Text style={styles.inputHelperText}>
          Add photos of your clinic, treatment rooms, and facilities.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryEditScroll}
        >
          {/* Upload Tile */}
          <TouchableOpacity
            style={styles.uploadGalleryTile}
            onPress={handleUploadGalleryPress}
            disabled={uploadingGallery}
            activeOpacity={0.7}
          >
            {uploadingGallery ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : (
              <>
                <Plus size={22} color="#047857" />
                <Text style={styles.uploadGalleryTileText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Existing Photos */}
          {clinicData.gallery_images?.map((imgUrl, index) => (
            <View key={index} style={styles.galleryEditThumbWrapper}>
              <Image source={{ uri: imgUrl }} style={styles.galleryEditThumb} />
              <TouchableOpacity
                style={styles.deleteGalleryPhotoBtn}
                onPress={() => handleRemoveGalleryImage(imgUrl)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Trash2 size={11} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Section: Services Offered */}
        <Text style={styles.sectionHeader}>
          Services Offered & Price List ({clinicData.services?.length || 0})
        </Text>
        <Text style={styles.inputHelperText}>
          Configure services and procedure prices offered at your clinic. Prices are reflected directly on the patient web portal.
        </Text>

        {/* Predefined Quick-Add Pills */}
        <Text style={styles.inputSubLabel}>Quick-Add Predefined Services:</Text>
        <View style={[styles.chipsContainer, { marginBottom: 14 }]}>
          {PREDEFINED_SERVICES.map((predefined) => {
            const alreadyAdded = clinicData.services.some(
              (s) => s.name.toLowerCase() === predefined.toLowerCase()
            );
            return (
              <TouchableOpacity
                key={predefined}
                style={[
                  styles.predefinedChip,
                  alreadyAdded && styles.predefinedChipDisabled,
                ]}
                onPress={() => handleAddService(predefined)}
                disabled={alreadyAdded}
              >
                <Text
                  style={[
                    styles.predefinedChipText,
                    alreadyAdded && styles.predefinedChipTextDisabled,
                  ]}
                >
                  {alreadyAdded ? `✓ ${predefined}` : `+ ${predefined}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Service Input */}
        <Text style={styles.inputSubLabel}>Add Custom Service:</Text>
        <View style={styles.addServiceRow}>
          <TextInput
            style={[styles.input, { flex: 2, marginBottom: 0 }]}
            placeholder="Service name (e.g. Veneers)"
            value={newService}
            onChangeText={setNewService}
            placeholderTextColor="#9ca3af"
          />
          <View style={[styles.input, { flex: 1.2, marginBottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }]}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#047857', marginRight: 4 }}>₱</Text>
            <TextInput
              style={{ flex: 1, padding: 0, fontSize: 13, color: '#1E293B', fontWeight: '600' }}
              placeholder="Price"
              value={newServicePrice}
              onChangeText={setNewServicePrice}
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <TouchableOpacity
            style={styles.addServiceBtn}
            onPress={() => handleAddService()}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Added services with editable prices list */}
        {clinicData.services.length > 0 && (
          <View style={styles.servicesEditableList}>
            <Text style={[styles.inputSubLabel, { marginTop: 4, marginBottom: 6 }]}>Configured Clinic Rates:</Text>
            {clinicData.services.map((service) => (
              <View key={service.id} style={styles.serviceEditCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceEditCardName}>{service.name}</Text>
                  <Text style={styles.serviceEditCardHint}>Web Portal Rate</Text>
                </View>
                <View style={styles.servicePriceInputContainer}>
                  <Text style={styles.servicePricePrefix}>₱</Text>
                  <TextInput
                    style={styles.servicePriceInput}
                    value={service.price !== undefined ? service.price.toString() : '1500'}
                    onChangeText={(val) => handleUpdateServicePrice(service.id, val)}
                    keyboardType="numeric"
                    placeholder="1500"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveService(service.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.serviceRemoveBtn}
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Section: Operating Schedule */}
        <Text style={styles.sectionHeader}>Operating Schedule</Text>
        <Text style={styles.inputHelperText}>
          Configure clinic opening and closing times for each day of the week.
        </Text>

        <View style={styles.scheduleEditList}>
          {DAY_ORDER.map((dayKey) => {
            const sched = clinicData.schedule[dayKey];
            return (
              <View key={dayKey} style={styles.scheduleEditCard}>
                <View style={styles.scheduleEditCardHeader}>
                  <Text style={styles.scheduleEditDayLabel}>{DAY_LABELS[dayKey]}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: sched.isOpen ? '#047857' : '#94A3B8',
                      }}
                    >
                      {sched.isOpen ? 'Open' : 'Closed'}
                    </Text>
                    <Switch
                      value={sched.isOpen}
                      onValueChange={(val) => handleScheduleToggle(dayKey, val)}
                      trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                      thumbColor={sched.isOpen ? '#10B981' : '#CBD5E1'}
                    />
                  </View>
                </View>

                {sched.isOpen ? (
                  <View style={styles.timeButtonsRow}>
                    <TouchableOpacity
                      style={styles.timeInputBtn}
                      onPress={() => openOpeningTimePicker(dayKey)}
                    >
                      <Text style={styles.timeInputBtnLabel}>From</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.timeInputBtnValue}>{sched.opening_time}</Text>
                      </View>
                    </TouchableOpacity>

                    <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>→</Text>

                    <TouchableOpacity
                      style={styles.timeInputBtn}
                      onPress={() => openClosingTimePicker(dayKey)}
                    >
                      <Text style={styles.timeInputBtnLabel}>To</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.timeInputBtnValue}>{sched.closing_time}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.closedDayHint}>Clinic is closed on this day.</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Section: Blockout Dates */}
        <Text style={styles.sectionHeader}>
          One-Time Blockout Dates ({blockoutDates.length})
        </Text>
        <Text style={styles.inputHelperText}>
          Block out holidays or specific dates when the clinic is closed.
        </Text>

        <TouchableOpacity
          style={styles.addBlockoutTriggerBtn}
          onPress={() => {
            const now = new Date();
            setTempBlockoutDay(now.getDate().toString());
            setTempBlockoutMonth((now.getMonth() + 1).toString());
            setTempBlockoutYear(now.getFullYear().toString());
            setBlockoutReason('');
            setShowBlockoutDatePicker(true);
          }}
        >
          <Text style={styles.addBlockoutTriggerBtnText}>Add Blockout Date</Text>
        </TouchableOpacity>

        {blockoutDates.length > 0 && (
          <View style={styles.blockoutEditList}>
            {blockoutDates.map((blockout) => (
              <View key={blockout.blockout_date} style={styles.blockoutEditRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockoutDateText}>
                    {new Date(blockout.blockout_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  {Boolean(blockout.reason) && (
                    <Text style={styles.blockoutReasonText}>{blockout.reason}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveBlockoutDate(blockout.blockout_date)}
                  style={styles.deleteBlockoutBtn}
                >
                  <Trash2 size={15} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn]}
          onPress={handleCancelEdit}
          disabled={saving || uploadingLogo || uploadingGallery}
        >
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>

        {hasAnyChanges ? (
          <TouchableOpacity
            style={[
              styles.btn,
              styles.primaryBtn,
              styles.saveBtnGlowing,
              (saving || uploadingLogo || uploadingGallery) && styles.btnDisabled,
            ]}
            onPress={handleSave}
            disabled={saving || uploadingLogo || uploadingGallery}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.btnText}>Save Changes</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.skipBtn]}
            onPress={handleSkip}
            disabled={saving || uploadingLogo || uploadingGallery}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.skipBtnText}>Skip</Text>
              <ChevronRight size={16} color="#047857" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ─────────────────────────────────────────────────────────────
          MODALS: TIME PICKERS, FORMAT SELECTOR, BLOCKOUT PICKER
         ───────────────────────────────────────────────────────────── */}

      {/* Opening Time Picker Modal */}
      <Modal
        visible={showOpeningTimePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOpeningTimePicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Select Opening Time</Text>
              <TouchableOpacity onPress={() => setShowOpeningTimePicker(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeSelectorRow}>
              {/* Hours */}
              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let h = parseInt(tempHours, 10) || 1;
                    h = h === 12 ? 1 : h + 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.timeNumberInput}
                  value={tempHours}
                  onChangeText={(t) => {
                    const c = t.replace(/[^0-9]/g, '');
                    if (!c) {
                      setTempHours('');
                    } else {
                      let num = parseInt(c, 10);
                      if (num > 12) num = 12;
                      if (num < 1) num = 1;
                      setTempHours(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let h = parseInt(tempHours, 10) || 1;
                    h = h === 1 ? 12 : h - 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.timeColon}>:</Text>

              {/* Minutes */}
              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let m = parseInt(tempMinutes, 10) || 0;
                    m = m + 5;
                    if (m >= 60) m = 0;
                    setTempMinutes(m.toString().padStart(2, '0'));
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.timeNumberInput}
                  value={tempMinutes}
                  onChangeText={(t) => {
                    const c = t.replace(/[^0-9]/g, '');
                    if (!c) {
                      setTempMinutes('');
                    } else {
                      let num = parseInt(c, 10);
                      if (num > 59) num = 59;
                      setTempMinutes(num.toString().padStart(2, '0'));
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let m = parseInt(tempMinutes, 10) || 0;
                    m = m - 5;
                    if (m < 0) m = 55;
                    setTempMinutes(m.toString().padStart(2, '0'));
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => setTempPeriod((p) => (p === 'AM' ? 'PM' : 'AM'))}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timePeriodDisplay}>{tempPeriod}</Text>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => setTempPeriod((p) => (p === 'AM' ? 'PM' : 'AM'))}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.btn, styles.secondaryBtn]}
                onPress={() => setShowOpeningTimePicker(null)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => confirmOpeningTime(showOpeningTimePicker)}
              >
                <Text style={styles.btnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Closing Time Picker Modal */}
      <Modal
        visible={showClosingTimePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClosingTimePicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Select Closing Time</Text>
              <TouchableOpacity onPress={() => setShowClosingTimePicker(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeSelectorRow}>
              {/* Hours */}
              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let h = parseInt(tempHours, 10) || 1;
                    h = h === 12 ? 1 : h + 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.timeNumberInput}
                  value={tempHours}
                  onChangeText={(t) => {
                    const c = t.replace(/[^0-9]/g, '');
                    if (!c) {
                      setTempHours('');
                    } else {
                      let num = parseInt(c, 10);
                      if (num > 12) num = 12;
                      if (num < 1) num = 1;
                      setTempHours(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let h = parseInt(tempHours, 10) || 1;
                    h = h === 1 ? 12 : h - 1;
                    setTempHours(h.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.timeColon}>:</Text>

              {/* Minutes */}
              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let m = parseInt(tempMinutes, 10) || 0;
                    m = m + 5;
                    if (m >= 60) m = 0;
                    setTempMinutes(m.toString().padStart(2, '0'));
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.timeNumberInput}
                  value={tempMinutes}
                  onChangeText={(t) => {
                    const c = t.replace(/[^0-9]/g, '');
                    if (!c) {
                      setTempMinutes('');
                    } else {
                      let num = parseInt(c, 10);
                      if (num > 59) num = 59;
                      setTempMinutes(num.toString().padStart(2, '0'));
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let m = parseInt(tempMinutes, 10) || 0;
                    m = m - 5;
                    if (m < 0) m = 55;
                    setTempMinutes(m.toString().padStart(2, '0'));
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <View style={styles.timeCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => setTempPeriod((p) => (p === 'AM' ? 'PM' : 'AM'))}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timePeriodDisplay}>{tempPeriod}</Text>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => setTempPeriod((p) => (p === 'AM' ? 'PM' : 'AM'))}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.btn, styles.secondaryBtn]}
                onPress={() => setShowClosingTimePicker(null)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => confirmClosingTime(showClosingTimePicker)}
              >
                <Text style={styles.btnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Format Selection Modal */}
      <Modal
        visible={showImageFormatModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageFormatModal(false);
          setPendingUploadType(null);
        }}
      >
        <View style={styles.modalCenterOverlay}>
          <View style={styles.formatDialogCard}>
            <View style={styles.formatDialogHeaderRow}>
              <Text style={styles.formatDialogTitle}>Choose Crop Format</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowImageFormatModal(false);
                  setPendingUploadType(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.formatDialogSubtitle}>
              Select the aspect ratio for your uploaded image
            </Text>

            <TouchableOpacity
              style={styles.formatOptionBtn}
              onPress={() => {
                setShowImageFormatModal(false);
                if (pendingUploadType === 'logo') {
                  performLogoUpload([1, 1]);
                } else if (pendingUploadType === 'gallery') {
                  performGalleryUpload([1, 1]);
                }
                setPendingUploadType(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.formatOptionTitle}>Square (1:1)</Text>
              <Text style={styles.formatOptionDesc}>Recommended for clean logos and cards</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.formatOptionBtn}
              onPress={() => {
                setShowImageFormatModal(false);
                if (pendingUploadType === 'logo') {
                  performLogoUpload(undefined);
                } else if (pendingUploadType === 'gallery') {
                  performGalleryUpload(undefined);
                }
                setPendingUploadType(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.formatOptionTitle}>Free Form</Text>
              <Text style={styles.formatOptionDesc}>Crop or scale to any custom dimensions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.formatCancelBtn}
              onPress={() => {
                setShowImageFormatModal(false);
                setPendingUploadType(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.formatCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blockout Date Picker Modal */}
      <Modal
        visible={showBlockoutDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlockoutDatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Add Blockout Date</Text>
              <TouchableOpacity onPress={() => setShowBlockoutDatePicker(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Select Date (Month / Day / Year)</Text>
            <View style={styles.dateSelectorRow}>
              {/* Month */}
              <View style={styles.dateCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let m = parseInt(tempBlockoutMonth, 10) || 1;
                    m = m === 12 ? 1 : m + 1;
                    setTempBlockoutMonth(m.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.dateInput}
                  value={tempBlockoutMonth}
                  onChangeText={(t) => {
                    const c = t.replace(/[^0-9]/g, '');
                    if (!c) {
                      setTempBlockoutMonth('');
                    } else {
                      let num = parseInt(c, 10);
                      if (num > 12) num = 12;
                      if (num < 1) num = 1;
                      setTempBlockoutMonth(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="MM"
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let m = parseInt(tempBlockoutMonth, 10) || 1;
                    m = m === 1 ? 12 : m - 1;
                    setTempBlockoutMonth(m.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.dateSubtext}>Month</Text>
              </View>

              <Text style={styles.dateSlash}>/</Text>

              {/* Day */}
              <View style={styles.dateCol}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let d = parseInt(tempBlockoutDay, 10) || 1;
                    d = d === 31 ? 1 : d + 1;
                    setTempBlockoutDay(d.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.dateInput}
                  value={tempBlockoutDay}
                  onChangeText={(t) => {
                    const c = t.replace(/[^0-9]/g, '');
                    if (!c) {
                      setTempBlockoutDay('');
                    } else {
                      let num = parseInt(c, 10);
                      if (num > 31) num = 31;
                      if (num < 1) num = 1;
                      setTempBlockoutDay(num.toString());
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="DD"
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let d = parseInt(tempBlockoutDay, 10) || 1;
                    d = d === 1 ? 31 : d - 1;
                    setTempBlockoutDay(d.toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.dateSubtext}>Day</Text>
              </View>

              <Text style={styles.dateSlash}>/</Text>

              {/* Year */}
              <View style={[styles.dateCol, { flex: 1.3 }]}>
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let y = parseInt(tempBlockoutYear, 10) || today.getFullYear();
                    setTempBlockoutYear((y + 1).toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▲</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.dateInput}
                  value={tempBlockoutYear}
                  onChangeText={(t) => setTempBlockoutYear(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="YYYY"
                />
                <TouchableOpacity
                  style={styles.timeArrowBtn}
                  onPress={() => {
                    let y = parseInt(tempBlockoutYear, 10) || today.getFullYear();
                    if (y > today.getFullYear()) setTempBlockoutYear((y - 1).toString());
                  }}
                >
                  <Text style={styles.timeArrowText}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.dateSubtext}>Year</Text>
              </View>
            </View>

            <Text style={styles.inputLabel}>Reason (Optional)</Text>
            <TextInput
              style={[styles.input, { marginBottom: 20 }]}
              placeholder="e.g. Clinic Renovation, Public Holiday..."
              value={blockoutReason}
              onChangeText={setBlockoutReason}
              placeholderTextColor="#9ca3af"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.btn, styles.secondaryBtn]}
                onPress={() => setShowBlockoutDatePicker(false)}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => {
                  const m = parseInt(tempBlockoutMonth, 10) || 1;
                  const d = parseInt(tempBlockoutDay, 10) || 1;
                  const y = parseInt(tempBlockoutYear, 10) || today.getFullYear();
                  handleAddBlockoutDate(m, d, y);
                }}
              >
                <Text style={styles.btnText}>Add Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES (MATCHING DOCTOR PROFILE VIEWING & EDIT DESIGN SYSTEM)
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  editScrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#047857',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#10B981',
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderColor: '#CBD5E1',
    borderWidth: 1.5,
  },
  profileImageContainer: {
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  basicInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  specialization: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  statusBadgeOpen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgeClosed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    paddingVertical: 6,
  },
  statusLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 2,
    textAlign: 'center',
  },
  statusTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    textAlign: 'center',
  },
  statusTextClosed: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    textAlign: 'right',
  },
  scheduleViewContainer: {
    marginTop: 4,
    gap: 6,
  },
  scheduleViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
  },
  scheduleViewRowCurrent: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  scheduleDayName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  scheduleDayNameCurrent: {
    color: '#047857',
    fontWeight: '700',
  },
  todayPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  todayPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  hoursBadgeOpen: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  hoursTextOpen: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  hoursBadgeClosed: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hoursTextClosed: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  serviceChipView: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  servicePriceBadge: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  servicePriceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  servicesEditableList: {
    gap: 8,
    marginBottom: 12,
  },
  serviceEditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  serviceEditCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  serviceEditCardHint: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  servicePriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 36,
    width: 100,
  },
  servicePricePrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginRight: 2,
  },
  servicePriceInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },
  serviceRemoveBtn: {
    padding: 6,
  },
  galleryViewScroll: {
    paddingVertical: 6,
    gap: 10,
  },
  galleryPhotoCard: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  galleryPhotoThumb: {
    width: 90,
    height: 90,
    backgroundColor: '#F1F5F9',
  },
  blockoutListContainer: {
    gap: 6,
    marginTop: 4,
  },
  blockoutViewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
  },
  blockoutDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  blockoutReasonText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  blockedBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  blockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  mutedPlaceholderText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  // Edit Mode Styles
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  editHeaderTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#047857',
  },
  avatarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#10B981',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10B981',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  activePhotoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activePhotoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  photoHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 8,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  removeLogoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCardHeader: {
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  logoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 4,
  },
  logoCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  logoOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  logoOptionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'center',
  },
  logoOptionCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  logoOptionHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRadioCircleSelected: {
    borderColor: '#10B981',
  },
  logoRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  logoOptionThumbContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  logoOptionThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  logoOptionThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  logoOptionNameSelected: {
    color: '#047857',
  },
  logoOptionSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  logoPreviewContainer: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  useAppLogoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  useAppLogoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  stepContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  h2: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  p: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 6,
  },
  inputSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputHelperText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
  },
  galleryEditScroll: {
    paddingVertical: 6,
    gap: 10,
    marginBottom: 8,
  },
  uploadGalleryTile: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadGalleryTileText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 4,
  },
  galleryEditThumbWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  galleryEditThumb: {
    width: '100%',
    height: '100%',
  },
  deleteGalleryPhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  serviceChipActiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  predefinedChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  predefinedChipDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  predefinedChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  predefinedChipTextDisabled: {
    color: '#94A3B8',
  },
  addServiceRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addServiceBtn: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleEditList: {
    gap: 10,
    marginTop: 4,
  },
  scheduleEditCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  scheduleEditCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleEditDayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  timeButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  timeInputBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  timeInputBtnLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  timeInputBtnValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  closedDayHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    fontStyle: 'italic',
  },
  addBlockoutTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  addBlockoutTriggerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  blockoutEditList: {
    gap: 6,
  },
  blockoutEditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteBlockoutBtn: {
    padding: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 24,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#10B981',
  },
  secondaryBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  inputGlowing: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  editedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  skipBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  skipBtnText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtnGlowing: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  headerSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  headerSkipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  registrationActionBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  registrationHint: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 18,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  timeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  timeCol: {
    alignItems: 'center',
  },
  timeArrowBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  timeArrowText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  timeNumberInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 68,
    color: '#047857',
    backgroundColor: '#F8FAFC',
  },
  timeColon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#334155',
  },
  timePeriodDisplay: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#047857',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    minWidth: 64,
    textAlign: 'center',
  },

  modalCenterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formatDialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  formatDialogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  formatDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  formatDialogSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
  },
  formatOptionBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  formatOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  formatOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  formatCancelBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  formatCancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },

  dateSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dateCol: {
    alignItems: 'center',
    flex: 1,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
    color: '#047857',
    backgroundColor: '#F8FAFC',
  },
  dateSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  dateSlash: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginBottom: 16,
  },

  // First time empty container
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
});
