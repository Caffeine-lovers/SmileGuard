import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface HeroProps {
  onOpenPortal: () => void;
}

export default function Hero({ onOpenPortal }: HeroProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroContent}>
        <Text style={styles.h1}>Smile-Guard Doctor Dashboard:</Text>
        <Text style={styles.p}>
          AI-Enhanced Dental Diagnostics & Patient Provider Dashboard
        </Text>
        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn]}
          onPress={onOpenPortal}
          accessibilityLabel="Access doctor dashboard"
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>Access Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 60,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
  },
  heroContent: {
    maxWidth: 600,
    alignItems: "center",
  },
  h1: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 15,
  },
  p: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 6,
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#10B981",
    borderWidth: 1.5,
    borderTopColor: "#34D399",
    borderLeftColor: "#34D399",
    borderBottomColor: "#047857",
    borderRightColor: "#047857",
    width: "100%",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
