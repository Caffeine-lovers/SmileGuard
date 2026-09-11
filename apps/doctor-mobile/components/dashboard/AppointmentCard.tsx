import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { AppColors } from "../../constants/theme";
import { User, Clock } from "lucide-react-native";

interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  imageUrl?: string | number;
  onPress: () => void;
  highlighted?: boolean;
}

export default function AppointmentCard({
  name,
  service,
  time,
  imageUrl,
  onPress,
  highlighted = false,
}: AppointmentCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[
        styles.card,
        highlighted && styles.cardHighlighted,
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        {imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http") ? (
          <Image source={{ uri: imageUrl }} style={styles.icon} />
        ) : (
          <View style={styles.avatarFallback}>
            <User size={18} color={AppColors.primary} />
          </View>
        )}
      </View>
      <View style={styles.cardText}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>{name}</Text>
          {highlighted && (
            <View style={styles.priorityLabel}>
              <Text style={styles.priorityLabelText}>UPCOMING</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardSubtitle}>{service}</Text>
      </View>
      <View style={styles.timeBadge}>
        <Clock size={12} color={AppColors.primaryDark} style={{ marginRight: 4 }} />
        <Text style={styles.timeText}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHighlighted: {
    backgroundColor: "#F0FDF4",
    borderColor: "#A7F3D0",
    borderWidth: 1.5,
  },
  avatarContainer: {
    marginRight: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  cardText: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: "#0F172A",
    flexShrink: 1,
  },
  priorityLabel: {
    backgroundColor: "#ECFDF5",
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  priorityLabelText: {
    color: "#047857",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
});
