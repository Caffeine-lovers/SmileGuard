import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Appointment } from "../../data/dashboardData";

// Type alias for backwards compatibility
type AppointmentType = Appointment;

interface RecordsTabProps {
  patients: AppointmentType[];
  quickSearchQuery: string;
  setQuickSearchQuery: (query: string) => void;
  patientSortBy: 'name' | 'date' | 'service';
  setPatientSortBy: (sortBy: 'name' | 'date' | 'service') => void;
  patientSortOrder: 'asc' | 'desc';
  setPatientSortOrder: (order: 'asc' | 'desc') => void;
  sortPatients: (patientsToSort: AppointmentType[]) => AppointmentType[];
  setViewingPatient: (patient: AppointmentType) => void;
  setShowPatientDetails: (show: boolean) => void;
  styles: any;
}

export default function RecordsTab({
  patients,
  quickSearchQuery,
  setQuickSearchQuery,
  patientSortBy,
  setPatientSortBy,
  patientSortOrder,
  setPatientSortOrder,
  sortPatients,
  setViewingPatient,
  setShowPatientDetails,
  styles,
}: RecordsTabProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
      <View style={{ paddingHorizontal: 16, borderBottomColor: '#ddd', borderBottomWidth: 1 }}>
        <TextInput
          style={{
            backgroundColor: '#fff',
            borderColor: '#0b7fab',
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: '#333',
            marginBottom: 12,
          }}
          placeholder="Search by name, service, email, contact..."
          placeholderTextColor="#999"
          value={quickSearchQuery}
          onChangeText={setQuickSearchQuery}
        />
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 7 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#666', alignSelf: 'center' }}>Sort by:</Text>
          <TouchableOpacity
            onPress={() => setPatientSortBy('name')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: patientSortBy === 'name' ? '#0b7fab' : '#e0e0e0',
              borderWidth: 1,
              borderColor: patientSortBy === 'name' ? '#0b7fab' : '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: patientSortBy === 'name' ? '#fff' : '#333', fontWeight: '500' }}>Name</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPatientSortBy('date')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: patientSortBy === 'date' ? '#0b7fab' : '#e0e0e0',
              borderWidth: 1,
              borderColor: patientSortBy === 'date' ? '#0b7fab' : '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: patientSortBy === 'date' ? '#fff' : '#333', fontWeight: '500' }}>Date</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPatientSortOrder(patientSortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: '#f0f0f0',
              borderWidth: 1,
              borderColor: '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: '#333', fontWeight: '500' }}>
              {patientSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {sortPatients(
          patients
            .filter((patient) =>
              patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
              patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
              patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
              patient.contact.includes(quickSearchQuery)
            )
        )
          .length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
            {quickSearchQuery ? `No patients found matching "${quickSearchQuery}"` : 'All patients listed below'}
          </Text>
        ) : (
          sortPatients(
            patients
              .filter((patient) =>
                patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                patient.contact.includes(quickSearchQuery)
              )
          )
            .map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12 }]}
                onPress={() => {
                  setViewingPatient(patient);
                  setShowPatientDetails(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
                    style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 2 }}>{patient.name}</Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>{patient.email}</Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>{patient.contact}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
                </View>
              </TouchableOpacity>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
