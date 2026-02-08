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
import { CurrentUser } from "../../types";

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  const handlePress = (name: string) => {
    Alert.alert("Patient Details", `You pressed on ${name}'s profile.`);
  };

  // Mock data - in production, fetch from API
  const appointments = [
    { name: "Mart Emman", service: "Whitening", time: "10:00" },
    { name: "Jendri Jacin", service: "Aligners", time: "13:00" },
    { name: "Kyler Per", service: "Root Canals", time: "15:00" },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f7fb" }}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>SmileGuard MD</Text>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Text style={{ color: "white", fontWeight: "bold" }}>Logout</Text>
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

                {appointments.map((apt, index) => (
                  <AppointmentCard
                    key={index}
                    name={apt.name}
                    service={apt.service}
                    time={apt.time}
                    onPress={() => handlePress(apt.name)}
                  />
                ))}
              </View>

              {/* Right Column: Details / Requests */}
              <View style={styles.column}>
                <Text style={styles.subHeader}>Next Patient Details:</Text>
                <View style={[styles.detailsCard, styles.shadow]}>
                  <Text style={{ textAlign: "center", color: "#555" }}>
                    <Text style={{ fontWeight: "bold" }}>Patient Name:</Text> Mart
                    Emman{"\n\n"}
                    <Text style={{ fontWeight: "bold" }}>Notes:</Text> Patient
                    requests extra numbing gel. History of sensitivity.
                  </Text>
                </View>

                <Text style={[styles.subHeader, { marginTop: 20 }]}>Requests:</Text>
                <View style={styles.card}>
                  <Image
                    source={{ uri: "https://via.placeholder.com/40" }}
                    style={styles.icon}
                  />
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Marie Yan</Text>
                    <Text style={styles.cardSubtitle}>Request: Cleaning</Text>
                  </View>
                  {/* Action Buttons */}
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    <View
                      style={[styles.actionBtn, { backgroundColor: "#4ade80" }]}
                    />
                    <View
                      style={[styles.actionBtn, { backgroundColor: "#f87171" }]}
                    />
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#0b7fab",
    textAlign: "center",
  },
  subHeader: {
    fontSize: 16,
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
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
});
