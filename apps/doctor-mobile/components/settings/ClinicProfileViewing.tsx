import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { CurrentUser } from '@smileguard/shared-types';

interface DoctorProfileEditProps {
  user: CurrentUser;
  onSave: (updatedUser: Partial<CurrentUser>) => void;
  onCancel: () => void;
  styles: any;
}

export default function DoctorProfileEdit({
  user,
  onSave,
  onCancel,
  styles,
}: DoctorProfileEditProps) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [clinicName, setClinicName] = useState('SmileGuard Dental Clinic');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [appointmentDuration, setAppointmentDuration] = useState('30');
  const [breakBetweenAppointments, setBreakBetweenAppointments] = useState('5');
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('17:00');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name');
      return;
    }

    if (email && !email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    onSave({
      name: name.trim(),
      email: email.trim(),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f8ff' }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          borderBottomColor: '#ddd', 
          borderBottomWidth: 1 
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0b7fab' }}>Dentist Profile Setup</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={{ fontSize: 24, color: '#0b7fab', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Form Content */}
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {/* Dentist Profile Section */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0b7fab', marginBottom: 12, marginTop: 12 }}>👤 Dentist Information</Text>

          {/* Dentist Name */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Dentist Name</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="Enter your full name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />

          {/* Clinic Name */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Clinic Name</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="Enter clinic name"
            placeholderTextColor="#999"
            value={clinicName}
            onChangeText={setClinicName}
          />

          {/* Email Field */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Email</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          {/* Phone Field */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Phone Number</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="Enter phone number"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* License Number */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>License Number</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 24,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="Enter license number"
            placeholderTextColor="#999"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />

          {/* Appointment Rules Section */}
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0b7fab', marginBottom: 12 }}>📅 Appointment Rules</Text>

          {/* Appointment Duration */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Appointment Duration (minutes)</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="30"
            placeholderTextColor="#999"
            value={appointmentDuration}
            onChangeText={setAppointmentDuration}
            keyboardType="numeric"
          />

          {/* Break Between Appointments */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Break Between Appointments (minutes)</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="5"
            placeholderTextColor="#999"
            value={breakBetweenAppointments}
            onChangeText={setBreakBetweenAppointments}
            keyboardType="numeric"
          />

          {/* Working Hours Start */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Working Hours Start (HH:MM)</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 16,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="09:00"
            placeholderTextColor="#999"
            value={workingHoursStart}
            onChangeText={setWorkingHoursStart}
          />

          {/* Working Hours End */}
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Working Hours End (HH:MM)</Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#0b7fab',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              marginBottom: 32,
              backgroundColor: '#fff',
              color: '#333',
            }}
            placeholder="17:00"
            placeholderTextColor="#999"
            value={workingHoursEnd}
            onChangeText={setWorkingHoursEnd}
          />
        </ScrollView>

        {/* Footer Buttons */}
        <View style={{ 
          flexDirection: 'row', 
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12, 
          borderTopColor: '#ddd', 
          borderTopWidth: 1,
          alignSelf: 'stretch',
        }}>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: '#f0f0f0',
            }}
            onPress={onCancel}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#666', textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: '#0b7fab',
            }}
            onPress={handleSave}
          >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', textAlign: 'center' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
