import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { getAllBlockedSlots, BlockedSlot } from "../../lib/appointmentService.ts";

export default function ScheduleBlockoutView() {
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBlockedSlots();
  }, []);

  const fetchBlockedSlots = async () => {
    setLoading(true);
    try {
      const slots = await getAllBlockedSlots();
      setBlockedSlots(slots);
    } catch (error) {
      console.error("Error fetching blocked slots:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBlockedSlots();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    // Convert 24h format (HH:MM) to 12h format (HH:MM AM/PM)
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Blocked Appointment Slots</Text>
      <Text style={styles.subtitle}>
        {blockedSlots.length} slot{blockedSlots.length !== 1 ? "s" : ""} blocked
      </Text>

      {blockedSlots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No appointments scheduled yet</Text>
          <Text style={styles.emptySubtext}>Available slots will appear here once bookings are made</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={styles.scrollView}
        >
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableHeader, styles.dateColumn]}>Date</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.timeColumn]}>Time</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.patientColumn]}>Patient</Text>
              <Text style={[styles.tableCell, styles.tableHeader, styles.serviceColumn]}>Service</Text>
            </View>

            {/* Table Body */}
            {blockedSlots.map((slot, index) => (
              <View key={`${slot.date}-${slot.time}-${index}`} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.dateColumn, styles.dateValue]}>
                  {formatDate(slot.date)}
                </Text>
                <Text style={[styles.tableCell, styles.timeColumn, styles.timeValue]}>
                  {formatTime(slot.time)}
                </Text>
                <Text style={[styles.tableCell, styles.patientColumn, styles.patientValue]}>
                  {slot.patientName || "Unknown"}
                </Text>
                <Text style={[styles.tableCell, styles.serviceColumn, styles.serviceValue]}>
                  {slot.service || "—"}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#bbb",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  tableContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    minHeight: 48,
  },
  tableCell: {
    padding: 12,
    justifyContent: "center",
  },
  dateColumn: {
    flex: 2,
  },
  timeColumn: {
    flex: 1.2,
  },
  patientColumn: {
    flex: 1.5,
  },
  serviceColumn: {
    flex: 1.3,
  },
  tableHeader: {
    backgroundColor: "#f9f9f9",
    fontWeight: "600",
    fontSize: 12,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 13,
    color: "#1a1a2e",
    fontWeight: "500",
  },
  timeValue: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "600",
  },
  patientValue: {
    fontSize: 12,
    color: "#1a1a2e",
  },
  serviceValue: {
    fontSize: 12,
    color: "#666",
  },
});
