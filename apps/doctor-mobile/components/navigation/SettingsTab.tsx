import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
  Animated,
} from 'react-native';
import { CurrentUser } from '@smileguard/shared-types';
import DoctorProfileEdit from '../settings/ClinicProfileViewing';

interface SettingsTabProps {
  user: CurrentUser;
  onUpdateProfile?: (updatedUser: Partial<CurrentUser>) => void;
  styles: any;
}

type Theme = 'light' | 'dark';
type FontSize = 'small' | 'medium' | 'large';

interface AppSettings {
  appointmentReminders: boolean;
  newPatientRequests: boolean;
  theme: Theme;
  fontSize: FontSize;
}

export default function SettingsTab({ user, onUpdateProfile, styles }: SettingsTabProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(user);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    appointmentReminders: true,
    newPatientRequests: true,
    theme: 'light',
    fontSize: 'medium',
  });

  const handleSaveProfile = (updatedUser: Partial<CurrentUser>) => {
    const newUser = { ...currentUser, ...updatedUser };
    setCurrentUser(newUser);
    if (onUpdateProfile) {
      onUpdateProfile(updatedUser);
    }
    setEditingProfile(false);
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

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollViewContent}>
        <View style={styles.container}>
          <Text style={[styles.header, { marginBottom: 30 }]}>Settings</Text>

          {/* Profile Section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>👤 Profile</Text>
            <TouchableOpacity
              style={styles.settingsCard}
              onPress={() => setEditingProfile(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>Edit Dentist Profile Setup</Text>
                <Text style={{ fontSize: 16, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Notification Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🔔 Notifications</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingsToggleItem}>
                <Text style={styles.settingsLabel}>Appointment Reminders</Text>
                <Switch
                  value={appSettings.appointmentReminders}
                  onValueChange={() => toggleNotificationSetting('appointmentReminders')}
                  trackColor={{ false: '#ccc', true: '#11c' }}
                  thumbColor={appSettings.appointmentReminders ? '#0b7fab' : '#f4f3f4'}
                />
              </View>
            </View>
            <View style={styles.settingsCard}>
              <View style={styles.settingsToggleItem}>
                <Text style={styles.settingsLabel}>New Patient Requests</Text>
                <Switch
                  value={appSettings.newPatientRequests}
                  onValueChange={() => toggleNotificationSetting('newPatientRequests')}
                  trackColor={{ false: '#ccc', true: '#0b7fab' }}
                  thumbColor={appSettings.newPatientRequests ? '#0b7fab' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>

          {/* Appearance Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🎨 Appearance</Text>
            
            {/* Theme Selection */}
            <View style={styles.settingsCard}>
              <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                <Text style={styles.settingsLabel}>Theme</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {(['light', 'dark'] as const).map((themeOption) => (
                    <TouchableOpacity
                      key={themeOption}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: appSettings.theme === themeOption ? '#0b7fab' : '#ddd',
                        backgroundColor: appSettings.theme === themeOption ? '#e3f2fd' : '#f5f5f5',
                        alignItems: 'center',
                      }}
                      onPress={() => updateTheme(themeOption)}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: appSettings.theme === themeOption ? '#0b7fab' : '#666',
                          textTransform: 'capitalize',
                        }}
                      >
                        {themeOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Font Size Selection */}
            <View style={styles.settingsCard}>
              <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                <Text style={styles.settingsLabel}>Font Size</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {(['small', 'medium', 'large'] as const).map((sizeOption) => (
                    <TouchableOpacity
                      key={sizeOption}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: appSettings.fontSize === sizeOption ? '#0b7fab' : '#ddd',
                        backgroundColor: appSettings.fontSize === sizeOption ? '#e3f2fd' : '#f5f5f5',
                        alignItems: 'center',
                      }}
                      onPress={() => updateFontSize(sizeOption)}
                    >
                      <Text
                        style={{
                          fontSize: fontSizeValues[sizeOption],
                          fontWeight: '600',
                          color: appSettings.fontSize === sizeOption ? '#0b7fab' : '#666',
                          textTransform: 'capitalize',
                        }}
                      >
                        {sizeOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>ℹ️ About</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>App Version</Text>
                <Text style={styles.settingsValue}>1.0.0</Text>
              </View>
            </View>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>Privacy Policy</Text>
                <Text style={{ fontSize: 16, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>Terms & Conditions</Text>
                <Text style={{ fontSize: 16, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Help Section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>❓ Help & Support</Text>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>Contact Support</Text>
                <Text style={{ fontSize: 16, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>FAQ</Text>
                <Text style={{ fontSize: 16, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editingProfile}
        animationType="slide"
        onRequestClose={() => setEditingProfile(false)}
      >
        <DoctorProfileEdit
          user={currentUser}
          onSave={handleSaveProfile}
          onCancel={() => setEditingProfile(false)}
          styles={styles}
        />
      </Modal>
    </>
  );
}
