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
        <View style={[styles.iconChip, { backgroundColor: bgTint, borderColor: accentColor + '40' }]}>
          {icon}
        </View>
      )}
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "#FFFFFF",
    borderRadius: 6, // Sharp, defined skeuo micro-radius matching patient-web
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    paddingVertical: 12,
    paddingHorizontal: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginTop: 3,
  },
});
