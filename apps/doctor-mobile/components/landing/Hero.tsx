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
    backgroundColor: "#f0f9ff",
    alignItems: "center",
  },
  heroContent: {
    maxWidth: 600,
    alignItems: "center",
  },
  h1: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  p: {
    fontSize: 18,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 30,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#0b7fab",
    width: "100%",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
