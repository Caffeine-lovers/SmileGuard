import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ListChecks, CheckCircle2, XCircle, ShieldAlert, Clock, Key, RefreshCw, Trash2, Plus, LogIn, ShieldCheck, User, Globe } from "lucide-react-native";
import { DoctorCodeAttempt, listCodeAttempts } from "../../lib/adminService";

type FilterOption = "all" | "success" | "failure" | "admin";

const FILTER_OPTIONS: { id: FilterOption; label: string }[] = [
  { id: "all", label: "All" },
  { id: "success", label: "Authorized" },
  { id: "failure", label: "Rejected" },
  { id: "admin", label: "Admin" },
];

const ADMIN_EVENTS = ["code_created", "code_regenerated", "code_deleted", "code_status_changed", "admin_claim"];

const EVENT_META: Record<string, { label: string; icon: any }> = {
  verification: { label: "Code entered", icon: Key },
  sign_in: { label: "Signed in", icon: LogIn },
  admin_claim: { label: "Admin access", icon: ShieldCheck },
  code_created: { label: "Code created", icon: Plus },
  code_regenerated: { label: "Code re-generated", icon: RefreshCw },
  code_deleted: { label: "Code deleted", icon: Trash2 },
  code_status_changed: { label: "Code status changed", icon: Key },
};

export default function AttemptLogTab() {
  const [attempts, setAttempts] = useState<DoctorCodeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAttempts = useCallback(async () => {
    try {
      setAttempts(await listCodeAttempts());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the audit log.");
    }
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
    if (filter === "admin") return ADMIN_EVENTS.includes(a.event || "");
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
        {loadError ? (
          <View style={styles.emptyCard}>
            <ShieldAlert size={32} color="#DC2626" />
            <Text style={styles.emptyTitle}>Couldn't Load the Audit Log</Text>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <ListChecks size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Entries</Text>
          </View>
        ) : (
          filtered.map((attempt, index) => {
            const isSuccess = attempt.is_successful;
            const meta = EVENT_META[attempt.event || ""] || { label: attempt.event || "Event", icon: Key };
            const EventIcon = meta.icon;
            const label = attempt.details?.label;
            const role = attempt.details?.role;
            const platform = attempt.details?.platform;

            return (
              <Animated.View
                key={attempt.id}
                entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 35)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, isSuccess ? styles.iconBoxSuccess : styles.iconBoxFail]}>
                    <EventIcon size={17} color={isSuccess ? "#047857" : "#DC2626"} />
                  </View>

                  <View style={styles.attemptInfo}>
                    <View style={styles.codeRow}>
                      <Text style={styles.eventText}>{meta.label}</Text>
                      <View style={[styles.statusBadge, isSuccess ? styles.statusBadgeSuccess : styles.statusBadgeFail]}>
                        {isSuccess ? <CheckCircle2 size={10} color="#047857" /> : <XCircle size={10} color="#DC2626" />}
                        <Text style={[styles.statusBadgeText, isSuccess ? styles.statusTextSuccess : styles.statusTextFail]}>
                          {isSuccess ? "OK" : "BLOCKED"}
                        </Text>
                      </View>
                    </View>

                    {(attempt.attempted_code || attempt.code || label) && (
                      <Text style={styles.codeText} numberOfLines={1}>
                        {attempt.attempted_code || attempt.code || label}
                      </Text>
                    )}

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Clock size={11} color="#94A3B8" />
                        <Text style={styles.metaText}>
                          {new Date(attempt.created_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <User size={11} color="#94A3B8" />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {attempt.actor_name || "Not signed in"}
                        </Text>
                      </View>
                      {attempt.ip_address && (
                        <View style={styles.metaItem}>
                          <Globe size={11} color="#94A3B8" />
                          <Text style={styles.metaText}>{attempt.ip_address}</Text>
                        </View>
                      )}
                      {(role || platform) && (
                        <View style={styles.roleTag}>
                          <Text style={styles.roleTagText}>
                            {[role, platform].filter(Boolean).join(" · ").toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Animated.View>
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
    fontSize: 11,
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
  errorText: {
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
    alignItems: "flex-start",
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
    gap: 8,
  },
  eventText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  codeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  metaText: {
    fontSize: 11,
    color: "#64748B",
    flexShrink: 1,
  },
  roleTag: {
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
