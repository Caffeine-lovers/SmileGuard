import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { supabase } from "@smileguard/supabase-client";
import { LifeBuoy, X, CheckCircle2, Clock, AlertCircle } from "lucide-react-native";
import {
  SupportRequest,
  listSupportRequests,
  resolveSupportRequest,
  setSupportRequestStatus,
} from "../../lib/adminService";

type FilterStatus = "all" | SupportRequest["status"];

const STATUS_FILTERS: { id: FilterStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
];

export default function SupportRequestsTab() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("open");
  const [resolvingRequest, setResolvingRequest] = useState<SupportRequest | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRequests = useCallback(async (status: FilterStatus) => {
    const data = await listSupportRequests(status === "all" ? undefined : status);
    setRequests(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchRequests(filter);
      setLoading(false);
    })();
  }, [filter, fetchRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests(filter);
    setRefreshing(false);
  };

  const applyLocalStatus = (id: string, updates: Partial<SupportRequest>) => {
    setRequests((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      if (filter === "all") return next;
      return next.filter((r) => r.status === filter);
    });
  };

  const handleMarkInProgress = async (request: SupportRequest) => {
    applyLocalStatus(request.id, { status: "in_progress" });
    const ok = await setSupportRequestStatus(request.id, "in_progress");
    if (!ok) {
      Alert.alert("Error", "Failed to update ticket status.");
      await fetchRequests(filter);
    }
  };

  const handleResolve = async () => {
    if (!resolvingRequest) return;
    if (!resolutionNote.trim()) {
      Alert.alert("Resolution Note Required", "Please describe how this request was resolved.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const ok = await resolveSupportRequest(resolvingRequest.id, data.user?.id || "", resolutionNote);
      if (ok) {
        applyLocalStatus(resolvingRequest.id, {
          status: "resolved",
          resolution_note: resolutionNote.trim(),
        });
        setResolvingRequest(null);
        setResolutionNote("");
      } else {
        Alert.alert("Error", "Failed to resolve support request.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Horizontal Status Filter Bar */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_FILTERS.map((item) => {
            const isActive = filter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setFilter(item.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <Text style={styles.sectionTitle}>Support Tickets</Text>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <LifeBuoy size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Inquiries</Text>
          </View>
        ) : (
          requests.map((req, index) => {
            const isOpen = req.status === "open";
            const isInProgress = req.status === "in_progress";
            const isResolved = req.status === "resolved";

            return (
              <Animated.View
                key={req.id}
                entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 35)}
                exiting={FadeOut.duration(150)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, isResolved && styles.iconBoxResolved]}>
                    <LifeBuoy size={17} color={isResolved ? "#047857" : "#D97706"} />
                  </View>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.subjectText}>{req.subject || "No Subject"}</Text>
                    <Text style={styles.metaText}>
                      From {req.requester_role || "User"} · {new Date(req.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isOpen && styles.badgeOpen,
                      isInProgress && styles.badgeInProgress,
                      isResolved && styles.badgeResolved,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isOpen && styles.statusTextOpen,
                        isInProgress && styles.statusTextInProgress,
                        isResolved && styles.statusTextResolved,
                      ]}
                    >
                      {req.status.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Message Body */}
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{req.message || "No content provided."}</Text>
                </View>

                {/* If resolved, show resolution summary */}
                {isResolved && req.resolution_note && (
                  <View style={styles.resolutionBox}>
                    <Text style={styles.resolutionLabel}>Resolution Note:</Text>
                    <Text style={styles.resolutionText}>{req.resolution_note}</Text>
                  </View>
                )}

                {/* Action Buttons for Open & In-Progress */}
                {!isResolved && (
                  <View style={styles.actionsRow}>
                    {isOpen && (
                      <TouchableOpacity
                        style={styles.inProgressBtn}
                        onPress={() => handleMarkInProgress(req)}
                        activeOpacity={0.75}
                      >
                        <Clock size={13} color="#2563EB" />
                        <Text style={styles.inProgressBtnText}>In Progress</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => setResolvingRequest(req)}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={13} color="#FFFFFF" />
                      <Text style={styles.resolveBtnText}>Resolve Ticket</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Redesigned Modal: Resolve Request */}
      <Modal
        visible={!!resolvingRequest}
        animationType="fade"
        transparent
        onRequestClose={() => setResolvingRequest(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Resolve Support Ticket</Text>
                  <Text style={styles.modalSubtitle}>Document resolution and close inquiry</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setResolvingRequest(null)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {resolvingRequest && (
                <View style={styles.ticketSummaryBox}>
                  <Text style={styles.summarySubject}>{resolvingRequest.subject || "Inquiry"}</Text>
                  <Text style={styles.summaryDetails} numberOfLines={2}>
                    {resolvingRequest.message}
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>RESOLUTION NOTE</Text>
              <TextInput
                style={styles.textArea}
                value={resolutionNote}
                onChangeText={setResolutionNote}
                placeholder="Explain the steps taken to resolve this ticket..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setResolvingRequest(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleResolve}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <CheckCircle2 size={15} color="#FFFFFF" />
                      <Text style={styles.modalSubmitText}>Confirm Resolution</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterScroll: {
    gap: 8,
    paddingHorizontal: 14,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
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
    padding: 14,
    marginBottom: 12,
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
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxResolved: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  ticketInfo: {
    flex: 1,
  },
  subjectText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  metaText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeOpen: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  badgeInProgress: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  badgeResolved: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  statusTextOpen: {
    color: "#B45309",
  },
  statusTextInProgress: {
    color: "#1D4ED8",
  },
  statusTextResolved: {
    color: "#047857",
  },
  messageBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  messageText: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 18,
  },
  resolutionBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  resolutionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    marginBottom: 2,
  },
  resolutionText: {
    fontSize: 12,
    color: "#065F46",
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  inProgressBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  inProgressBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  resolveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#047857",
  },
  resolveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBackdrop: {
    width: "100%",
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  summarySubject: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  summaryDetails: {
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 90,
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  modalSubmitBtn: {
    flex: 1.6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
