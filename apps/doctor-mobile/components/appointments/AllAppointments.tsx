import React from "react";
import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import { AppointmentType } from "../dashboard/DoctorDashboard";

interface AllAppointmentsProps {
  appointments: AppointmentType[];
}

const AllAppointments: React.FC<AllAppointmentsProps> = ({ appointments }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>All Appointments</Text>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.icon} />
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.detail}>Service: {item.service}</Text>
              <Text style={styles.detail}>Time: {item.time}</Text>
              <Text style={styles.detail}>Contact: {item.contact}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No appointments found.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f8ff",
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0b7fab",
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  detail: {
    fontSize: 12,
    color: "#555",
  },
  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
  },
});

export default AllAppointments;
