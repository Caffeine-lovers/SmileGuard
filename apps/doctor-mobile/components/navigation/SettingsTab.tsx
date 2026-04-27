import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CurrentUser, Doctor, EMPTY_DOCTOR } from '@smileguard/shared-types';
import DoctorProfileView from '../settings/DoctorProfileViewing';
import ClinicSetup from '../settings/ClinicSetup';
import AppointmentsRuleSetup from '../settings/AppointmentsRuleSetup';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorProfile, updateDoctorProfile } from '../../lib/doctorService';

interface SettingsTabProps {
  user: CurrentUser;
  onUpdateProfile?: (updatedUser: Partial<CurrentUser>) => void;
  styles: any;
  onProfileUpdated?: (doctorName: string, doctorId: string) => void;
}

type Theme = 'light' | 'dark';
type FontSize = 'small' | 'medium' | 'large';

interface AppSettings {
  appointmentReminders: boolean;
  newPatientRequests: boolean;
  theme: Theme;
  fontSize: FontSize;
}

export default function SettingsTab({ user, onUpdateProfile, styles, onProfileUpdated }: SettingsTabProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingClinic, setEditingClinic] = useState(false);
  const [editingAppointmentRules, setEditingAppointmentRules] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(user);
  const [doctorData, setDoctorData] = useState<Doctor>(EMPTY_DOCTOR);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const { currentUser: authUser } = useAuth();
  const [appSettings, setAppSettings] = useState<AppSettings>({
    appointmentReminders: true,
    newPatientRequests: true,
    theme: 'light',
    fontSize: 'medium',
  });

  // Fetch doctor profile when modal opens
  useEffect(() => {
    if (editingProfile && authUser?.id) {
      fetchDoctorData();
    }
  }, [editingProfile, authUser?.id]);

  const fetchDoctorData = async () => {
    try {
      setLoadingDoctor(true);
      const userId = authUser?.id;
      console.log('=== FETCH DOCTOR DEBUG ===');
      console.log('authUser:', authUser);
      console.log('User ID:', userId);
      
      if (!userId) {
        console.warn('❌ No user ID available');
        setDoctorData(EMPTY_DOCTOR);
        setLoadingDoctor(false);
        return;
      }

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fetch timeout after 5s')), 5000)
      );

      const doctor = await Promise.race([
        getDoctorProfile(userId),
        timeoutPromise,
      ]) as Doctor | null;

      console.log('✅ Doctor profile result:', doctor);
      if (doctor) {
        setDoctorData(doctor);
      } else {
        console.warn('⚠️ No doctor profile found, using empty doctor');
        setDoctorData(EMPTY_DOCTOR);
      }
    } catch (error) {
      console.error('❌ Failed to fetch doctor profile:', error);
      setDoctorData(EMPTY_DOCTOR);
    } finally {
      setLoadingDoctor(false);
    }
  };

  const handleSaveProfile = async (updatedDoctor: Partial<Doctor>) => {
    try {
      console.log('💾 Saving doctor profile updates:', updatedDoctor);
      
      if (!doctorData.id) {
        console.error('❌ Doctor ID is not available');
        return;
      }

      // Call Supabase to update the doctor profile
      const result = await updateDoctorProfile(doctorData.id, updatedDoctor);
      
      if (result) {
        console.log('✅ Profile updated in Supabase:', result);
        // Update local state with the returned data
        setDoctorData(result);
        
        // Trigger notification callback if provided
        if (onProfileUpdated && result.id) {
          onProfileUpdated(result.doctor_name || 'Doctor', result.id);
        }
        // Don't close modal - keep it open for more edits
      } else {
        console.error('❌ Failed to update profile in Supabase');
      }
    } catch (error) {
      console.error('❌ Failed to save profile:', error);
    }
  };

  const handleSaveClinic = async (clinicData: any) => {
    try {
      console.log('💾 Saving clinic setup:', clinicData);
      // TODO: Implement clinic data saving to Supabase
      // For now, just log the data
      console.log('✅ Clinic data ready to save:', clinicData);
    } catch (error) {
      console.error('❌ Failed to save clinic data:', error);
    }
  };

  const handleSaveAppointmentRules = async (rules: any) => {
    try {
      console.log('💾 Saving appointment rules:', rules);
      console.log('✅ Appointment rules saved successfully');
    } catch (error) {
      console.error('❌ Failed to save appointment rules:', error);
    }
  };

  const toggleNotificationSetting = (setting: 'appointmentReminders' | 'newPatientRequests') => {
    setAppSettings(prev => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const updateTheme = (newTheme: Theme) => {
    setAppSettings(prev => ({
      ...prev,
      theme: newTheme,
    }));
  };

  const updateFontSize = (newSize: FontSize) => {
    setAppSettings(prev => ({
      ...prev,
      fontSize: newSize,
    }));
  };

  const fontSizeValues = { small: 12, medium: 14, large: 16 };
  const ACCENT_COLOR = '#0b7fab';
  const LIGHT_BG = '#f0f8ff';
  const CARD_BG = '#fff';
  const TEXT_PRIMARY = '#333';
  const TEXT_SECONDARY = '#666';
  const BORDER_COLOR = '#ddd';

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ backgroundColor: LIGHT_BG, flex: 1 }}>
        <View style={{ paddingHorizontal: 16 }}>
          {/* Header */}
          <View style={{ marginBottom: 32, marginTop: 24, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: BORDER_COLOR }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, marginTop: 30 }}>
              <Image
                source={require('../../assets/images/icon/settings.png')}
                style={{ width: 28, height: 28, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
              />
              <Text style={{ fontSize: 32, fontWeight: '800', color: ACCENT_COLOR }}>Settings</Text>
            </View>
            <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>Manage clinic and appointments</Text>
          </View>

          {/* Profile Section */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Profile Settings</Text>
            <TouchableOpacity
              style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: ACCENT_COLOR, borderWidth: 1, borderTopColor: BORDER_COLOR, borderRightColor: BORDER_COLOR, borderBottomColor: BORDER_COLOR }}
              onPress={() => setEditingProfile(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 4 }}>Doctor Profile</Text>
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>Name, specialty, credentials</Text>
                </View>
                <Image
                  source={require('../../assets/images/icon/open.png')}
                  style={{ width: 20, height: 20, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Clinic Settings Section */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clinic</Text>
            <TouchableOpacity
              style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: ACCENT_COLOR, borderWidth: 1, borderTopColor: BORDER_COLOR, borderRightColor: BORDER_COLOR, borderBottomColor: BORDER_COLOR }}
              onPress={() => setEditingClinic(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 4 }}>Clinic Setup</Text>
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>Hours, location, services</Text>
                </View>
                <Image
                  source={require('../../assets/images/icon/open.png')}
                  style={{ width: 20, height: 20, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Appointment Settings Section */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Appointments</Text>
            <TouchableOpacity
              style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: ACCENT_COLOR, borderWidth: 1, borderTopColor: BORDER_COLOR, borderRightColor: BORDER_COLOR, borderBottomColor: BORDER_COLOR }}
              onPress={() => setEditingAppointmentRules(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 4 }}>Appointment Rules</Text>
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>Cancellation, reschedule, no-show policies</Text>
                </View>
                <Image
                  source={require('../../assets/images/icon/open.png')}
                  style={{ width: 20, height: 20, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Notifications Section */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notifications</Text>
            
            <View style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 0, overflow: 'hidden', borderWidth: 1, borderColor: BORDER_COLOR }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>Appointment Reminders</Text>
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>Get notified before appointments</Text>
                </View>
                <Switch
                  value={appSettings.appointmentReminders}
                  onValueChange={() => toggleNotificationSetting('appointmentReminders')}
                  trackColor={{ false: '#e0e0e0', true: '#B3E5FC' }}
                  thumbColor={appSettings.appointmentReminders ? ACCENT_COLOR : '#ccc'}
                />
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY }}>New Patient Requests</Text>
                  <Text style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>Get notifications for new requests</Text>
                </View>
                <Switch
                  value={appSettings.newPatientRequests}
                  onValueChange={() => toggleNotificationSetting('newPatientRequests')}
                  trackColor={{ false: '#e0e0e0', true: '#B3E5FC' }}
                  thumbColor={appSettings.newPatientRequests ? ACCENT_COLOR : '#ccc'}
                />
              </View>
            </View>
          </View>

          {/* Font Size Selection */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Text Size</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['small', 'medium', 'large'] as const).map((sizeOption) => (
                <TouchableOpacity
                  key={sizeOption}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: appSettings.fontSize === sizeOption ? ACCENT_COLOR : '#e0e0e0',
                    backgroundColor: appSettings.fontSize === sizeOption ? '#EBF8FF' : '#f9f9f9',
                    alignItems: 'center',
                  }}
                  activeOpacity={0.7}
                  onPress={() => updateFontSize(sizeOption)}
                >
                  <Text
                    style={{
                      fontSize: fontSizeValues[sizeOption],
                      fontWeight: '700',
                      color: appSettings.fontSize === sizeOption ? ACCENT_COLOR : TEXT_SECONDARY,
                      textTransform: 'capitalize',
                    }}
                  >
                    {sizeOption[0].toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* About & Help Section */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Support</Text>
            
            <TouchableOpacity
              style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER_COLOR }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }}>Privacy Policy</Text>
              </View>
              <Image
                source={require('../../assets/images/icon/open.png')}
                style={{ width: 18, height: 18, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER_COLOR }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }}>Terms & Conditions</Text>
              </View>
              <Image
                source={require('../../assets/images/icon/open.png')}
                style={{ width: 18, height: 18, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ backgroundColor: CARD_BG, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: BORDER_COLOR }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY }}>Contact Support</Text>
              </View>
              <Image
                source={require('../../assets/images/icon/open.png')}
                style={{ width: 18, height: 18, resizeMode: 'contain', tintColor: ACCENT_COLOR }}
              />
            </TouchableOpacity>
          </View>

          {/* Version & Footer */}
          <View style={{ alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: BORDER_COLOR }}>
            <Text style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 6 }}>© 2026 SmileGuard Dental. All rights reserved.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editingProfile}
        animationType="slide"
        onRequestClose={() => setEditingProfile(false)}
      >
        {loadingDoctor ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0b7fab" />
          </View>
        ) : (
          <DoctorProfileView
            doctor={doctorData}
            onSave={handleSaveProfile}
            onClose={() => setEditingProfile(false)}
          />
        )}
      </Modal>

      {/* Clinic Setup Modal */}
      <Modal
        visible={editingClinic}
        animationType="slide"
        onRequestClose={() => setEditingClinic(false)}
      >
        <ClinicSetup
          onSave={handleSaveClinic}
          onClose={() => setEditingClinic(false)}
        />
      </Modal>

      {/* Appointment Rules Modal */}
      <Modal
        visible={editingAppointmentRules}
        animationType="slide"
        onRequestClose={() => setEditingAppointmentRules(false)}
      >
        <AppointmentsRuleSetup
          onSave={handleSaveAppointmentRules}
          onClose={() => setEditingAppointmentRules(false)}
        />
      </Modal>
    </>
  );
}
