import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppointmentCard from "./AppointmentCard";
import StatCard from "./StatCard";
import { CurrentUser } from "@smileguard/shared-types";

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

import { useState } from "react";

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  // Mock data - in production, fetch from API
  const appointments = [
    {
      id: "apt-1",
      name: "Mart Emman",
      service: "Whitening",
      time: "10:00",
      age: 28,
      gender: "Male",
      contact: "0917-123-4567",
      email: "mart.emman@email.com",
      notes: "Patient requests extra numbing gel. History of sensitivity.",
      imageUrl: "https://randomuser.me/api/portraits/men/1.jpg",
    },
    {
      id: "apt-2",
      name: "Jendri Jacin",
      service: "Aligners",
      time: "13:00",
      age: 34,
      gender: "Male",
      contact: "0918-234-5678",
      email: "jendri.jacin@email.com",
      notes: "First time for aligners. No allergies reported.",
      imageUrl: "https://randomuser.me/api/portraits/men/2.jpg",
    },
    {
      id: "apt-3",
      name: "Kyler Per",
      service: "Root Canals",
      time: "15:00",
      age: 41,
      gender: "Male",
      contact: "0919-345-6789",
      email: "kyler.per@email.com",
      notes: "Follow-up for root canal. Mild swelling last visit.",
      imageUrl: "https://randomuser.me/api/portraits/men/3.jpg",
    },
  ];

  const [selectedPatient, setSelectedPatient] = useState(appointments[0]);

  const handlePress = (apt: typeof appointments[0]) => {
    setSelectedPatient(apt);
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
                <Text style={styles.subHeader}>Today Appointments:</Text>

                {appointments.map((apt, idx) => (
                  <AppointmentCard
                    key={apt.id}
                    name={apt.name}
                    service={apt.service}
                    time={apt.time}
                    imageUrl={apt.imageUrl}
                    onPress={() => handlePress(apt)}
                    highlighted={idx === 0}
                  />
                ))}
              </View>

              {/* Right Column: Patient Details */}
              <View style={styles.column}>
                <Text style={styles.subHeader}>Patient Details:</Text>
                <View style={[styles.detailsCard, styles.shadow]}>
                  <Image
                    source={{ uri: selectedPatient.imageUrl }}
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

                <Text style={[styles.subHeader, { marginTop: 20 }]}>Requests:</Text>
                <View style={styles.card}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>MY</Text>
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Marie Yan</Text>
                    <Text style={styles.cardSubtitle}>Request: Cleaning</Text>
                  </View>
                  {/* Action Buttons */}
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#0b7fab" }]}
                      onPress={() => Alert.alert("Accepted", "Request from Marie Yan accepted.")}
                      accessibilityLabel="Accept request from Marie Yan"
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#6b7280" }]}
                      onPress={() => Alert.alert("Declined", "Request from Marie Yan declined.")}
                      accessibilityLabel="Decline request from Marie Yan"
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionBtnText}>✗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
});
