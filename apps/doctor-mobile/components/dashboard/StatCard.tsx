import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface StatCardProps {
  number: number | string;
  label: string;
  icon?: React.ReactNode;
  accentColor?: string;
  bgTint?: string;
}

export default function StatCard({ 
  number, 
  label, 
  icon,
  accentColor = "#047857",
  bgTint = "#ECFDF5" 
}: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon && (
        <View style={[styles.iconChip, { backgroundColor: bgTint }]}>
          {icon}
        </View>
      )}
      <Text style={[styles.statNumber, { color: accentColor }]}>{number}</Text>
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
});
