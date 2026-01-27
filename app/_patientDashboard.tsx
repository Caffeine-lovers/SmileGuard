import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DashboardProps {
  user: { name: string };
  onLogout: () => void;
}

export default function PatientDashboard({ user, onLogout }: DashboardProps) {
  const appointments = [
    { id: "1", service: "Checkup", date: "Oct 25, 2025", status: "Pending" },
    { id: "2", service: "Cleaning", date: "Aug 12, 2024", status: "Completed" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome Back,</Text>
          <Text style={styles.userName}>{user.name}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.highlightCard}>
          <Text style={styles.cardLabel}>Upcoming Appointment</Text>
          <Text style={styles.cardMain}>Tomorrow at 10:00 AM</Text>
          <Text style={styles.cardSub}>General Dental Checkup</Text>
        </View>

        <Text style={styles.sectionTitle}>Your Activity</Text>
        {appointments.map((item) => (
          <View key={item.id} style={styles.aptRow}>
            <View>
              <Text style={styles.aptService}>{item.service}</Text>
              <Text style={styles.aptDate}>{item.date}</Text>
            </View>
            <View
              style={[
                styles.badge,
                item.status === "Completed"
                  ? styles.bgSuccess
                  : styles.bgPending,
              ]}
            >
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  welcome: { fontSize: 14, color: "#6b7280" },
  userName: { fontSize: 22, fontWeight: "bold" },
  logoutBtn: { padding: 8 },
  logoutText: { color: "#ef4444", fontWeight: "bold" },
  content: { padding: 20 },
  highlightCard: {
    backgroundColor: "#0b7fab",
    padding: 25,
    borderRadius: 20,
    marginBottom: 30,
  },
  cardLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 5 },
  cardMain: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  cardSub: { color: "#fff", fontSize: 14, marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  aptRow: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  aptService: { fontSize: 16, fontWeight: "600" },
  aptDate: { fontSize: 13, color: "#6b7280" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  bgSuccess: { backgroundColor: "#dcfce7" },
  bgPending: { backgroundColor: "#fef9c3" },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0b7fab",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 30 },
});
