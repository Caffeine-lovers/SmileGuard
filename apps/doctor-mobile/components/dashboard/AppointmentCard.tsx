import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";

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
  imageUrl = "https://via.placeholder.com/40",
  onPress,
  highlighted = false,
}: AppointmentCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, highlighted && styles.cardHighlighted]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, highlighted && styles.accentBarHighlighted]} />

      {/* Avatar */}
      <View style={[styles.avatarWrapper, highlighted && styles.avatarWrapperHighlighted]}>
        <Image
          source={typeof imageUrl === "string" ? { uri: imageUrl } : imageUrl}
          style={styles.icon}
        />
      </View>

      {/* Info */}
      <View style={styles.cardText}>
        <View style={styles.nameRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
          {highlighted && (
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>NEXT</Text>
            </View>
          )}
        </View>
        <View style={styles.serviceRow}>
          <View style={styles.servicePill}>
            <Text style={styles.servicePillText} numberOfLines={1}>{service || "No service"}</Text>
          </View>
        </View>
      </View>

      {/* Time chip */}
      <View style={[styles.timeChip, highlighted && styles.timeChipHighlighted]}>
        <Text style={[styles.timeText, highlighted && styles.timeTextHighlighted]}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
  },
  cardHighlighted: {
    backgroundColor: "#EBF8FF",
    shadowColor: "#0B7FAB",
    shadowOpacity: 0.15,
    elevation: 5,
  },
  accentBar: {
    width: 4,
    height: "100%",
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#CBD5E0",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  accentBarHighlighted: {
    backgroundColor: "#0B7FAB",
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    marginLeft: 8,
    marginRight: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7FAFC",
  },
  avatarWrapperHighlighted: {
    borderColor: "#0B7FAB",
  },
  icon: {
    width: 44,
    height: 44,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1A202C",
    flexShrink: 1,
  },
  nextBadge: {
    backgroundColor: "#0B7FAB",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nextBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  serviceRow: {
    flexDirection: "row",
  },
  servicePill: {
    backgroundColor: "#EDF2F7",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  servicePillText: {
    fontSize: 11,
    color: "#4A5568",
    fontWeight: "500",
  },
  timeChip: {
    backgroundColor: "#EDF2F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  timeChipHighlighted: {
    backgroundColor: "#0B7FAB",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4A5568",
  },
  timeTextHighlighted: {
    color: "#fff",
  },
});
