import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CurrentUser, Doctor, EMPTY_DOCTOR, getDoctorFullName, getDoctorPrefix } from '@smileguard/shared-types';
import {
  Settings as SettingsIcon,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  Compass,
  Sparkles,
  Users,
  Calendar,
  ShieldCheck,
  Building,
  Bell,
  Type,
  HelpCircle,
  Lock,
  FileCheck,
  PhoneCall,
  User,
} from 'lucide-react-native';
import DoctorProfileView from '../settings/DoctorProfileViewing';
import ClinicSetup from '../settings/ClinicSetup';
import PayMongoDoctorGuideModal from '../billing/PayMongoDoctorGuideModal';
import { useAuth } from '../../hooks/useAuth';
import { getDoctorProfile, updateDoctorProfile } from '../../lib/doctorService';

interface SettingsTabProps {
  user: CurrentUser;
  onUpdateProfile?: (updatedUser: Partial<CurrentUser>) => void;
  styles: any;
  onProfileUpdated?: (doctorName: string, doctorId: string) => void;
  onStartTutorial?: () => void;
  onStartRecordsTutorial?: () => void;
  onStartAppointmentsTutorial?: () => void;
  onStartBillingTutorial?: () => void;
}

type Theme = 'light' | 'dark';
type FontSize = 'small' | 'medium' | 'large';

interface AppSettings {
  appointmentReminders: boolean;
  newPatientRequests: boolean;
  theme: Theme;
  fontSize: FontSize;
}

export default function SettingsTab({
  user,
  onUpdateProfile,
  styles,
  onProfileUpdated,
  onStartTutorial,
  onStartRecordsTutorial,
  onStartAppointmentsTutorial,
  onStartBillingTutorial,
}: SettingsTabProps) {
  const router = useRouter();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingClinic, setEditingClinic] = useState(false);
  const [showPayMongoGuide, setShowPayMongoGuide] = useState(false);
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
    const effectiveId = authUser?.id || user?.id;
    if (editingProfile && effectiveId) {
      fetchDoctorData();
    }
  }, [editingProfile, authUser?.id, user?.id]);

  const fetchDoctorData = async () => {
    try {
      setLoadingDoctor(true);
      const userId = authUser?.id || user?.id;
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
        if (onUpdateProfile && doctor.gender) {
          onUpdateProfile(doctor);
        }
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

      const effectiveUserId = updatedDoctor.user_id || doctorData.user_id || authUser?.id || user?.id;
      const targetId = updatedDoctor.id || doctorData.id || effectiveUserId;
      if (!targetId) {
        console.error('❌ Doctor ID is not available');
        throw new Error('Doctor ID is not available. Please try again.');
      }

      // Merge current doctorData with the new updates to ensure all fields and user_id persist
      const payload: Partial<Doctor> = {
        ...doctorData,
        ...updatedDoctor,
        user_id: effectiveUserId || "",
      };

      // Call Supabase to update the doctor profile
      const result = await updateDoctorProfile(targetId, payload);

      if (result) {
        console.log('✅ Profile updated in Supabase:', result);
        setDoctorData(result);

        if (onUpdateProfile) {
          onUpdateProfile(result);
        }

        if (onProfileUpdated && result.id) {
          const docTitle = `${getDoctorPrefix(result)} ${getDoctorFullName(result)}`.trim();
          onProfileUpdated(docTitle || 'Doctor', result.id);
        }
      } else {
        console.error('❌ Failed to update profile in Supabase');
        throw new Error('Failed to update doctor profile');
      }
    } catch (error) {
      console.error('❌ Failed to save profile:', error);
      throw error;
    }
  };

  const handleSaveClinic = async (clinicData: any) => {
    try {
      console.log('💾 Saving clinic setup:', clinicData);
      console.log('✅ Clinic data ready to save:', clinicData);
    } catch (error) {
      console.error('❌ Failed to save clinic data:', error);
    }
  };

  const toggleNotificationSetting = (setting: 'appointmentReminders' | 'newPatientRequests') => {
    setAppSettings(prev => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const updateFontSize = (newSize: FontSize) => {
    setAppSettings(prev => ({
      ...prev,
      fontSize: newSize,
    }));
  };

  const fontSizeValues = { small: 12, medium: 14, large: 16 };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Module Top Header */}
      <View style={localStyles.topHeader}>
        <View style={localStyles.headerTitleGroup}>
          <Text style={localStyles.topHeaderTitle}>CLINIC SETTINGS</Text>
          <View style={localStyles.pillCountBadge}>
            <Text style={localStyles.pillCountText}>CONFIG</Text>
          </View>
        </View>

        <View style={localStyles.headerActionsRow}>
          <TouchableOpacity
            onPress={onStartTutorial}
            style={localStyles.skeuoActionBtn}
            activeOpacity={0.7}
            accessibilityLabel="Start App Tour"
          >
            <Sparkles size={17} color="#047857" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Doctor Profile Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>DOCTOR PROFILE</Text>
          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={() => setEditingProfile(true)}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <User size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Doctor Profile</Text>
                <Text style={localStyles.cardSubtitle}>Name, specialty, license number & credentials</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Clinic Setup Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>CLINIC PRACTICE</Text>
          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={() => setEditingClinic(true)}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <Building size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Clinic Setup</Text>
                <Text style={localStyles.cardSubtitle}>Operating hours, clinic address, services & chairs</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* PayMongo Billing & Payout Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>BILLING & PAYOUTS</Text>
          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={() => setShowPayMongoGuide(true)}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <CreditCard size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={localStyles.cardTitle}>PayMongo Gateway Guide</Text>
                  <View style={localStyles.miniBadge}>
                    <Text style={localStyles.miniBadgeText}>GUIDELINES</Text>
                  </View>
                </View>
                <Text style={localStyles.cardSubtitle}>Clinic merchant setup, GCash/Maya & bank payouts</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>NOTIFICATIONS</Text>
          <View style={localStyles.skeuoGroupCard}>
            <View style={[localStyles.switchRow, { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={localStyles.cardTitle}>Appointment Reminders</Text>
                <Text style={localStyles.cardSubtitle}>Receive alerts before scheduled patient visits</Text>
              </View>
              <Switch
                value={appSettings.appointmentReminders}
                onValueChange={() => toggleNotificationSetting('appointmentReminders')}
                trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                thumbColor={appSettings.appointmentReminders ? '#047857' : '#94A3B8'}
              />
            </View>

            <View style={localStyles.switchRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={localStyles.cardTitle}>New Patient Requests</Text>
                <Text style={localStyles.cardSubtitle}>Notify when new booking requests arrive</Text>
              </View>
              <Switch
                value={appSettings.newPatientRequests}
                onValueChange={() => toggleNotificationSetting('newPatientRequests')}
                trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                thumbColor={appSettings.newPatientRequests ? '#047857' : '#94A3B8'}
              />
            </View>
          </View>
        </View>

        {/* Text Size Selection */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>DISPLAY TEXT SIZE</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['small', 'medium', 'large'] as const).map((sizeOption) => {
              const isSelected = appSettings.fontSize === sizeOption;
              return (
                <TouchableOpacity
                  key={sizeOption}
                  style={[
                    localStyles.fontSizeBtn,
                    isSelected && localStyles.fontSizeBtnActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => updateFontSize(sizeOption)}
                >
                  <Text
                    style={[
                      localStyles.fontSizeBtnText,
                      isSelected && localStyles.fontSizeBtnTextActive,
                      { fontSize: fontSizeValues[sizeOption] },
                    ]}
                  >
                    {sizeOption.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Interactive Walkthroughs Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>INTERACTIVE WALKTHROUGHS</Text>

          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={onStartTutorial}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <Compass size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Doctor Dashboard Walkthrough</Text>
                <Text style={localStyles.cardSubtitle}>Daily schedules, patient queue & quick actions</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={onStartRecordsTutorial}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <Users size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Patient Records Walkthrough</Text>
                <Text style={localStyles.cardSubtitle}>Search, sort & digital dental charts</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={onStartAppointmentsTutorial}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <Calendar size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Appointments Walkthrough</Text>
                <Text style={localStyles.cardSubtitle}>Monthly calendar, status filters & booking edits</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={onStartBillingTutorial}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <CreditCard size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Billing Ledger Walkthrough</Text>
                <Text style={localStyles.cardSubtitle}>Revenue tracking, invoices & PayMongo payouts</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={localStyles.skeuoCard}
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.75}
          >
            <View style={localStyles.cardContentRow}>
              <View style={[localStyles.iconBox, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                <Sparkles size={18} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Clinic Onboarding Wizard</Text>
                <Text style={localStyles.cardSubtitle}>Revisit the full setup: clinic hours, catalog & PayMongo</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#0284C7" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={{ marginBottom: 16 }}>
          <Text style={localStyles.sectionLabel}>SUPPORT & COMPLIANCE</Text>

          <TouchableOpacity style={localStyles.skeuoCard} activeOpacity={0.75}>
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <Lock size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Privacy Policy</Text>
                <Text style={localStyles.cardSubtitle}>Data privacy and patient confidentiality</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={localStyles.skeuoCard} activeOpacity={0.75}>
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <FileCheck size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Terms & Conditions</Text>
                <Text style={localStyles.cardSubtitle}>Platform service agreement & clinical rules</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={localStyles.skeuoCard} activeOpacity={0.75}>
            <View style={localStyles.cardContentRow}>
              <View style={localStyles.iconBox}>
                <PhoneCall size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.cardTitle}>Contact SmileGuard Support</Text>
                <Text style={localStyles.cardSubtitle}>Get technical assistance or report an issue</Text>
              </View>
              <View style={localStyles.chevronBox}>
                <ChevronRight size={16} color="#047857" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Version Footer */}
        <View style={localStyles.footerContainer}>
          <Text style={localStyles.footerVersionText}>SmileGuard Clinic Portal v2.6.0</Text>
          <Text style={localStyles.footerCopyrightText}>© 2026 SmileGuard Dental. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editingProfile}
        animationType="slide"
        onRequestClose={() => setEditingProfile(false)}
      >
        {loadingDoctor ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={{ marginTop: 12, color: '#047857', fontSize: 13, fontWeight: '700' }}>
              Loading doctor profile...
            </Text>
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

      {/* PayMongo Doctor Onboarding & Guidelines Modal */}
      <PayMongoDoctorGuideModal
        visible={showPayMongoGuide}
        onClose={() => setShowPayMongoGuide(false)}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  // Top Header Module Row
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
    gap: 8,
  },
  topHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  pillCountBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pillCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeuoActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section Label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingLeft: 2,
  },

  // Skeuomorphic Cards
  skeuoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 12,
    marginBottom: 8,
  },
  skeuoGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    overflow: 'hidden',
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },

  // Switch Rows
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // Text Size Buttons
  fontSizeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontSizeBtnActive: {
    backgroundColor: '#047857',
    borderTopColor: '#047857',
    borderLeftColor: '#047857',
    borderRightColor: '#064E3B',
    borderBottomColor: '#022C22',
    borderBottomWidth: 2.5,
  },
  fontSizeBtnText: {
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  fontSizeBtnTextActive: {
    color: '#FFFFFF',
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerVersionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  footerCopyrightText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});
