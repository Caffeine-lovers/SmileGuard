import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";

interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  imageUrl?: string;
  onPress: () => void;
  highlighted?: boolean;
}

export default function AppointmentCard({
  name,
  service,
  time,
  imageUrl = "https://via.placeholder.com/40",
  onPress,
  highlighted = false,
}: AppointmentCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, highlighted && { backgroundColor: '#ffcccc', borderColor: '#ff0000', borderWidth: 2 }]}
      onPress={onPress}
    >
      <Image source={{ uri: imageUrl }} style={styles.icon} />
      <View style={styles.cardText}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.cardTitle}>{name}</Text>
          {highlighted && (
            <View style={styles.priorityLabel}>
              <Text style={styles.priorityLabelText}>Upcoming Patient</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtitle}>{service}</Text>
      </View>
      <Text style={styles.timeText}>{time}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  cardText: {
    flex: 1,
    marginLeft: 10,
  },
  priorityLabel: {
    backgroundColor: '#ff0000',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  priorityLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
  timeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
});
