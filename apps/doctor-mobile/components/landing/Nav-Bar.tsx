import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface NavigationProps {
  onOpenPortal?: () => void;
}

export default function Navigation({ onOpenPortal }: NavigationProps) {
  return (
    <View style={styles.nav}>
      <Text style={styles.logo}>SmileGuard</Text>
      <View style={styles.navLinks}></View>
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
});
