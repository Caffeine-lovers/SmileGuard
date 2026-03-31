import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { theme } from "../../constants/theme.ts";

interface SectionHeaderProps {
  label: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export default function SectionHeader({
  label,
  actionLabel,
  onActionPress,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {actionLabel && (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.7}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    ...theme.typography.sectionLabel,
  },
  action: {
    ...theme.typography.sectionAction,
  },
});
