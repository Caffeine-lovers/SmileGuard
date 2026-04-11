import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  PanResponder,
  Animated,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Appointment } from "../../data/dashboardData";
import { getAllPatients } from "../../lib/profilesPatients";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { supabase } from "../../lib/supabase";
import AddPatient from "../patientrecord/AddPatient";
import AsyncStorage from '@react-native-async-storage/async-storage';

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

type AccountTab = 'all' | 'dummy' | 'existing';

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
  const [dummyPatients, setDummyPatients] = useState<AppointmentType[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);
  const [loadingDummy, setLoadingDummy] = useState(true);
  const [activeTab, setActiveTab] = useState<AccountTab>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [swipedDummyId, setSwipedDummyId] = useState<string | null>(null);
  const swipePositions = useRef<{ [key: string]: Animated.Value }>({});

  // Fetch profiles patients on initial load
  useEffect(() => {
    const fetchSupabasePatients = async () => {
      setLoadingSupabase(true);
      try {
        const data = await getAllPatients();
        console.log('RecordsTab - Received profiles patients:', data);
        
        const mapped: AppointmentType[] = data.map((patient) => ({
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
        
        console.log('RecordsTab - Mapped profiles patients:', mapped);
        setSupabasePatients(mapped);
      } catch (error) {
        console.error('Error fetching profiles patients:', error);
      } finally {
        setLoadingSupabase(false);
      }
    };

    fetchSupabasePatients();
  }, []);

  // Fetch dummy_accounts patients whenever screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const fetchDummyPatients = async () => {
        setLoadingDummy(true);
        try {
          // Check if a new patient was added
          const newPatientId = await AsyncStorage.getItem('newlyAddedPatientId');
          
          if (newPatientId && !showAddPatientModal) {
            console.log('📱 New patient detected in RecordsTab, ID:', newPatientId);
            await AsyncStorage.removeItem('newlyAddedPatientId');
          }

          const { data, error } = await supabase
            .from("dummy_accounts")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Error fetching dummy accounts:", error);
            return;
          }

          const mapped: AppointmentType[] = (data || []).map((patient) => ({
            id: patient.id,
            name: patient.patient_name || "Unknown Patient",
            email: patient.email || "",
            service: "General",
            contact: patient.phone || "",
            time: "",
            date: patient.created_at,
            age: 0,
            gender: patient.gender || "",
            notes: patient.notes || "",
            imageUrl: require("../../assets/images/user.png"),
            status: "scheduled" as const,
          }));

          console.log("RecordsTab - Dummy patients:", mapped);
          setDummyPatients(mapped);
        } catch (error) {
          console.error("Error in fetchDummyPatients:", error);
        } finally {
          setLoadingDummy(false);
        }
      };

      fetchDummyPatients();
    }, [showAddPatientModal])
  );

  // Refresh function to refetch both patient sources
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Fetch Supabase patients
      const supabaseData = await getAllPatients();
      const mappedSupabase: AppointmentType[] = supabaseData.map((patient) => ({
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

      // Fetch dummy patients
      const { data: dummyData, error } = await supabase
        .from("dummy_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && dummyData) {
        const mappedDummy: AppointmentType[] = dummyData.map((patient) => ({
          id: patient.id,
          name: patient.patient_name || "Unknown Patient",
          email: patient.email || "",
          service: "General",
          contact: patient.phone || "",
          time: "",
          date: patient.created_at,
          age: 0,
          gender: patient.gender || "",
          notes: patient.notes || "",
          imageUrl: require("../../assets/images/user.png"),
          status: "scheduled" as const,
        }));
        setDummyPatients(mappedDummy);
      }
    } catch (error) {
      console.error('Error refreshing patients:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
      {/* Header with Current User Name */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomColor: '#ddd', borderBottomWidth: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 25, fontWeight: 'bold', color: '#0b7fab', marginBottom: 4 }}>
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
              <Image
                source={require('../../assets/images/icon/refresh.png')}
                style={{ width: 25, height: 25}}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowAddPatientModal(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: '#0b7fab',
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>Add Patient</Text>
          </TouchableOpacity>
        </View>
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
        {/* Account Type Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === 'all' ? '#0b7fab' : '#e0e0e0',
              borderWidth: 1,
              borderColor: activeTab === 'all' ? '#0b7fab' : '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: activeTab === 'all' ? '#fff' : '#333', fontWeight: '600' }}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('dummy')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === 'dummy' ? '#4CAF50' : '#e0e0e0',
              borderWidth: 1,
              borderColor: activeTab === 'dummy' ? '#4CAF50' : '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: activeTab === 'dummy' ? '#fff' : '#333', fontWeight: '600' }}>Dummy Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('existing')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: activeTab === 'existing' ? '#0b7fab' : '#e0e0e0',
              borderWidth: 1,
              borderColor: activeTab === 'existing' ? '#0b7fab' : '#ccc',
            }}
          >
            <Text style={{ fontSize: 12, color: activeTab === 'existing' ? '#fff' : '#333', fontWeight: '600' }}>Existing Profile</Text>
          </TouchableOpacity>
        </View>
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
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {loadingDummy && loadingSupabase ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#0b7fab" />
            <Text style={{ marginTop: 12, color: '#0b7fab', fontSize: 14 }}>Loading patients...</Text>
          </View>
        ) : (
          <>
            {/* Dummy Accounts Section - Show on "All" and "Dummy" tabs */}
            {(activeTab === 'all' || activeTab === 'dummy') && !loadingDummy && dummyPatients.length > 0 && (
              <>
                {activeTab === 'all' && (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0b7fab', marginBottom: 12, marginTop: 8 }}>
                    Dummy Accounts
                  </Text>
                )}
                {sortPatients(
                  dummyPatients.filter((patient) =>
                    patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    patient.contact.includes(quickSearchQuery)
                  )
                ).map((patient) => (
                  <TouchableOpacity
                    key={patient.id}
                    style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12, borderLeftColor: '#4CAF50', borderLeftWidth: 3 }]}
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
                        <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: '500' }}>Dummy Account</Text>
                      </View>
                      <Image
                        source={require('../../assets/images/icon/open.png')}
                        style={{ width: 18, height: 18, resizeMode: 'contain' }}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Profiles Patients Section - Show on "All" and "Existing" tabs */}
            {(activeTab === 'all' || activeTab === 'existing') && !loadingSupabase && supabasePatients.length > 0 && (
              <>
                {activeTab === 'all' && (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0b7fab', marginBottom: 12, marginTop: 16 }}>
                    Existing Patients
                  </Text>
                )}
                {sortPatients(
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
                        <Text style={{ fontSize: 12, color: '#0b7fab', fontWeight: '500' }}>Patient</Text>
                      </View>
                      <Image
                        source={require('../../assets/images/icon/open.png')}
                        style={{ width: 18, height: 18, resizeMode: 'contain' }}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* No patients message */}
            {!loadingDummy && !loadingSupabase && 
             ((activeTab === 'dummy' && dummyPatients.length === 0) ||
              (activeTab === 'existing' && supabasePatients.length === 0) ||
              (activeTab === 'all' && dummyPatients.length === 0 && supabasePatients.length === 0)) && (
              <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                No patients found
              </Text>
            )}

            {/* No results matching search */}
            {!loadingDummy && !loadingSupabase && quickSearchQuery && (
              <>
                {activeTab === 'all' && 
                 dummyPatients.filter(p => p.name.toLowerCase().includes(quickSearchQuery.toLowerCase())).length === 0 &&
                 supabasePatients.filter(p => p.name.toLowerCase().includes(quickSearchQuery.toLowerCase())).length === 0 && (
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                    No patients found matching "{quickSearchQuery}"
                  </Text>
                )}
                {activeTab === 'dummy' && 
                 dummyPatients.filter(p => p.name.toLowerCase().includes(quickSearchQuery.toLowerCase())).length === 0 && (
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                    No dummy accounts found matching "{quickSearchQuery}"
                  </Text>
                )}
                {activeTab === 'existing' && 
                 supabasePatients.filter(p => p.name.toLowerCase().includes(quickSearchQuery.toLowerCase())).length === 0 && (
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                    No existing patients found matching "{quickSearchQuery}"
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Add Patient Modal */}
      {showAddPatientModal && (
        <Modal visible={showAddPatientModal} transparent={false} animationType="slide">
          <AddPatient 
            onPatientAdded={(patientId) => {
              if (patientId === '') {
                // User cancelled
                console.log('❌ Add patient cancelled');
                setShowAddPatientModal(false);
              } else {
                // Patient was successfully added
                console.log('👤 Patient added successfully:', patientId);
                setShowAddPatientModal(false);
                // The useFocusEffect hook will detect and refresh the dummy patients list
              }
            }}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}
