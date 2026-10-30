import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { AppColors } from "../../constants/theme";
import { User, Clock } from "lucide-react-native";
import { formatAppointmentTime } from "../../lib/dateFormatters";

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
        <Text style={styles.timeText}>{formatAppointmentTime(time)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6, // Sharp defined micro-radius matching patient-web skeuo-card
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHighlighted: {
    backgroundColor: "#F0FDF4",
    borderColor: "#10B981",
  },
  avatarContainer: {
    marginRight: 10,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 6, // Defined micro-radius for avatar
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 6,
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
    backgroundColor: "#D1FAE5",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#6EE7B7",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: 6,
  },
  priorityLabelText: {
    color: "#065F46",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
});
