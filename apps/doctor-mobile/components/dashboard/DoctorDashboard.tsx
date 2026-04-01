import React, { useState } from "react";
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
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppointmentCard from "./AppointmentCard";
import StatCard from "./StatCard";
import AllAppointments from "../appointments/AllAppointments";
import { CurrentUser } from "@smileguard/shared-types";

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
};

const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString('en-CA'); 
  // en-CA gives YYYY-MM-DD in local time
};


export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  // Appointments state
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatient, setEditedPatient] = useState<AppointmentType | null>(null);
  const today = getToday();
  const [appointments, setAppointments] = useState<AppointmentType[]>([
    {
      id: "apt-1",
      name: "Mart Emman",
      service: "Whitening",
      time: "10:00",
      date: "2026-04-01",
      age: 28,
      gender: "Male",
      contact: "0917-123-4567",
      email: "mart.emman@email.com",
      notes: "Patient requests extra numbing gel. History of sensitivity.",
      imageUrl: require("../../assets/images/researchers/mart.jpg"),
    },
    {
      id: "apt-2",
      name: "Jendri Jacin",
      service: "Aligners",
      time: "13:00",
      date: "2026-04-02",
      age: 34,
      gender: "Male",
      contact: "0918-234-5678",
      email: "jendri.jacin@email.com",
      notes: "First time for aligners. No allergies reported.",
      imageUrl: require("../../assets/images/researchers/jendri.jpg"),
    },
    {
      id: "apt-3",
      name: "Kyler Per",
      service: "Root Canals",
      time: "15:00",
      date: "2026-03-30",
      age: 41,
      gender: "Male",
      contact: "0919-345-6789",
      email: "kyler.per@email.com",
      notes: "Follow-up for root canal. Mild swelling last visit.",
      imageUrl: require("../../assets/images/researchers/kyler.jpg"),
    },
  ]);

  // Requests state
  const [requests, setRequests] = useState<AppointmentType[]>([
    {
      id: "req-1",
      name: "Marie Yan",
      service: "Cleaning",
      time: "16:00",
      date: "2026-04-01",
      age: 25,
      gender: "Female",
      contact: "0917-555-1234",
      email: "marie.yan@email.com",
      notes: "Request for cleaning. No known allergies.",
      imageUrl: require("../../assets/images/researchers/mariel.jpg"),
      initials: "MY",
    },
    // Add more requests as needed
  ]);

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
    setEditedPatient({ ...selectedPatient });
    setIsEditingPatient(true);
  };

  const handleSavePatient = () => {
    if (editedPatient) {
      setAppointments((prev: AppointmentType[]) =>
        prev.map((apt) => (apt.id === editedPatient.id ? editedPatient : apt))
      );
      setSelectedPatient(editedPatient);
      setIsEditingPatient(false);
      Alert.alert("Success", "Patient information updated successfully.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditingPatient(false);
    setEditedPatient(null);
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

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <Text style={[styles.header, { marginBottom: 20 }]}>
              Welcome, {user.name}
            </Text>

            {/* Stats Panel */}
            <View style={styles.firstPanel}>
              <StatCard number={67} label="Patients" />
              <StatCard number={21} label="Appointments" />
              <StatCard number={911} label="Treatments" />
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
                  <TouchableOpacity onPress={() => setShowAllAppointments(true)}>
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
                <Modal
                  visible={showAllAppointments}
                  animationType="slide"
                  onRequestClose={() => setShowAllAppointments(false)}
                >
                  <View style={{ flex: 1, backgroundColor: '#f0f8ff' }}>
                    <AllAppointments appointments={appointments} />
                    <Button title="Close" onPress={() => setShowAllAppointments(false)} />
                  </View>
                </Modal>
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
                              style={styles.editInput}
                              value={editedPatient.name}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, name: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Service:</Text>
                            <TextInput
                              style={styles.editInput}
                              value={editedPatient.service}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, service: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Time:</Text>
                            <TextInput
                              style={styles.editInput}
                              value={editedPatient.time}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, time: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Age:</Text>
                            <TextInput
                              style={styles.editInput}
                              value={editedPatient.age.toString()}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, age: parseInt(text) || 0 })}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Gender:</Text>
                            <TextInput
                              style={styles.editInput}
                              value={editedPatient.gender}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, gender: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Contact:</Text>
                            <TextInput
                              style={styles.editInput}
                              value={editedPatient.contact}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, contact: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Email:</Text>
                            <TextInput
                              style={styles.editInput}
                              value={editedPatient.email}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, email: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Notes:</Text>
                            <TextInput
                              style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]}
                              value={editedPatient.notes}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, notes: text })}
                              multiline
                            />
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
        </ScrollView>
      </SafeAreaView>
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
