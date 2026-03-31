import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../constants/theme.ts";

interface StatCardProps {
  number: number | string;
  label: string;
}

export default function StatCard({ number, label }: StatCardProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.colors["bg-surface"],
    flex: 1,
    minWidth: 100,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: theme.spacing.cardBorderRadius,
    ...theme.shadows.card,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors["brand-primary"],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors["text-secondary"],
  },
});
