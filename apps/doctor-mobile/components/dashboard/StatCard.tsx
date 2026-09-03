import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatCardProps {
  number: number | string;
  label: string;
  accent?: string;
}

const ACCENT_COLORS = ["#0B7FAB", "#38A169", "#D69E2E", "#9B59B6"];

export default function StatCard({ number, label, accent }: StatCardProps) {
  // Deterministically pick an accent color based on label if not provided
  const hash = label.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const resolvedAccent = accent ?? ACCENT_COLORS[hash % ACCENT_COLORS.length];

  return (
    <View style={[styles.panel, styles.shadow]}>
      <View style={[styles.accentBar, { backgroundColor: resolvedAccent }]} />
      <View style={styles.content}>
        <Text style={[styles.statNumber, { color: resolvedAccent }]}>{number}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    minWidth: 100,
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
  },
  accentBar: {
    width: 5,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#718096",
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  shadow: {
    shadowColor: "#0B7FAB",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
});
