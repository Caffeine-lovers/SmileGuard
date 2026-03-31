import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { theme } from "../../constants/theme.ts";

interface NavbarProps {
  onLogout?: () => void;
  showLogout?: boolean;
}

export default function Navbar({
  onLogout,
  showLogout = true,
}: NavbarProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        {/* Logo & App Name */}
        <View style={styles.logoContainer}>
          <Text style={styles.toothEmoji}>🦷</Text>
          <Text style={styles.appName}>SmileGuard MD</Text>
        </View>

        {/* Logout Button */}
        {showLogout && (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors["bg-surface"],
  },
  navbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.screenHorizontalPadding,
    backgroundColor: theme.colors["bg-surface"],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors["border-card"],
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  toothEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  appName: {
    ...theme.typography.appName,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.spacing.buttonBorderRadius,
    backgroundColor: theme.colors["brand-danger"],
  },
  logoutButtonText: {
    ...theme.typography.buttonLabel,
  },
});
