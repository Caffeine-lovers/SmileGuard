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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Pencil,
  Image as ImageIcon,
  CheckCircle2,
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
  Cleaning: 1500,
  Whitening: 5000,
  Fillings: 2000,
  'Root Canal': 8000,
  Extraction: 1500,
  'Braces Consultation': 35000,
  'Implants Consultation': 45000,
  'X-Ray': 500,
  Checkup: 300,
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

type ActiveClinicTab = 'overview' | 'schedule' | 'services';

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
  const [activeTab, setActiveTab] = useState<ActiveClinicTab>('overview');
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

  // Services Handlers
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
          ? parseFloat(newServicePrice.replace(/[^0-9.]/g, '')) ||
          (DEFAULT_SERVICE_PRICES[serviceName] || 1500)
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

  // Logo Handlers
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

  // Gallery Handlers
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
          const updatedGallery = [...(clinicData.gallery_images || []), ...imageUrls];
          setClinicData((prev) => ({
            ...prev,
            gallery_images: updatedGallery,
          }));

          // If in View mode, auto-save to database immediately
          if (!isEditing && clinicSetupId) {
            try {
              await supabase.from('clinic_setup').update({
                gallery_images: updatedGallery,
                updated_at: new Date().toISOString(),
              }).eq('id', clinicSetupId);
              await refetchClinic();
            } catch (err) {
              console.error('[ClinicSetup] Auto-save gallery error:', err);
            }
          }

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

  // Schedule Handlers
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

  // Blockout Dates Handlers
  const handleAddBlockoutDate = async (month: number, day: number, year: number) => {
    try {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const existing = blockoutDates.find((b) => b.blockout_date === dateStr);
      if (existing) {
        Alert.alert('Error', 'This date is already blocked.');
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const effectiveUserId = currentUser?.id || authUser?.id || '7c9b5331-3f19-4560-8256-44c7742e11ad';

      const { error } = await supabase.from('clinic_blockout_dates').insert({
        user_id: effectiveUserId,
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

  // Save Clinic Data
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

  const currentDayKey = DAY_ORDER[new Date().getDay()];
  const currentDaySchedule = clinicData.schedule?.[currentDayKey];
  const isTodayOpen = currentDaySchedule?.isOpen;

  const isUsingAppLogo = clinicData.logo_url === 'APP_LOGO';
  const isUsingCustomLogo = Boolean(clinicData.logo_url && clinicData.logo_url !== 'APP_LOGO');

  // Loading State
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.loadingText}>Loading clinic setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // First Time Empty State
  if (noClinicRecord && !isEditing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />
        <View style={styles.topHeader}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.topHeaderTitle}>CLINIC SETUP</Text>
          </View>
          {onClose && (
            <TouchableOpacity style={styles.closeActionBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={17} color="#047857" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.container}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Building2 size={46} color="#047857" />
            </View>
            <Text style={styles.emptyTitle}>Configure Your Dental Clinic</Text>
            <Text style={styles.emptySubtitle}>
              Set up your clinic branding, address, operating hours, procedure rates, and facility gallery to showcase to patients.
            </Text>
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.8}
            >
              <Building2 size={16} color="#FFFFFF" />
              <Text style={styles.primaryActionButtonText}>Set Up Clinic Profile</Text>
              <ChevronRight size={16} color="#A7F3D0" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // VIEW MODE
  if (!isEditing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />
        {/* Module Top Header (No Badge) */}
        <View style={styles.topHeader}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.topHeaderTitle}>CLINIC PROFILE</Text>
          </View>

          <View style={styles.headerActionsRow}>
            {isRegistration || Boolean(onSkip) ? (
              <TouchableOpacity style={styles.headerSkipBtn} onPress={handleSkip} activeOpacity={0.75}>
                <Text style={styles.headerSkipBtnText}>Skip</Text>
                <ChevronRight size={14} color="#047857" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.editHeaderBtn}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.75}
            >
              <Pencil size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.editHeaderBtnText}>Edit</Text>
            </TouchableOpacity>

            {onClose && !isRegistration && (
              <TouchableOpacity
                style={styles.closeActionBtn}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Close Clinic Profile"
              >
                <X size={17} color="#047857" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Clinic Facade Card (Always Visible) */}
          <View style={styles.clinicFacadeCard}>
            <View style={styles.facadeLogoRow}>
              <View style={styles.facadeLogoContainer}>
                {isUsingAppLogo ? (
                  <Image
                    source={APP_LOGO}
                    style={[styles.facadeLogo, { backgroundColor: '#F8FAFC' }]}
                    resizeMode="contain"
                  />
                ) : clinicData.logo_url ? (
                  <Image source={{ uri: clinicData.logo_url }} style={styles.facadeLogo} />
                ) : (
                  <View style={styles.facadeLogoPlaceholder}>
                    <Building2 size={38} color="#047857" />
                  </View>
                )}
              </View>

              <View style={styles.facadeTitleCol}>
                <Text style={styles.facadeClinicName}>
                  {clinicData.clinic_name || 'Clinic Name Not Set'}
                </Text>
                <View style={styles.facadeAddressRow}>
                  <MapPin size={13} color="#047857" />
                  <Text style={styles.facadeAddressText} numberOfLines={2}>
                    {clinicData.address || 'Address Not Set'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Clinic Stats Bar: Procedures, Photos, Blockouts (Always Visible) */}
          <View style={styles.clinicStatsRow}>
            <View style={styles.clinicStatTile}>
              <Text style={styles.clinicStatNum}>{clinicData.services?.length || 0}</Text>
              <Text style={styles.clinicStatSub}>PROCEDURES</Text>
            </View>
            <View style={styles.clinicStatDivider} />
            <View style={styles.clinicStatTile}>
              <Text style={styles.clinicStatNum}>{clinicData.gallery_images?.length || 0}</Text>
              <Text style={styles.clinicStatSub}>PHOTOS</Text>
            </View>
            <View style={styles.clinicStatDivider} />
            <View style={styles.clinicStatTile}>
              <Text style={styles.clinicStatNum}>{blockoutDates.length}</Text>
              <Text style={styles.clinicStatSub}>BLOCKOUTS</Text>
            </View>
          </View>

          {/* 3 Tab Switches (Positioned below Procedures, Photos, Blockouts) */}
          <View style={styles.hubTabBar}>
            <TouchableOpacity
              style={[styles.hubTabItem, activeTab === 'overview' && styles.hubTabItemActive]}
              onPress={() => setActiveTab('overview')}
              activeOpacity={0.7}
            >
              <Building2 size={14} color={activeTab === 'overview' ? '#047857' : '#64748B'} />
              <Text style={[styles.hubTabText, activeTab === 'overview' && styles.hubTabTextActive]}>
                Clinic Photos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hubTabItem, activeTab === 'schedule' && styles.hubTabItemActive]}
              onPress={() => setActiveTab('schedule')}
              activeOpacity={0.7}
            >
              <Clock size={14} color={activeTab === 'schedule' ? '#047857' : '#64748B'} />
              <Text style={[styles.hubTabText, activeTab === 'schedule' && styles.hubTabTextActive]}>
                Schedule
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.hubTabItem, activeTab === 'services' && styles.hubTabItemActive]}
              onPress={() => setActiveTab('services')}
              activeOpacity={0.7}
            >
              <Sparkles size={14} color={activeTab === 'services' ? '#047857' : '#64748B'} />
              <Text style={[styles.hubTabText, activeTab === 'services' && styles.hubTabTextActive]}>
                Rates ({clinicData.services?.length || 0})
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: FACILITY GALLERY */}
          {activeTab === 'overview' && (
            <View>
              {/* Facility Gallery Header with Quick Upload Button */}
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>PHOTO GALLERY</Text>
              </View>

              {clinicData.gallery_images && clinicData.gallery_images.length > 0 ? (
                <View style={styles.galleryMasonryGrid}>
                  {clinicData.gallery_images.map((imgUrl, index) => (
                    <View key={index} style={styles.galleryMasonryCard}>
                      <Image source={{ uri: imgUrl }} style={styles.galleryMasonryImg} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyGalleryBox}>
                  <ImageIcon size={28} color="#94A3B8" />
                  <Text style={styles.emptyGalleryTitle}>No Clinic Photos Yet</Text>
                  <Text style={styles.emptyGallerySubtitle}>
                    Add photos of your dental operatories, waiting lounge, and sterilization room.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyUploadBtn}
                    onPress={handleUploadGalleryPress}
                    disabled={uploadingGallery}
                    activeOpacity={0.8}
                  >
                    {uploadingGallery ? (
                      <ActivityIndicator size="small" color="#047857" />
                    ) : (
                      <>
                        <Plus size={15} color="#047857" strokeWidth={2.5} />
                        <Text style={styles.emptyUploadBtnText}>Upload Clinic Photo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* TAB 2: SCHEDULE & HOURS */}
          {activeTab === 'schedule' && (
            <View>
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>WEEKLY OPERATING HOURS</Text>
              </View>

              <View style={styles.scheduleCard}>
                {DAY_ORDER.map((dayKey, index) => {
                  const daySched = clinicData.schedule[dayKey];
                  const isCurrentDay = dayKey === currentDayKey;

                  return (
                    <View
                      key={dayKey}
                      style={[
                        styles.scheduleDayRow,
                        isCurrentDay && styles.scheduleDayRowCurrent,
                        index < DAY_ORDER.length - 1 && styles.scheduleDayRowBorder,
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.scheduleDayTitle,
                            isCurrentDay && styles.scheduleDayTitleCurrent,
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
                        <View style={styles.openBadge}>
                          <Clock size={11} color="#047857" />
                          <Text style={styles.openBadgeText}>
                            {daySched.opening_time} - {daySched.closing_time}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.closedBadge}>
                          <Text style={styles.closedBadgeText}>Closed</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Blockout Dates List */}
              <View style={[styles.sectionHeaderWrap, { marginTop: 16 }]}>
                <Text style={styles.sectionTitle}>
                  SCHEDULED BLOCKOUT DATES ({blockoutDates.length})
                </Text>
              </View>

              <View style={styles.blockoutCard}>
                {blockoutDates.length > 0 ? (
                  blockoutDates.map((blockout, idx) => (
                    <View
                      key={blockout.blockout_date}
                      style={[
                        styles.blockoutRow,
                        idx < blockoutDates.length - 1 && styles.blockoutRowBorder,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blockoutDateLabel}>
                          {new Date(blockout.blockout_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        {Boolean(blockout.reason) && (
                          <Text style={styles.blockoutReasonLabel}>{blockout.reason}</Text>
                        )}
                      </View>
                      <View style={styles.blockedPill}>
                        <Text style={styles.blockedPillText}>Closed</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyScheduleText}>
                    No one-time clinic blockout dates scheduled.
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* TAB 3: TREATMENTS & RATES */}
          {activeTab === 'services' && (
            <View>
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>
                  ACTIVE DENTAL PROCEDURES ({clinicData.services?.length || 0})
                </Text>
              </View>

              <View style={styles.servicesGrid}>
                {clinicData.services && clinicData.services.length > 0 ? (
                  clinicData.services.map((service) => (
                    <View key={service.id} style={styles.serviceItemCard}>
                      <View style={styles.serviceCardLeft}>
                        <CheckCircle2 size={16} color="#047857" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.serviceNameText}>{service.name}</Text>
                          <Text style={styles.servicePortalHint}>Online Booking Enabled</Text>
                        </View>
                      </View>

                      <View style={styles.ratePill}>
                        <Text style={styles.ratePillText}>
                          ₱{(service.price ?? 1500).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyScheduleText}>
                    No dental treatments configured yet.
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // EDIT MODE
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />
      {/* Module Top Header (No Badge) */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.topHeaderTitle}>EDIT CLINIC SETUP</Text>
        </View>

        <View style={styles.headerActionsRow}>
          {(isRegistration || Boolean(onSkip)) && !hasAnyChanges && (
            <TouchableOpacity style={styles.headerSkipBtn} onPress={handleSkip} activeOpacity={0.75}>
              <Text style={styles.headerSkipBtnText}>Skip</Text>
              <ChevronRight size={14} color="#047857" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleCancelEdit}
            disabled={saving || uploadingLogo || uploadingGallery}
            style={styles.closeActionBtn}
            activeOpacity={0.7}
            accessibilityLabel="Cancel Clinic Edit"
          >
            <X size={17} color="#047857" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Hub Navigation Bar in Edit Mode */}
      <View style={styles.editHubTabBar}>
        <TouchableOpacity
          style={[styles.hubTabItem, activeTab === 'overview' && styles.hubTabItemActive]}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.7}
        >
          <Building2 size={13} color={activeTab === 'overview' ? '#047857' : '#64748B'} />
          <Text
            style={[styles.hubTabText, activeTab === 'overview' && styles.hubTabTextActive]}
            numberOfLines={1}
          >
            Facility
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hubTabItem, activeTab === 'schedule' && styles.hubTabItemActive]}
          onPress={() => setActiveTab('schedule')}
          activeOpacity={0.7}
        >
          <Clock size={13} color={activeTab === 'schedule' ? '#047857' : '#64748B'} />
          <Text
            style={[styles.hubTabText, activeTab === 'schedule' && styles.hubTabTextActive]}
            numberOfLines={1}
          >
            Schedule
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hubTabItem, activeTab === 'services' && styles.hubTabItemActive]}
          onPress={() => setActiveTab('services')}
          activeOpacity={0.7}
        >
          <Sparkles size={13} color={activeTab === 'services' ? '#047857' : '#64748B'} />
          <Text
            style={[styles.hubTabText, activeTab === 'services' && styles.hubTabTextActive]}
            numberOfLines={1}
          >
            Rates ({clinicData.services?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* EDIT TAB 1: BRAND, ADDRESS & GALLERY */}
        {activeTab === 'overview' && (
          <View>
            {/* Logo Options */}
            <View style={styles.hubCard}>
              <Text style={styles.cardHeaderTitle}>CLINIC LOGO SELECTION</Text>

              <View style={styles.logoSplitRow}>
                <TouchableOpacity
                  style={[
                    styles.logoSelectTile,
                    isUsingAppLogo && styles.logoSelectTileActive,
                  ]}
                  onPress={handleSelectAppLogo}
                  activeOpacity={0.75}
                >
                  <Image source={APP_LOGO} style={styles.logoThumbImg} resizeMode="contain" />
                  <Text style={[styles.logoSelectTitle, isUsingAppLogo && styles.logoSelectTitleActive]}>
                    App Logo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.logoSelectTile,
                    isUsingCustomLogo && styles.logoSelectTileActive,
                  ]}
                  onPress={handleSelectCustomLogo}
                  activeOpacity={0.75}
                >
                  {lastCustomLogoUrl || isUsingCustomLogo ? (
                    <Image
                      source={{ uri: (isUsingCustomLogo ? clinicData.logo_url : lastCustomLogoUrl)! }}
                      style={styles.logoThumbImg}
                    />
                  ) : (
                    <View style={styles.logoThumbPlaceholder}>
                      <Camera size={18} color="#047857" />
                    </View>
                  )}
                  <Text style={[styles.logoSelectTitle, isUsingCustomLogo && styles.logoSelectTitleActive]}>
                    Custom Logo
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.logoActionButtonsRow}>
                <TouchableOpacity
                  onPress={handleUploadLogoPress}
                  disabled={saving || uploadingLogo}
                  style={styles.customUploadBtn}
                  activeOpacity={0.75}
                >
                  {uploadingLogo ? (
                    <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
                  ) : (
                    <Camera size={14} color="#047857" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.customUploadBtnText}>
                    {isUsingCustomLogo ? "Replace Custom Logo" : "Upload Custom Logo"}
                  </Text>
                </TouchableOpacity>

                {Boolean(clinicData.logo_url) && (
                  <TouchableOpacity
                    onPress={handleRemoveLogo}
                    disabled={saving || uploadingLogo}
                    style={styles.removeLogoMiniBtn}
                  >
                    <Trash2 size={13} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Clinic Name & Address */}
            <View style={styles.hubCard}>
              <Text style={styles.cardHeaderTitle}>FACILITY INFORMATION</Text>

              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>CLINIC NAME *</Text>
                  {isNameChanged && <Text style={styles.modifiedTag}>● Modified</Text>}
                </View>
                <TextInput
                  style={[styles.inputField, isNameChanged && styles.inputGlow]}
                  placeholder="e.g. SmileGuard Dental Clinic"
                  placeholderTextColor="#94A3B8"
                  value={clinicData.clinic_name}
                  onChangeText={(text) => setClinicData((prev) => ({ ...prev, clinic_name: text }))}
                />
              </View>

              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>LOCATION ADDRESS *</Text>
                  {isAddressChanged && <Text style={styles.modifiedTag}>● Modified</Text>}
                </View>
                <TextInput
                  style={[styles.inputField, isAddressChanged && styles.inputGlow]}
                  placeholder="e.g. Unit 302, Dental Care Plaza, Ortigas Center"
                  placeholderTextColor="#94A3B8"
                  value={clinicData.address}
                  onChangeText={(text) => setClinicData((prev) => ({ ...prev, address: text }))}
                />
              </View>
            </View>

            {/* Facility Gallery Photos */}
            <View style={styles.hubCard}>
              <Text style={styles.cardHeaderTitle}>
                FACILITY PHOTOS ({clinicData.gallery_images?.length || 0})
              </Text>
              <Text style={styles.cardHelperText}>
                Showcase treatment chairs, sterilization facilities, and receptionist area.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryEditStrip}
              >
                <TouchableOpacity
                  style={styles.addPhotoTile}
                  onPress={handleUploadGalleryPress}
                  disabled={uploadingGallery}
                  activeOpacity={0.7}
                >
                  {uploadingGallery ? (
                    <ActivityIndicator size="small" color="#047857" />
                  ) : (
                    <>
                      <Plus size={18} color="#047857" strokeWidth={2.5} />
                      <Text style={styles.addPhotoTileText}>Add Photo</Text>
                    </>
                  )}
                </TouchableOpacity>

                {clinicData.gallery_images?.map((imgUrl, index) => (
                  <View key={index} style={styles.galleryThumbCard}>
                    <Image source={{ uri: imgUrl }} style={styles.galleryThumbImg} />
                    <TouchableOpacity
                      style={styles.deleteThumbBtn}
                      onPress={() => handleRemoveGalleryImage(imgUrl)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Trash2 size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* EDIT TAB 2: HOURS & HOLIDAYS */}
        {activeTab === 'schedule' && (
          <View>
            <View style={styles.hubCard}>
              <Text style={styles.cardHeaderTitle}>WEEKLY OPERATING SCHEDULE</Text>
              <Text style={styles.cardHelperText}>
                Configure clinic opening and closing hours for online booking availability.
              </Text>

              <View style={styles.editScheduleList}>
                {DAY_ORDER.map((dayKey) => {
                  const sched = clinicData.schedule[dayKey];
                  return (
                    <View key={dayKey} style={styles.editScheduleDayBox}>
                      <View style={styles.editScheduleHeader}>
                        <Text style={styles.editScheduleDayText}>{DAY_LABELS[dayKey]}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: sched.isOpen ? '#047857' : '#94A3B8',
                            }}
                          >
                            {sched.isOpen ? 'Open' : 'Closed'}
                          </Text>
                          <Switch
                            value={sched.isOpen}
                            onValueChange={(val) => handleScheduleToggle(dayKey, val)}
                            trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                            thumbColor={sched.isOpen ? '#047857' : '#CBD5E1'}
                          />
                        </View>
                      </View>

                      {sched.isOpen ? (
                        <View style={styles.timeButtonsRow}>
                          <TouchableOpacity
                            style={styles.timeSelectBtn}
                            onPress={() => openOpeningTimePicker(dayKey)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.timeSelectBtnLabel}>Opening</Text>
                            <Text style={styles.timeSelectBtnValue}>{sched.opening_time}</Text>
                          </TouchableOpacity>

                          <Text style={{ color: '#94A3B8', fontWeight: '800' }}>→</Text>

                          <TouchableOpacity
                            style={styles.timeSelectBtn}
                            onPress={() => openClosingTimePicker(dayKey)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.timeSelectBtnLabel}>Closing</Text>
                            <Text style={styles.timeSelectBtnValue}>{sched.closing_time}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.closedNote}>Clinic is closed on this day.</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Blockout Dates */}
            <View style={styles.hubCard}>
              <Text style={styles.cardHeaderTitle}>
                ONE-TIME HOLIDAYS & BLOCKOUT DATES ({blockoutDates.length})
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
                activeOpacity={0.75}
              >
                <Plus size={15} color="#047857" strokeWidth={2.5} />
                <Text style={styles.addBlockoutTriggerBtnText}>Add Holiday / Blockout Date</Text>
              </TouchableOpacity>

              {blockoutDates.length > 0 && (
                <View style={styles.blockoutList}>
                  {blockoutDates.map((blockout) => (
                    <View key={blockout.blockout_date} style={styles.blockoutItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.blockoutItemDate}>
                          {new Date(blockout.blockout_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        {Boolean(blockout.reason) && (
                          <Text style={styles.blockoutItemReason}>{blockout.reason}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveBlockoutDate(blockout.blockout_date)}
                        style={styles.deleteBlockoutBtn}
                      >
                        <Trash2 size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* EDIT TAB 3: PROCEDURES & RATES */}
        {activeTab === 'services' && (
          <View>
            <View style={styles.hubCard}>
              <Text style={styles.cardHeaderTitle}>QUICK-ADD COMMON PROCEDURES</Text>
              <View style={styles.predefinedPillsWrap}>
                {PREDEFINED_SERVICES.map((predefined) => {
                  const alreadyAdded = clinicData.services.some(
                    (s) => s.name.toLowerCase() === predefined.toLowerCase()
                  );
                  return (
                    <TouchableOpacity
                      key={predefined}
                      style={[
                        styles.predefinedPill,
                        alreadyAdded ? styles.predefinedPillDisabled : styles.predefinedPillActive,
                      ]}
                      onPress={() => handleAddService(predefined)}
                      disabled={alreadyAdded}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.predefinedPillText,
                          alreadyAdded && styles.predefinedPillTextDisabled,
                        ]}
                      >
                        {alreadyAdded ? `✓ ${predefined}` : `+ ${predefined}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.cardHeaderTitle, { marginTop: 14 }]}>ADD CUSTOM PROCEDURE</Text>
              <View style={styles.addServiceRow}>
                <TextInput
                  style={[styles.inputField, { flex: 2, marginBottom: 0 }]}
                  placeholder="Procedure Name (e.g. Veneers)"
                  placeholderTextColor="#94A3B8"
                  value={newService}
                  onChangeText={setNewService}
                />
                <View style={styles.currencyPriceInputBox}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.currencyInput}
                    placeholder="Price"
                    placeholderTextColor="#94A3B8"
                    value={newServicePrice}
                    onChangeText={setNewServicePrice}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity
                  style={styles.addServiceBtn}
                  onPress={() => handleAddService()}
                  activeOpacity={0.8}
                >
                  <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Editable Rates List */}
              <Text style={[styles.cardHeaderTitle, { marginTop: 14 }]}>
                PROCEDURE RATES & PRICING ({clinicData.services?.length || 0})
              </Text>
              <View style={styles.serviceRatesList}>
                {clinicData.services.map((service) => (
                  <View key={service.id} style={styles.serviceRateRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceRateName}>{service.name}</Text>
                      <Text style={styles.serviceRateSub}>Online Booking</Text>
                    </View>
                    <View style={styles.serviceRatePriceWrap}>
                      <Text style={styles.serviceRatePrefix}>₱</Text>
                      <TextInput
                        style={styles.serviceRateInput}
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
                      style={styles.removeServiceBtn}
                    >
                      <Trash2 size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Action Footer Buttons */}
        <View style={styles.hubFooterRow}>
          <TouchableOpacity
            style={styles.hubSecondaryBtn}
            onPress={handleCancelEdit}
            disabled={saving || uploadingLogo || uploadingGallery}
            activeOpacity={0.7}
          >
            <Text style={styles.hubSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>

          {hasAnyChanges ? (
            <TouchableOpacity
              style={[
                styles.hubPrimaryBtn,
                (saving || uploadingLogo || uploadingGallery) && styles.btnDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || uploadingLogo || uploadingGallery}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.hubPrimaryBtnText}>Save Changes</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.hubSkipBtn}
              onPress={handleSkip}
              disabled={saving || uploadingLogo || uploadingGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.hubSkipBtnText}>Skip Setup</Text>
              <ChevronRight size={15} color="#047857" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Opening Time Modal */}
      <Modal
        visible={showOpeningTimePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOpeningTimePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Select Opening Time</Text>
              <TouchableOpacity onPress={() => setShowOpeningTimePicker(null)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeSelectorRow}>
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
                style={styles.modalCancelBtn}
                onPress={() => setShowOpeningTimePicker(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => confirmOpeningTime(showOpeningTimePicker)}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Closing Time Modal */}
      <Modal
        visible={showClosingTimePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClosingTimePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Select Closing Time</Text>
              <TouchableOpacity onPress={() => setShowClosingTimePicker(null)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeSelectorRow}>
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
                style={styles.modalCancelBtn}
                onPress={() => setShowClosingTimePicker(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => confirmClosingTime(showClosingTimePicker)}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Format Modal */}
      <Modal
        visible={showImageFormatModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageFormatModal(false);
          setPendingUploadType(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Image Aspect Ratio</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowImageFormatModal(false);
                  setPendingUploadType(null);
                }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.formatBtn}
              onPress={() => {
                setShowImageFormatModal(false);
                if (pendingUploadType === 'logo') {
                  performLogoUpload([1, 1]);
                } else if (pendingUploadType === 'gallery') {
                  performGalleryUpload([1, 1]);
                }
                setPendingUploadType(null);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.formatBtnTitle}>Square (1:1)</Text>
              <Text style={styles.formatBtnDesc}>Optimal for clinic logos and square cards</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.formatBtn}
              onPress={() => {
                setShowImageFormatModal(false);
                if (pendingUploadType === 'logo') {
                  performLogoUpload(undefined);
                } else if (pendingUploadType === 'gallery') {
                  performGalleryUpload(undefined);
                }
                setPendingUploadType(null);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.formatBtnTitle}>Free Form</Text>
              <Text style={styles.formatBtnDesc}>Preserves original camera or landscape dimensions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => {
                setShowImageFormatModal(false);
                setPendingUploadType(null);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Blockout Date Picker Modal */}
      <Modal
        visible={showBlockoutDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlockoutDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Add Blockout Date</Text>
              <TouchableOpacity onPress={() => setShowBlockoutDatePicker(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>SELECT DATE (MONTH / DAY / YEAR)</Text>
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

            <View style={{ marginBottom: 16 }}>
              <Text style={styles.fieldLabel}>REASON (OPTIONAL)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Clinic Renovation, Public Holiday..."
                placeholderTextColor="#94A3B8"
                value={blockoutReason}
                onChangeText={setBlockoutReason}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowBlockoutDatePicker(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  const m = parseInt(tempBlockoutMonth, 10) || 1;
                  const d = parseInt(tempBlockoutDay, 10) || 1;
                  const y = parseInt(tempBlockoutYear, 10) || today.getFullYear();
                  handleAddBlockoutDate(m, d, y);
                }}
              >
                <Text style={styles.modalConfirmBtnText}>Add Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES: CLINIC MANAGEMENT HUB ARCHETYPE
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
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
    fontSize: 13,
    color: '#047857',
    fontWeight: '700',
  },

  // Module Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#047857',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#022C22',
  },
  editHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSkipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  headerSkipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  closeActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Segmented Hub Tab Bar (View Mode - Below 3 Grids)
  hubTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    marginBottom: 16,
  },
  // Edit Mode Tab Bar (Under Top Header)
  editHubTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  hubTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  hubTabItemActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#047857',
    borderBottomWidth: 2,
    borderBottomColor: '#047857',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  hubTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    flexShrink: 1,
  },
  hubTabTextActive: {
    color: '#047857',
    fontWeight: '800',
  },

  // View Mode: Clinic Facade Card
  clinicFacadeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  facadeLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  facadeLogoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  facadeLogo: {
    width: '100%',
    height: '100%',
  },
  facadeLogoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  facadeTitleCol: {
    flex: 1,
  },
  facadeClinicName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  facadeAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  facadeAddressText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  facadeStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  facadeStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  facadeStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },

  // Stats Row
  clinicStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  clinicStatTile: {
    alignItems: 'center',
    flex: 1,
  },
  clinicStatNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  clinicStatSub: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  clinicStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },

  // Section Header
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingLeft: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  quickUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2,
    borderBottomColor: '#022C22',
  },
  quickUploadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  emptyUploadBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#047857',
  },

  // Facility Masonry Grid
  galleryMasonryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  galleryMasonryCard: {
    width: '48.5%',
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  galleryMasonryImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyGalleryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyGalleryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginTop: 8,
  },
  emptyGallerySubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
  },

  // Schedule View Mode
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 12,
  },
  scheduleDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  scheduleDayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  scheduleDayRowCurrent: {
    backgroundColor: '#F0FDF4',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  scheduleDayTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  scheduleDayTitleCurrent: {
    fontWeight: '800',
    color: '#047857',
  },
  todayPill: {
    backgroundColor: '#047857',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  todayPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  openBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },
  closedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closedBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Blockout Cards
  blockoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 12,
  },
  blockoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  blockoutRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  blockoutDateLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  blockoutReasonLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  blockedPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  blockedPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  emptyScheduleText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },

  // Treatments & Rates View Mode
  servicesGrid: {
    gap: 8,
  },
  serviceItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 12,
  },
  serviceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serviceNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  servicePortalHint: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  ratePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  ratePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },

  // Edit Mode Hub Cards
  hubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  cardHelperText: {
    fontSize: 11.5,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },

  // Logo Split
  logoSplitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  logoSelectTile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 10,
    alignItems: 'center',
  },
  logoSelectTileActive: {
    borderColor: '#047857',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  logoThumbImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 6,
  },
  logoThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoSelectTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  logoSelectTitleActive: {
    color: '#047857',
    fontWeight: '800',
  },
  logoActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  customUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
  },
  customUploadBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#047857',
  },
  removeLogoMiniBtn: {
    padding: 7,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  // Input Fields in Edit Mode
  inputGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  inputField: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  inputGlow: {
    borderWidth: 1.5,
    borderColor: '#047857',
    backgroundColor: '#F0FDF4',
  },
  modifiedTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#047857',
  },

  // Gallery Edit Strip
  galleryEditStrip: {
    paddingVertical: 4,
    gap: 8,
  },
  addPhotoTile: {
    width: 68,
    height: 68,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderStyle: 'dashed',
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoTileText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  galleryThumbCard: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  galleryThumbImg: {
    width: '100%',
    height: '100%',
  },
  deleteThumbBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Edit Schedule List
  editScheduleList: {
    gap: 8,
  },
  editScheduleDayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  editScheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editScheduleDayText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  timeButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  timeSelectBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  timeSelectBtnLabel: {
    fontSize: 9.5,
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  timeSelectBtnValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  closedNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Blockout Trigger & List
  addBlockoutTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 9,
    marginBottom: 8,
  },
  addBlockoutTriggerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  blockoutList: {
    gap: 6,
  },
  blockoutItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  blockoutItemDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  blockoutItemReason: {
    fontSize: 10.5,
    color: '#64748B',
  },
  deleteBlockoutBtn: {
    padding: 4,
  },

  // Procedures & Rates Edit Tab
  predefinedPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  predefinedPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  predefinedPillActive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
  },
  predefinedPillDisabled: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  predefinedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  predefinedPillTextDisabled: {
    color: '#047857',
  },
  addServiceRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  currencyPriceInputBox: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingHorizontal: 8,
    height: 40,
  },
  currencySymbol: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#047857',
    marginRight: 4,
  },
  currencyInput: {
    flex: 1,
    padding: 0,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '700',
  },
  addServiceBtn: {
    backgroundColor: '#047857',
    borderRadius: 6,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#022C22',
  },
  serviceRatesList: {
    gap: 6,
  },
  serviceRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 8,
  },
  serviceRateName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  serviceRateSub: {
    fontSize: 10,
    color: '#64748B',
  },
  serviceRatePriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 6,
    height: 32,
    minWidth: 76,
  },
  serviceRatePrefix: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#047857',
    marginRight: 2,
  },
  serviceRateInput: {
    flex: 1,
    padding: 0,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  removeServiceBtn: {
    padding: 4,
  },

  // Hub Footer Row
  hubFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 24,
  },
  hubSecondaryBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  hubPrimaryBtn: {
    flex: 1.8,
    backgroundColor: '#047857',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 3,
    borderBottomColor: '#022C22',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  hubPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hubSkipBtn: {
    flex: 1.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 13,
  },
  hubSkipBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Action Button
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 3,
    borderBottomColor: '#022C22',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionButtonText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // Empty Container
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 32,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 12,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  timeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  timeCol: {
    alignItems: 'center',
  },
  timeArrowBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  timeArrowText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#047857',
  },
  timeNumberInput: {
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 6,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    width: 60,
    color: '#047857',
    backgroundColor: '#ECFDF5',
  },
  timeColon: {
    fontSize: 24,
    fontWeight: '800',
    color: '#334155',
  },
  timePeriodDisplay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#047857',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    minWidth: 56,
    textAlign: 'center',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  modalConfirmBtn: {
    flex: 1.5,
    backgroundColor: '#047857',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#022C22',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formatBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  formatBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#047857',
  },
  formatBtnDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
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
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    color: '#047857',
    backgroundColor: '#ECFDF5',
  },
  dateSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  dateSlash: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#94A3B8',
    marginBottom: 14,
  },
});
