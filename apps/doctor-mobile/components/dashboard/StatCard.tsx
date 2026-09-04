import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatCardProps {
  number: number | string;
  label: string;
}

export default function StatCard({ number, label }: StatCardProps) {
  return (
    <View style={[styles.panel, styles.shadow]}>
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
    flex: 1,
    minWidth: 100,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
});
