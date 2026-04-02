import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Button,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppointmentCard from "./AppointmentCard";
import StatCard from "./StatCard";
import PatientDetailsView from "../patientrecord/PatientDetailsView";
import RecordsTab from "./RecordsTab";
import AppointmentsTab from "./AppointmentsTab";
import { CurrentUser } from "@smileguard/shared-types";
import {
  getDoctorAppointments,
  getTodayAppointments,
  getPatientInfo,
  updateDoctorAppointmentStatus,
  getDoctorStats,
} from "../../lib/appointmentService";

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

export type AppointmentType = {
  id: string;
  name: string;
  service: string;
  time: string;
  date: string; // YYYY-MM-DD
  age: number;
  gender: string;
  contact: string;
  email: string;
  notes: string;
  imageUrl: string | number; // string for URI, number for require()
  initials?: string;
  status?: 'scheduled' | 'arrived' | 'finished'; // Appointment status
};

const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString('en-CA'); 
  // en-CA gives YYYY-MM-DD in local time
};

const SERVICE_OPTIONS = ['Cleaning', 'Whitening', 'Fillings', 'Root Canal', 'Extraction', 'Braces Consultation', 'Implants Consultation', 'X-Ray', 'Check-Up'];

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  // Appointments state
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatient, setEditedPatient] = useState<AppointmentType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ totalPatients: 0, totalAppointments: 0, upcomingAppointments: 0, completedAppointments: 0 });
  
  const today = getToday();
  const [appointments, setAppointments] = useState<AppointmentType[]>([]);
  const [requests, setRequests] = useState<AppointmentType[]>([]);

  // Fetch appointments from Supabase on component mount
  useEffect(() => {
    fetchAppointments();
  }, [user?.id]);

  const fetchAppointments = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      
      // Get doctor's appointments
      const [doctorApts, doctorStats] = await Promise.all([
        getDoctorAppointments(user.id),
        getDoctorStats(user.id),
      ]);

      setStats(doctorStats);

      // Transform appointments to match AppointmentType format
      const transformedApts = await Promise.all(
        doctorApts.map(async (apt) => {
          const patient = await getPatientInfo(apt.patient_id);

          return {
            id: apt.id,
            name: patient?.name || 'Unknown Patient',
            service: apt.service,
            time: apt.appointment_time,
            date: apt.appointment_date,
            age: 0, // Age not available in profiles table
            gender: patient?.role || 'Not specified',
            contact: patient?.email || '',
            email: patient?.email || '',
            notes: apt.notes || '',
            imageUrl: 'https://via.placeholder.com/60', // Placeholder since we don't have image URLs
            status: (apt.status as 'scheduled' | 'arrived' | 'finished') || 'scheduled',
          };
        })
      );

      setAppointments(transformedApts);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      Alert.alert('Error', 'Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const todayAppointments = appointments.filter(apt => apt.date === today);

  // If there are appointments today, pick the first one, otherwise fallback
  const [selectedPatient, setSelectedPatient] = useState<AppointmentType>(
    todayAppointments.length > 0 ? todayAppointments[0] : appointments[0]
  );


  const handlePress = (apt: AppointmentType) => {
    setSelectedPatient(apt);
  };

  // Accept request: add to appointments, remove from requests
  const handleAcceptRequest = (req: AppointmentType) => {
    setAppointments((prev: AppointmentType[]) => [...prev, { ...req, id: `apt-${Date.now()}` }]);
    setRequests((prev: AppointmentType[]) => prev.filter((r) => r.id !== req.id));
  };

  // Decline request: remove from requests
  const handleDeclineRequest = (req: AppointmentType) => {
    setRequests((prev: AppointmentType[]) => prev.filter((r) => r.id !== req.id));
  };

  const handleEditPatient = () => {
    setOriginalPatient({ ...selectedPatient });
    setEditedPatient({ ...selectedPatient });
    setIsEditingPatient(true);
  };

  const isFieldChanged = (fieldName: keyof AppointmentType): boolean => {
    if (!originalPatient || !editedPatient) return false;
    return originalPatient[fieldName] !== editedPatient[fieldName];
  };

  const sortPatients = (patientsToSort: AppointmentType[]): AppointmentType[] => {
    const sorted = [...patientsToSort];
    if (patientSortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (patientSortBy === 'date') {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (patientSortBy === 'service') {
      sorted.sort((a, b) => a.service.localeCompare(b.service));
    }
    
    if (patientSortOrder === 'desc') {
      sorted.reverse();
    }
    return sorted;
  };

  const handleSavePatient = () => {
    if (editedPatient) {
      // Update patients list
      setPatients((prev: AppointmentType[]) =>
        prev.map((p) => (p.id === editedPatient.id ? editedPatient : p))
      );
      
      // Check if status was changed to non-scheduled and it's for today
      // Remove from dashboard if status is not 'scheduled' (i.e., completed, cancelled, no-show)
      if (editedPatient.status !== 'scheduled' && editedPatient.date === today) {
        // Remove the appointment from the list
        const updatedAppointments = appointments.filter(apt => apt.id !== editedPatient.id);
        setAppointments(updatedAppointments);
        
        // Update selected patient to the next available
        const remainingTodayAppointments = updatedAppointments.filter(apt => apt.date === today);
        if (remainingTodayAppointments.length > 0) {
          setSelectedPatient(remainingTodayAppointments[0]);
        } else {
          setSelectedPatient(updatedAppointments.length > 0 ? updatedAppointments[0] : selectedPatient);
        }
      } else {
        // Otherwise, just update the appointment
        setAppointments((prev: AppointmentType[]) =>
          prev.map((apt) => (apt.id === editedPatient.id ? editedPatient : apt))
        );
        setSelectedPatient(editedPatient);
      }
      
      setIsEditingPatient(false);
      setEditedPatient(null);
      setOriginalPatient(null);
      Alert.alert("Success", "Patient information updated successfully.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditingPatient(false);
    setEditedPatient(null);
    setOriginalPatient(null);
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, status: 'scheduled' | 'arrived' | 'finished') => {
    // Update local state immediately for UX
    setAppointments((prev: AppointmentType[]) =>
      prev.map((apt) => (apt.id === appointmentId ? { ...apt, status } : apt))
    );

    // Update in Supabase
    const result = await updateDoctorAppointmentStatus(appointmentId, status);
    if (!result.success) {
      Alert.alert('Error', result.message);
      // Revert local state on error
      await fetchAppointments();
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>🦷 SmileGuard MD</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onLogout}
            accessibilityLabel="Logout"
            accessibilityRole="button"
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        {activeTab === 'dashboard' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#0b7fab" />
              <Text style={{ marginTop: 10, color: '#0b7fab' }}>Loading appointments...</Text>
            </View>
          ) : (
          <View style={styles.container}>
            <Text style={[styles.header, { marginBottom: 20 }]}>
              Welcome, {user.name}
            </Text>

            {/* Stats Panel */}
            <View style={styles.firstPanel}>
              <StatCard number={stats.totalPatients} label="Patients" />
              <StatCard number={stats.totalAppointments} label="Appointments" />
              <StatCard number={stats.completedAppointments} label="Completed" />
            </View>

            {/* Quick Actions Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.header}>Quick Actions</Text>
            </View>

            {/* Dashboard Columns */}
            <View style={styles.dashboardColumns}>
              {/* Left Column: Appointments */}
              <View style={styles.column}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.subHeader}>Today Appointments:</Text>
                  <TouchableOpacity onPress={() => setActiveTab('appointments')}>
                    <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>See more</Text>
                  </TouchableOpacity>
                </View>
                {todayAppointments.length === 0 ? (
                  <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, minHeight: 100 }}>
                    <Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}>No appointments scheduled for today</Text>
                  </View>
                ) : (
                  todayAppointments.map((apt, idx) => (
                      <AppointmentCard
                        key={apt.id}
                        name={apt.name}
                        service={apt.service}
                        time={apt.time}
                        imageUrl={apt.imageUrl}
                        onPress={() => handlePress(apt)}
                        highlighted={idx === 0}
                      />
                  ))
                )}
                </View>

              {/* Right Column: Patient Details */}
              <View style={styles.column}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.subHeader}>Patient Details:</Text>
                  {todayAppointments.length > 0 && (
                    <TouchableOpacity onPress={handleEditPatient}>
                      <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {todayAppointments.length === 0 ? (
                  <View style={[styles.detailsCard, styles.shadow, { alignItems: 'center', justifyContent: 'center', minHeight: 150 }]}>
                    <Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}>Select an appointment to view patient details</Text>
                  </View>
                ) : (
                  <View style={[styles.detailsCard, styles.shadow]}>
                    <Image
                      source={typeof selectedPatient.imageUrl === "string" ? { uri: selectedPatient.imageUrl } : selectedPatient.imageUrl}
                      style={{ width: 60, height: 60, borderRadius: 30, marginBottom: 10 }}
                    />
                    <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 4 }}>
                      {selectedPatient.name}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Service:</Text> {selectedPatient.service}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Time:</Text> {selectedPatient.time}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Age:</Text> {selectedPatient.age}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Gender:</Text> {selectedPatient.gender}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Contact:</Text> {selectedPatient.contact}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Email:</Text> {selectedPatient.email}
                    </Text>
                    <Text style={{ color: "#555", marginTop: 6 }}>
                      <Text style={{ fontWeight: "bold" }}>Notes:</Text> {selectedPatient.notes}
                    </Text>
                    <View style={{ marginTop: 12, alignItems: 'center' }}>
                      <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Appointment Status:</Text>
                      <View style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: getStatusBgColor(selectedPatient.status || 'scheduled')
                      }}>
                        <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 12 }}>
                          {(selectedPatient.status || 'scheduled').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Edit Patient Modal */}
                <Modal
                  visible={isEditingPatient}
                  animationType="slide"
                  onRequestClose={handleCancelEdit}
                >
                  <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
                    <ScrollView style={{ padding: 20, paddingTop: 10 }} contentContainerStyle={{ paddingBottom: 20 }}>
                      <Text style={styles.editHeader}>Edit Patient Information</Text>
                      {editedPatient && (
                        <View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Name:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('name') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.name}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, name: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Service:</Text>
                            <TouchableOpacity
                              style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: isFieldChanged('service') ? '#fffacd' : '#fff' }]}
                              onPress={() => setShowServiceDropdown(!showServiceDropdown)}
                            >
                              <Text style={{ color: editedPatient.service ? '#000' : '#999' }}>
                                {editedPatient.service || 'Select a service'}
                              </Text>
                            </TouchableOpacity>
                            {showServiceDropdown && (
                              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#d0d0d0' }}>
                                <ScrollView
                                  style={{ maxHeight: 150 }}
                                  nestedScrollEnabled={true}>
                                  {SERVICE_OPTIONS.map((service) => (
                                    <TouchableOpacity
                                      key={service}
                                      onPress={() => {
                                        setEditedPatient({ ...editedPatient, service });
                                        setShowServiceDropdown(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#e0e0e0',
                                        backgroundColor: editedPatient.service === service ? '#e3f2fd' : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: editedPatient.service === service ? '#1976d2' : '#333' }}>
                                        {service}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Time:</Text>
                            <TouchableOpacity
                              style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: isFieldChanged('time') ? '#fffacd' : '#fff' }]}
                              onPress={() => setShowTimeDropdown(!showTimeDropdown)}
                            >
                              <Text style={{ color: editedPatient.time ? '#000' : '#999' }}>
                                {editedPatient.time || 'Select a time'}
                              </Text>
                            </TouchableOpacity>
                            {showTimeDropdown && (
                              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#d0d0d0' }}>
                                <ScrollView
                                  style={{ maxHeight: 150 }}
                                  nestedScrollEnabled={true}>
                                  {TIME_OPTIONS.map((time) => (
                                    <TouchableOpacity
                                      key={time}
                                      onPress={() => {
                                        setEditedPatient({ ...editedPatient, time });
                                        setShowTimeDropdown(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#e0e0e0',
                                        backgroundColor: editedPatient.time === time ? '#e3f2fd' : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: editedPatient.time === time ? '#1976d2' : '#333' }}>
                                        {time}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Age:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('age') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.age.toString()}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, age: parseInt(text) || 0 })}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Gender:</Text>
                            <TouchableOpacity
                              style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: isFieldChanged('gender') ? '#fffacd' : '#fff' }]}
                              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
                            >
                              <Text style={{ color: editedPatient.gender ? '#000' : '#999' }}>
                                {editedPatient.gender || 'Select a gender'}
                              </Text>
                            </TouchableOpacity>
                            {showGenderDropdown && (
                              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#d0d0d0' }}>
                                <ScrollView
                                  style={{ maxHeight: 150 }}
                                  nestedScrollEnabled={true}>
                                  {GENDER_OPTIONS.map((gender) => (
                                    <TouchableOpacity
                                      key={gender}
                                      onPress={() => {
                                        setEditedPatient({ ...editedPatient, gender });
                                        setShowGenderDropdown(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#e0e0e0',
                                        backgroundColor: editedPatient.gender === gender ? '#e3f2fd' : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: editedPatient.gender === gender ? '#1976d2' : '#333' }}>
                                        {gender}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Contact:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('contact') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.contact}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, contact: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Email:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('email') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.email}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, email: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Notes:</Text>
                            <TextInput
                              style={[styles.editInput, { height: 80, textAlignVertical: 'top', backgroundColor: isFieldChanged('notes') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.notes}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, notes: text })}
                              multiline
                            />
                          </View>

                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Appointment Status:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              {(['scheduled', 'completed', 'cancelled', 'no-show'] as const).map((st) => (
                                <TouchableOpacity
                                  key={st}
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: editedPatient.status === st ? getStatusBgColor(st) : '#e0e0e0',
                                    borderWidth: (editedPatient.status === st && isFieldChanged('status')) ? 3 : editedPatient.status === st ? 2 : 0,
                                    borderColor: (editedPatient.status === st && isFieldChanged('status')) ? '#FFD700' : editedPatient.status === st ? '#0b7fab' : 'transparent'
                                  }}
                                  onPress={() => setEditedPatient({ ...editedPatient, status: st })}
                                >
                                  <Text style={{
                                    fontWeight: 'bold',
                                    color: editedPatient.status === st ? '#fff' : '#333',
                                    fontSize: 12
                                  }}>
                                    {st.toUpperCase()}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          <View style={styles.editButtonContainer}>
                            <TouchableOpacity style={[styles.editButton, styles.editButtonSave]} onPress={handleSavePatient}>
                              <Text style={styles.editButtonText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.editButton, styles.editButtonCancel]} onPress={handleCancelEdit}>
                              <Text style={[styles.editButtonText, styles.editButtonCancelText]}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </ScrollView>
                  </SafeAreaView>
                </Modal>

                <Text style={[styles.subHeader, { marginTop: 20 }]}> Appointment Requests:</Text>
                {requests.length === 0 && (
                  <Text style={{ color: '#888', textAlign: 'center', marginVertical: 10 }}>No pending requests.</Text>
                )}
                {requests.map((req) => (
                  <View style={styles.card} key={req.id}>
                    <View style={styles.avatar}>
                      <Image
                        source={typeof req.imageUrl === "string" ? { uri: req.imageUrl } : req.imageUrl}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{req.name}</Text>
                      <Text style={styles.cardSubtitle}>Service: {req.service}</Text>
                      <Text style={styles.cardDate}>
                        Appointment Date: {new Date(req.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                    {/* Action Buttons */}
                    <View style={{ flexDirection: "row", gap: 5 }}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#0b7fab" }]}
                        onPress={() => {
                          Alert.alert(
                            "Accept Request",
                            `Are you sure you want to accept the appointment request from ${req.name}?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Accept", style: "default", onPress: () => handleAcceptRequest(req) },
                            ]
                          );
                        }}
                        accessibilityLabel={`Accept request from ${req.name}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#6b7280" }]}
                        onPress={() => {
                          Alert.alert(
                            "Decline Request",
                            `Are you sure you want to decline the appointment request from ${req.name}?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Decline", style: "destructive", onPress: () => handleDeclineRequest(req) },
                            ]
                          );
                        }}
                        accessibilityLabel={`Decline request from ${req.name}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionBtnText}>✗</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
          )}
        </ScrollView>
        ) : activeTab === 'records' ? (
        // Records Tab Content
        <RecordsTab
          patients={patients}
          quickSearchQuery={quickSearchQuery}
          setQuickSearchQuery={setQuickSearchQuery}
          patientSortBy={patientSortBy}
          setPatientSortBy={setPatientSortBy}
          patientSortOrder={patientSortOrder}
          setPatientSortOrder={setPatientSortOrder}
          sortPatients={sortPatients}
          setViewingPatient={setViewingPatient}
          setShowPatientDetails={setShowPatientDetails}
          styles={styles}
        />
        ) : (
        // Appointments Tab Content
        <AppointmentsTab
          appointments={appointments}
          onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
          styles={styles}
        />
        )}
      </SafeAreaView>

      {/* Patient Details Modal */}
      <PatientDetailsView
        visible={showPatientDetails}
        patient={viewingPatient}
        onClose={() => {
          setShowPatientDetails(false);
          setViewingPatient(null);
        }}
        onEdit={() => {
          if (viewingPatient) {
            setOriginalPatient({ ...viewingPatient });
            setEditedPatient({ ...viewingPatient });
            setIsEditingPatient(true);
          }
        }}
      />

      {/* Quick Patient Search Modal */}
      <Modal
        visible={showQuickPatientSearch}
        animationType="slide"
        onRequestClose={() => {
          setShowQuickPatientSearch(false);
          setQuickSearchQuery("");
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#ddd', borderBottomWidth: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0b7fab' }}>Search Patient Records</Text>
            <TouchableOpacity onPress={() => {
              setShowQuickPatientSearch(false);
              setQuickSearchQuery("");
            }}>
              <Text style={{ fontSize: 24, color: '#0b7fab', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
              }}
              placeholder="Search by name, service, email, contact..."
              placeholderTextColor="#999"
              value={quickSearchQuery}
              onChangeText={setQuickSearchQuery}
            />
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {patients
              .filter((patient) =>
                patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                patient.contact.includes(quickSearchQuery)
              )
              .length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                {quickSearchQuery ? `No patients found matching "${quickSearchQuery}"` : 'Enter a search query to find patients'}
              </Text>
            ) : (
              patients
                .filter((patient) =>
                  patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                  patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                  patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                  patient.contact.includes(quickSearchQuery)
                )
                .map((patient) => (
                  <TouchableOpacity
                    key={patient.id}
                    style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12 }]}
                    onPress={() => {
                      setViewingPatient(patient);
                      setShowPatientDetails(true);
                      setShowQuickPatientSearch(false);
                      setQuickSearchQuery("");
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Image
                        source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
                        style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 2 }}>{patient.name}</Text>
                        <Text style={{ fontSize: 12, color: '#666' }}>{patient.service} • {patient.contact}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
                    </View>
                  </TouchableOpacity>
                ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => {
            setActiveTab('dashboard');
            setQuickSearchQuery("");
          }}
        >
          <Text style={[styles.tabIcon, activeTab === 'dashboard' && styles.tabIconActive]}>🏠</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'records' && styles.tabItemActive]}
          onPress={() => setActiveTab('records')}
        >
          <Text style={[styles.tabIcon, activeTab === 'records' && styles.tabIconActive]}>📋</Text>
          <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>Records</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'appointments' && styles.tabItemActive]}
          onPress={() => setActiveTab('appointments')}
        >
          <Text style={[styles.tabIcon, activeTab === 'appointments' && styles.tabIconActive]}>📅</Text>
          <Text style={[styles.tabLabel, activeTab === 'appointments' && styles.tabLabelActive]}>Appointments</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 60,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  topBarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  logoutBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 0,
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabItemActive: {
    borderTopWidth: 3,
    borderTopColor: '#0b7fab',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabIconActive: {
    fontSize: 24,
  },
  tabLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#0b7fab',
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0b7fab",
    textAlign: "center",
  },
  subHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  sectionHeader: {
    width: "100%",
    marginTop: 30,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 10,
  },

  // Stats Panel
  firstPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
    flexWrap: "wrap",
  },

  // Dashboard Columns
  dashboardColumns: {
    flexDirection: "row",
    width: "100%",
    flexWrap: "wrap",
    gap: 20,
  },
  column: {
    flex: 1,
    minWidth: 300,
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    minHeight: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#777",
  },
  cardDate: {
    fontSize: 12,
    color: "#555",
    fontWeight: "bold",
    marginTop: 4,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0b7fab",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  editContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  editModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  editHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  editField: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#555",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
  },
  editButtonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    paddingBottom: 20,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  editButtonSave: {
    backgroundColor: "#0b7fab",
  },
  editButtonCancel: {
    backgroundColor: "#ddd",
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  editButtonCancelText: {
    color: "#333",
  },
});
