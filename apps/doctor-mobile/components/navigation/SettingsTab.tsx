import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { CurrentUser } from '@smileguard/shared-types';

interface SettingsTabProps {
  user: CurrentUser;
  styles: any;
}

export default function SettingsTab({ user, styles }: SettingsTabProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollViewContent}>
      <View style={styles.container}>
        <Text style={[styles.header, { marginBottom: 30 }]}>Settings</Text>

        {/* Profile Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>👤 Profile</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingsItem}>
              <Text style={styles.settingsLabel}>Name</Text>
              <Text style={styles.settingsValue}>{user.name}</Text>
            </View>
          </View>
          <View style={styles.settingsCard}>
            <View style={styles.settingsItem}>
              <Text style={styles.settingsLabel}>Email</Text>
              <Text style={styles.settingsValue}>{user.email || 'Not set'}</Text>
            </View>
          </View>
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
  );
}
