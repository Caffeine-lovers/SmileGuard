import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { ListChecks, CheckCircle2, XCircle, ShieldAlert, Clock, Key } from "lucide-react-native";
import { DoctorCodeAttempt, listCodeAttempts } from "../../lib/adminService";

type FilterOption = "all" | "success" | "failure";

const FILTER_OPTIONS: { id: FilterOption; label: string }[] = [
  { id: "all", label: "All Attempts" },
  { id: "success", label: "Authorized" },
  { id: "failure", label: "Rejected" },
];

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
    <View style={styles.container}>
      {/* Segmented Filter Pills */}
      <View style={styles.filterBarContainer}>
        <View style={styles.filterBar}>
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setFilter(option.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <Text style={styles.sectionTitle}>Login Security Trail</Text>
          <Text style={styles.sectionSubtitle}>
            {filtered.length} {filtered.length === 1 ? "entry logged" : "entries logged"} · Read-only audit
          </Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <ListChecks size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Entries Recorded</Text>
            <Text style={styles.emptySub}>When staff input access codes on the welcome modal, attempts are logged here.</Text>
          </View>
        ) : (
          filtered.map((attempt) => {
            const isSuccess = attempt.is_successful;
            return (
              <View key={attempt.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, isSuccess ? styles.iconBoxSuccess : styles.iconBoxFail]}>
                    {isSuccess ? (
                      <CheckCircle2 size={17} color="#047857" />
                    ) : (
                      <XCircle size={17} color="#DC2626" />
                    )}
                  </View>

                  <View style={styles.attemptInfo}>
                    <View style={styles.codeRow}>
                      <Text style={styles.codeText}>
                        {attempt.attempted_code || attempt.code || "Unknown Code"}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isSuccess ? styles.statusBadgeSuccess : styles.statusBadgeFail,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isSuccess ? styles.statusTextSuccess : styles.statusTextFail,
                          ]}
                        >
                          {isSuccess ? "AUTHORIZED" : "BLOCKED"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.timeWrap}>
                        <Clock size={11} color="#94A3B8" />
                        <Text style={styles.metaDate}>
                          {new Date(attempt.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      {attempt.details?.role && (
                        <View style={styles.roleTag}>
                          <Key size={10} color="#475569" />
                          <Text style={styles.roleTagText}>
                            {String(attempt.details.role).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centerFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  filterBarContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterBar: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 3,
    gap: 4,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: "#047857",
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  headerBar: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 13,
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconBoxSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  iconBoxFail: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  attemptInfo: {
    flex: 1,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderWidth: 1,
  },
  statusBadgeSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusBadgeFail: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  statusTextSuccess: {
    color: "#047857",
  },
  statusTextFail: {
    color: "#DC2626",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaDate: {
    fontSize: 11,
    color: "#64748B",
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleTagText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#475569",
  },
});
