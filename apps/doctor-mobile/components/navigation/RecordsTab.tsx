import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Appointment } from "../../data/dashboardData";
import * as dashboardService from "../../lib/dashboardService";
import { getPatientProfilePictureUrl } from "../../lib/profilesPatients";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { supabase } from "@smileguard/supabase-client";

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
  const [profilePictureUrls, setProfilePictureUrls] = useState<{ [key: string]: string | null }>({});

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

        // Fetch profile pictures for all supabase patients in parallel
        const pictureUrls: { [key: string]: string | null } = {};
        const profilePicturePromises = mapped.map(async (patient) => {
          const url = await getPatientProfilePictureUrl(patient.id);
          pictureUrls[patient.id] = url;
        });
        await Promise.all(profilePicturePromises);
        setProfilePictureUrls((prev) => ({ ...prev, ...pictureUrls }));
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

  // Initialize empty dummy patients since dummy accounts are no longer supported

  // Refresh function to refetch patient data
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
      const result = await dashboardService.fetchDoctorPatients(currentUser.id);
      const mappedSupabase: AppointmentType[] = (result.data || []).map((patient: any) => ({
        id: patient.id,
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

      // Fetch profile pictures for supabase patients
      const supabasePictureUrls: { [key: string]: string | null } = {};
      const supabaseProfilePicturePromises = mappedSupabase.map(async (patient) => {
        const url = await getPatientProfilePictureUrl(patient.id);
        supabasePictureUrls[patient.id] = url;
      });
      await Promise.all(supabaseProfilePicturePromises);
      setProfilePictureUrls((prev) => ({ ...prev, ...supabasePictureUrls }));
    } catch (error) {
      console.error('Error refreshing patients:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  return (
    // @ts-expect-error - React 19 JSX type compatibility
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
      {/* Header with Current User Name */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomColor: '#ddd', borderBottomWidth: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 25, fontWeight: 'bold', color: '#0b7fab', marginBottom: 4 }}>
          Patient Records
        </Text>
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
            <ActivityIndicator size="small" color="#0b7fab" />
          ) : (
            <Image
              source={require('../../assets/images/icon/refresh.png')}
              style={{ width: 25, height: 25}}
            />
          )}
        </TouchableOpacity>
      </View>
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
      {/* @ts-expect-error - React 19 JSX type compatibility */}
      <ScrollView   
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16}}
      >
        {loadingSupabase ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#0b7fab" />
            <Text style={{ marginTop: 12, color: '#0b7fab', fontSize: 14 }}>Loading patients...</Text>
          </View>
        ) : supabasePatients.length > 0 ? (
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
                  source={
                    profilePictureUrls[patient.id] && typeof profilePictureUrls[patient.id] === 'string'
                      ? { uri: profilePictureUrls[patient.id] as string }
                      : typeof patient.imageUrl === "string"
                      ? { uri: patient.imageUrl }
                      : patient.imageUrl
                  }
                  style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 2 }}>{patient.name}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>{patient.email}</Text>
                  <Text style={{ fontSize: 12, color: '#0b7fab', fontWeight: '500' }}>{patient.service || 'Patient'}</Text>
                </View>
                <Image
                  source={require('../../assets/images/icon/open.png')}
                  style={{ width: 18, height: 18, resizeMode: 'contain' }}
                />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
            {quickSearchQuery ? `No patients found matching "${quickSearchQuery}"` : 'No patients found'}
          </Text>
        )}
      </ScrollView>


    </SafeAreaView>
  );
}
