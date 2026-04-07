import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { CurrentUser } from '@smileguard/shared-types';
import DoctorProfileEdit from '../settings/ClinicProfileViewing';

interface SettingsTabProps {
  user: CurrentUser;
  onUpdateProfile?: (updatedUser: Partial<CurrentUser>) => void;
  styles: any;
}


export default function SettingsTab({ user, onUpdateProfile, styles }: SettingsTabProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(user);

  const handleSaveProfile = (updatedUser: Partial<CurrentUser>) => {
    const newUser = { ...currentUser, ...updatedUser };
    setCurrentUser(newUser);
    if (onUpdateProfile) {
      onUpdateProfile(updatedUser);
    }
    setEditingProfile(false);
  };

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
                <View style={styles.toggleSwitch}>
                  <View style={[styles.toggleButton, { marginLeft: 6 }]} />
                </View>
              </View>
            </View>
            <View style={styles.settingsCard}>
              <View style={styles.settingsToggleItem}>
                <Text style={styles.settingsLabel}>New Patient Requests</Text>
                <View style={styles.toggleSwitch}>
                  <View style={[styles.toggleButton, { marginLeft: 6 }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Appearance Settings */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>🎨 Appearance</Text>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>Theme</Text>
                <Text style={styles.settingsValue}>Light</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsLabel}>Font Size</Text>
                <Text style={styles.settingsValue}>Medium</Text>
              </TouchableOpacity>
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
