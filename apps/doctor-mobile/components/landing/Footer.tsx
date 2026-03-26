import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Footer: React.FC = () => {
  return (
    <View style={styles.footer}>
      <View style={styles.footerRow}>
        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Contact</Text>
          <Text style={styles.footerText}>📍 123 Dental St., Malabon</Text>
          <Text style={styles.footerText}>📞 (02) 1234-5678</Text>
          <Text style={styles.footerText}>📧 info@smileguard.ph</Text>
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Quick Links</Text>
          <Text style={styles.footerLink}>Book Appointment</Text>
          <Text style={styles.footerLink}>Services</Text>
          <Text style={styles.footerLink}>Insurance Accepted</Text>
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Hours</Text>
          <Text style={styles.footerText}>🕗 Mon: 10:00 AM – 4:00 PM</Text>
          <Text style={styles.footerText}>⌚ Tue: Closed</Text>
          <Text style={styles.footerText}>🕗 Wed–Fri: 10:00 AM – 3:00 PM</Text>
          <Text style={styles.footerText}>🕗 Sat: 10:00 AM – 3:00 PM</Text>
          <Text style={styles.footerText}>⌚ Sun: Closed</Text>
        </View>
      </View>
      <View style={styles.footerBottom}>
        <Text style={styles.footerLegal}>© 2026 SmileGuard Dental</Text>
        <Text style={styles.footerLegal}>Privacy Policy | Terms of Service</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#f9fafb",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    width: '100%',
  },
  footerRow: {
    borderColor: "#2bf1ff7d",
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  footerSection: {
    width: "30%",
    marginBottom: 20,
    minWidth: 100,
  },
  footerTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "500",
    marginBottom: 4,
  },
  footerLink: {
    fontSize: 14,
    color: "#0b7fab",
    textDecorationLine: "underline",
    marginBottom: 4,
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    alignItems: "center",
  },
  footerLegal: {
    fontSize: 12,
    color: "#6b7280",
  },
});

export default Footer;
