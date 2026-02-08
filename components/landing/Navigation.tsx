import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface NavigationProps {
  onOpenPortal: (role: "patient" | "doctor") => void;
}

export default function Navigation({ onOpenPortal }: NavigationProps) {
  return (
    <View style={styles.nav}>
      <Text style={styles.logo}>SmileGuard</Text>
      <View style={styles.navLinks}>
        <TouchableOpacity
          style={styles.portalBtn}
          onPress={() => onOpenPortal("patient")}
        >
          <Text style={styles.portalBtnText}>Patient Portal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.portalBtn, styles.doctorPortalBtn]}
          onPress={() => onOpenPortal("doctor")}
        >
          <Text style={styles.portalBtnText}>Doctor Portal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "#fafafa",
    backgroundColor: "#fff",
  },
  navLinks: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0b7fab",
  },
  portalBtn: {
    backgroundColor: "#0b7fab",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  doctorPortalBtn: {
    backgroundColor: "#1e293b",
  },
  portalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
