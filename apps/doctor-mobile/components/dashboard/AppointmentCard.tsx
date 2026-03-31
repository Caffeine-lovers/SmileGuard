import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { theme } from "../../constants/theme";

interface AppointmentCardProps {
  id?: string;
  name: string;
  service: string;
  time: string;
  imageUrl?: string;
  status?: "upcoming" | "confirmed" | "completed" | "cancelled";
  isSelected?: boolean;
  onPress: () => void;
  highlighted?: boolean;
}

export default function AppointmentCard({
  id,
  name,
  service,
  time,
  imageUrl,
  status = "upcoming",
  isSelected = false,
  onPress,
  highlighted = false,
}: AppointmentCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case "confirmed":
        return theme.statusBadges.confirmed;
      case "completed":
        return theme.statusBadges.completed;
      case "cancelled":
        return theme.statusBadges.cancelled;
      default:
        return theme.statusBadges.upcoming;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "confirmed":
        return "CONFIRMED";
      case "completed":
        return "COMPLETED";
      case "cancelled":
        return "CANCELLED";
      default:
        return "UPCOMING PATIENT";
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && {
          borderColor: theme.colors["border-active"],
          borderWidth: 1.5,
        },
        !isSelected && {
          borderColor: theme.colors["border-card"],
          borderWidth: 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarInitials]}>
          <Text style={styles.avatarInitialsText}>
            {name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </Text>
        </View>
      )}

      {/* Patient Name & Status Badge */}
      <View style={styles.nameContainer}>
        <View style={styles.nameBadgeRow}>
          <Text style={styles.patientName}>{name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor() },
            ]}
          >
            <Text style={styles.statusBadgeText}>{getStatusLabel()}</Text>
          </View>
        </View>

        {/* Service Type */}
        <Text style={styles.serviceType}>{service}</Text>
      </View>

      {/* Time */}
      <Text style={styles.time}>{time}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors["bg-surface"],
    borderRadius: theme.spacing.cardBorderRadius,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    ...theme.shadows.card,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.spacing.avatarBorderRadius,
    marginRight: 12,
    resizeMode: "cover",
  },
  avatarInitials: {
    backgroundColor: theme.colors["bg-avatar-initials"],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialsText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors["text-on-avatar"],
  },
  nameContainer: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  patientName: {
    ...theme.typography.listItemName,
    marginRight: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.spacing.badgeBorderRadius,
  },
  statusBadgeText: {
    ...theme.typography.badgeLabel,
  },
  serviceType: {
    ...theme.typography.listItemSubtitle,
  },
  time: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors["brand-danger"],
    marginLeft: 8,
  },
});
