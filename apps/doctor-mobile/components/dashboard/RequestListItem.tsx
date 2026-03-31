import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../constants/theme.ts";

interface RequestListItemProps {
  id: string;
  name: string;
  requestType: string;
  initialsAvatarBg?: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export default function RequestListItem({
  id,
  name,
  requestType,
  initialsAvatarBg = theme.colors["bg-avatar-initials"],
  onAccept,
  onReject,
}: RequestListItemProps) {
  return (
    <View style={styles.listItem}>
      {/* Initials Avatar */}
      <View
        style={[
          styles.initialsAvatar,
          { backgroundColor: initialsAvatarBg },
        ]}
      >
        <Text style={styles.initialsText}>
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </Text>
      </View>

      {/* Name and Request Type */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.requestType}>Request: {requestType}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => onAccept(id)}
          activeOpacity={0.8}
        >
          <Feather
            name="check"
            size={18}
            color={theme.colors["text-on-danger"]}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => onReject(id)}
          activeOpacity={0.8}
        >
          <Feather
            name="x"
            size={18}
            color={theme.colors["text-on-danger"]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: {
    backgroundColor: theme.colors["bg-surface"],
    borderRadius: theme.spacing.cardBorderRadius,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.spacing.listItemMinHeight,
    ...theme.shadows.card,
  },
  initialsAvatar: {
    width: 42,
    height: 42,
    borderRadius: theme.spacing.avatarBorderRadius,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  initialsText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors["text-on-avatar"],
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    ...theme.typography.listItemName,
    marginBottom: 4,
  },
  requestType: {
    ...theme.typography.listItemSubtitle,
  },
  actionContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: theme.spacing.avatarBorderRadius,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: theme.colors["brand-primary"],
  },
  rejectButton: {
    backgroundColor: theme.colors["brand-danger"],
  },
});
