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
} from "react-native";
import { supabase } from "@smileguard/supabase-client";
import { LifeBuoy, X } from "lucide-react-native";
import {
  SupportRequest,
  listSupportRequests,
  resolveSupportRequest,
  setSupportRequestStatus,
} from "../../lib/adminService";

type FilterStatus = "all" | SupportRequest["status"];

const STATUS_FILTERS: FilterStatus[] = ["all", "open", "in_progress", "resolved"];

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

  const handleMarkInProgress = async (request: SupportRequest) => {
    const ok = await setSupportRequestStatus(request.id, "in_progress");
    if (ok) await fetchRequests(filter);
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
        setResolvingRequest(null);
        setResolutionNote("");
        await fetchRequests(filter);
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
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {STATUS_FILTERS.map((status) => {
          const isActive = filter === status;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setFilter(status)}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {status.replace("_", " ").toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {requests.length === 0 ? (
          <Text style={styles.emptyText}>No support requests in this queue.</Text>
        ) : (
          requests.map((request) => (
            <View key={request.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}>
                  <LifeBuoy size={16} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{request.subject || "Untitled Request"}</Text>
                  <Text style={styles.cardSubtitle}>
                    {request.requester_role ? request.requester_role.toUpperCase() : "UNKNOWN"} ·{" "}
                    {new Date(request.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{request.status.replace("_", " ").toUpperCase()}</Text>
                </View>
              </View>

              {request.message ? <Text style={styles.messageText}>{request.message}</Text> : null}

              {request.status !== "resolved" && (
                <View style={styles.actionsRow}>
                  {request.status === "open" && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleMarkInProgress(request)}>
                      <Text style={styles.actionBtnText}>Mark In Progress</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.resolveBtn]}
                    onPress={() => {
                      setResolvingRequest(request);
                      setResolutionNote("");
                    }}
                  >
                    <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Resolve</Text>
                  </TouchableOpacity>
                </View>
              )}

              {request.status === "resolved" && request.resolution_note ? (
                <View style={styles.resolutionBox}>
                  <Text style={styles.resolutionLabel}>RESOLUTION</Text>
                  <Text style={styles.resolutionText}>{request.resolution_note}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!resolvingRequest} animationType="slide" transparent onRequestClose={() => setResolvingRequest(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Resolve Request</Text>
              <TouchableOpacity onPress={() => setResolvingRequest(null)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>RESOLUTION NOTE</Text>
            <TextInput
              style={styles.textArea}
              value={resolutionNote}
              onChangeText={setResolutionNote}
              placeholder="Describe how this was resolved..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleResolve} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Mark Resolved</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  filterBar: { backgroundColor: "#FFFFFF", paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: "#E2E8F0" },
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
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  cardSubtitle: { fontSize: 11, color: "#64748B", marginTop: 2 },
  statusBadge: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 9, fontWeight: "800", color: "#64748B" },
  messageText: { fontSize: 12, color: "#334155", marginTop: 10, lineHeight: 18 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  resolveBtn: { backgroundColor: "#047857", borderColor: "#047857" },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#047857" },
  resolutionBox: { marginTop: 10, padding: 10, backgroundColor: "#F8FAFC", borderRadius: 6, borderWidth: 1, borderColor: "#E2E8F0" },
  resolutionLabel: { fontSize: 10, fontWeight: "800", color: "#64748B", marginBottom: 4 },
  resolutionText: { fontSize: 12, color: "#334155" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  inputLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 6 },
  textArea: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  submitBtn: { backgroundColor: "#047857", borderRadius: 6, paddingVertical: 13, alignItems: "center" },
  submitBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
