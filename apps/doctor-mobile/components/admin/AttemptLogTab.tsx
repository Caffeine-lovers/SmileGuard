import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { ListChecks, CheckCircle2, XCircle } from "lucide-react-native";
import { DoctorCodeAttempt, listCodeAttempts } from "../../lib/adminService";

type FilterOption = "all" | "success" | "failure";

export default function AttemptLogTab() {
  const [attempts, setAttempts] = useState<DoctorCodeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("all");

  const fetchAttempts = useCallback(async () => {
    const data = await listCodeAttempts();
    setAttempts(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchAttempts();
      setLoading(false);
    })();
  }, [fetchAttempts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAttempts();
    setRefreshing(false);
  };

  const filtered = attempts.filter((a) => {
    if (filter === "success") return a.is_successful;
    if (filter === "failure") return !a.is_successful;
    return true;
  });

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        {(["all", "success", "failure"] as FilterOption[]).map((option) => {
          const isActive = filter === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setFilter(option)}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {option.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.sectionLabel}>ACCESS CODE ATTEMPTS ({filtered.length})</Text>
        <Text style={styles.readOnlyNote}>Read-only record — attempts cannot be edited or deleted.</Text>

        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No attempts recorded.</Text>
        ) : (
          filtered.map((attempt) => (
            <View key={attempt.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.iconBox, { backgroundColor: attempt.is_successful ? "#ECFDF5" : "#FEF2F2", borderColor: attempt.is_successful ? "#A7F3D0" : "#FECACA" }]}>
                  {attempt.is_successful ? (
                    <CheckCircle2 size={16} color="#047857" />
                  ) : (
                    <XCircle size={16} color="#B91C1C" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{attempt.attempted_code || attempt.code || "Unknown Code"}</Text>
                  <Text style={styles.cardSubtitle}>
                    {new Date(attempt.created_at).toLocaleString()}
                    {attempt.details?.role ? ` · ${String(attempt.details.role).toUpperCase()}` : ""}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  filterBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: { backgroundColor: "#047857", borderColor: "#047857" },
  filterPillText: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  filterPillTextActive: { color: "#FFFFFF" },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.6 },
  readOnlyNote: { fontSize: 11, color: "#94A3B8", marginTop: 4, marginBottom: 12 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 32, fontSize: 13 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 12,
    marginBottom: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  cardSubtitle: { fontSize: 11, color: "#64748B", marginTop: 2 },
});
