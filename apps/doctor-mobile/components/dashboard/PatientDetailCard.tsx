import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
} from "react-native";
import { theme } from "../../constants/theme.ts";

interface PatientDetailCardProps {
  patientName: string;
  service: string;
  time: string;
  age: number;
  gender: string;
  contact: string;
  email: string;
  notes?: string;
  photoUrl?: string;
}

export default function PatientDetailCard({
  patientName,
  service,
  time,
  age,
  gender,
  contact,
  email,
  notes,
  photoUrl,
}: PatientDetailCardProps) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {/* Photo Avatar */}
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photoAvatar} />
        ) : (
          <View style={[styles.photoAvatar, styles.avatarInitials]}>
            <Text style={styles.avatarInitialsText}>
              {patientName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </Text>
          </View>
        )}

        {/* Patient Name */}
        <Text style={styles.patientName}>{patientName}</Text>

        {/* Detail Rows */}
        <View style={styles.detailsContainer}>
          <DetailRow label="Service" value={service} />
          <DetailRow label="Time" value={time} />
          <DetailRow label="Age" value={String(age)} />
          <DetailRow label="Gender" value={gender} />
          <DetailRow label="Contact" value={contact} />
          <DetailRow label="Email" value={email} />
        </View>

        {/* Notes Block */}
        {notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors["bg-screen"],
    padding: theme.spacing.screenHorizontalPadding,
  },
  card: {
    backgroundColor: theme.colors["bg-surface"],
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    ...theme.shadows.card,
  },
  photoAvatar: {
    width: 72,
    height: 72,
    borderRadius: theme.spacing.avatarBorderRadius,
    marginBottom: 16,
    resizeMode: "cover",
  },
  avatarInitials: {
    backgroundColor: theme.colors["bg-avatar-initials"],
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialsText: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors["text-on-avatar"],
  },
  patientName: {
    ...theme.typography.cardPatientName,
    marginBottom: 16,
    textAlign: "center",
  },
  detailsContainer: {
    width: "100%",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  detailLabel: {
    ...theme.typography.cardDetailLabel,
    marginRight: 8,
    minWidth: 70,
  },
  detailValue: {
    ...theme.typography.cardDetailValue,
    flex: 1,
  },
  notesBlock: {
    backgroundColor: theme.colors["bg-notes"],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: "100%",
    marginTop: 8,
  },
  notesText: {
    ...theme.typography.notesText,
  },
});
