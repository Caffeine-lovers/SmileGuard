import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Appointment } from "../../data/dashboardData";
import * as dashboardService from "../../lib/dashboardService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { supabase } from "@smileguard/supabase-client";
import { getAllPatients } from "../../lib/profilesPatients";
import { RefreshCw, ChevronRight } from "lucide-react-native";

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
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [supabasePatients, setSupabasePatients] = useState<AppointmentType[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Note: Session restoration is no longer needed!
  // RLS policies now use auth.role() = 'authenticated' which uses JWT tokens
  // JWT tokens are sent with every request and work reliably in React Native

  // Fetch profiles patients on initial load
  useEffect(() => {
    const fetchSupabasePatients = async () => {
      setLoadingSupabase(true);
      try {
        const result = await dashboardService.fetchDoctorPatients(currentUser?.id || '');
        console.log('RecordsTab - Received profiles patients:', result.data);
        
        const mapped: AppointmentType[] = (result.data || []).map((patient: any) => ({
          id: patient.id,
          name: patient.name || 'Unknown Patient',
          email: patient.email || '',
          service: patient.service || 'General',
          contact: patient.phone || '',
          time: '',
          date: patient.created_at || new Date().toISOString(),
          age: 0,
          gender: patient.gender || '',
          notes: '',
          imageUrl: require('../../assets/images/user.png'),
          status: 'scheduled' as const,
        }));
        
        console.log('RecordsTab - Mapped profiles patients:', mapped);
        setSupabasePatients(mapped);
      } catch (error) {
        console.error('Error fetching profiles patients:', error);
      } finally {
        setLoadingSupabase(false);
      }
    };

    if (currentUser?.id) {
      fetchSupabasePatients();
    }
  }, [currentUser?.id]);



  // Refresh function to refetch both patient sources
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Verify user is logged in via currentUser hook
      if (!currentUser?.id) {
        console.error('❌ No authenticated user for refresh');
        setIsRefreshing(false);
        return;
      }

      console.log('🔄 Refreshing patient data for user:', currentUser.id);

      // Fetch Supabase patients
      const supabaseData = await getAllPatients();
      // Filter to show only patients with role='patient'
      const filteredSupabaseData = supabaseData.filter((patient: any) => patient.role === 'patient');
      const mappedSupabase: AppointmentType[] = filteredSupabaseData.map((patient: any) => ({
        id: patient.patient_id,
        name: patient.name || 'Unknown Patient',
        email: patient.email || '',
        service: patient.service || 'General',
        contact: patient.phone || '',
        time: '',
        date: patient.created_at,
        age: 0,
        gender: patient.gender || '',
        notes: '',
        imageUrl: require('../../assets/images/user.png'),
        status: 'scheduled' as const,
      }));
      setSupabasePatients(mappedSupabase);


    } catch (error) {
      console.error('Error refreshing patients:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* Header with Current User Name */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomColor: '#ddd', borderBottomWidth: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 25, fontWeight: 'bold', color: "#047857", marginBottom: 4 }}>
          Patient Records
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={isRefreshing}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <RefreshCw size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, borderBottomColor: '#ddd', borderBottomWidth: 1 }}>
        <TextInput
          style={{
            backgroundColor: '#fff',
            borderColor: '#10B981',
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
              backgroundColor: patientSortBy === 'name' ? '#10B981' : '#e0e0e0',
              borderWidth: 1,
              borderColor: patientSortBy === 'name' ? '#10B981' : '#ccc',
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
              backgroundColor: patientSortBy === 'date' ? '#10B981' : '#e0e0e0',
              borderWidth: 1,
              borderColor: patientSortBy === 'date' ? '#10B981' : '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: patientSortBy === 'date' ? '#fff' : '#333', fontWeight: '500' }}>Date Created</Text>
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
        {loadingSupabase ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 12, color: "#047857", fontSize: 14 }}>Loading patients...</Text>
          </View>
        ) : (
          <>
            {/* Patients List */}
            {supabasePatients.length > 0 ? (
              sortPatients(
                supabasePatients.filter((patient) =>
                  patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                  patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                  patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                  patient.contact.includes(quickSearchQuery)
                )
              ).map((patient) => (
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
                      <Text style={{ fontSize: 12, color: "#047857", fontWeight: '500' }}>Patient</Text>
                    </View>
                    <ChevronRight size={18} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                No patients found
              </Text>
            )}

            {/* No results matching search */}
            {quickSearchQuery &&
             supabasePatients.filter(p => p.name.toLowerCase().includes(quickSearchQuery.toLowerCase())).length === 0 && (
              <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                No patients found matching "{quickSearchQuery}"
              </Text>
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
