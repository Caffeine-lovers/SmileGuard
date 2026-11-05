import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Plus, X, Power, Trash2, KeyRound } from "lucide-react-native";
import {
  DoctorAccessCode,
  listAccessCodes,
  createAccessCode,
  updateAccessCode,
  deleteAccessCode,
} from "../../lib/adminService";

export default function AccessCodesTab() {
  const [codes, setCodes] = useState<DoctorAccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState<"doctor" | "assistant">("doctor");

  const fetchCodes = useCallback(async () => {
    const data = await listAccessCodes();
    setCodes(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchCodes();
      setLoading(false);
    })();
  }, [fetchCodes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCodes();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !newLabel.trim()) {
      Alert.alert("Missing Details", "Please enter both a code and a label.");
      return;
    }
    setSaving(true);
    try {
      await createAccessCode(newCode, newLabel, newTier);
      setNewCode("");
      setNewLabel("");
      setNewTier("doctor");
      setShowCreateModal(false);
      await fetchCodes();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create access code.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: DoctorAccessCode) => {
    const ok = await updateAccessCode(item.id, { is_active: !item.is_active });
    if (ok) await fetchCodes();
  };

  const handleDelete = (item: DoctorAccessCode) => {
    Alert.alert(
      "Delete Access Code",
      `Permanently delete "${item.code}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ok = await deleteAccessCode(item.id);
            if (ok) await fetchCodes();
          },
        },
      ]
    );
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
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.sectionLabel}>DOCTOR ACCESS CODES ({codes.length})</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
            <Plus size={14} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New Code</Text>
          </TouchableOpacity>
        </View>

        {codes.length === 0 ? (
          <Text style={styles.emptyText}>No access codes yet.</Text>
        ) : (
          codes.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}>
                  <KeyRound size={16} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.code}</Text>
                  <Text style={styles.cardSubtitle}>
                    {item.label || "No label"} · {item.tier.toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.is_active ? "#ECFDF5" : "#FEF2F2", borderColor: item.is_active ? "#A7F3D0" : "#FECACA" },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: item.is_active ? "#047857" : "#B91C1C" }]}>
                    {item.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleActive(item)} activeOpacity={0.75}>
                  <Power size={14} color="#047857" />
                  <Text style={styles.actionBtnText}>{item.is_active ? "Deactivate" : "Activate"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.75}
                >
                  <Trash2 size={14} color="#B91C1C" />
                  <Text style={[styles.actionBtnText, { color: "#B91C1C" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Access Code</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>CODE</Text>
            <TextInput
              style={styles.input}
              value={newCode}
              onChangeText={setNewCode}
              placeholder="e.g. SMILE-DOC-2027"
              autoCapitalize="characters"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>LABEL</Text>
            <TextInput
              style={styles.input}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="e.g. Primary Dentist (2027 Cohort)"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>TIER</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {(["doctor", "assistant"] as const).map((tierOption) => (
                <TouchableOpacity
                  key={tierOption}
                  style={[styles.tierBtn, newTier === tierOption && styles.tierBtnActive]}
                  onPress={() => setNewTier(tierOption)}
                >
                  <Text style={[styles.tierBtnText, newTier === tierOption && styles.tierBtnTextActive]}>
                    {tierOption.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Create Code</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.6 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
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
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deleteBtn: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#047857" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  inputLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  tierBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  tierBtnActive: { backgroundColor: "#047857", borderColor: "#047857" },
  tierBtnText: { fontWeight: "800", color: "#64748B", fontSize: 12 },
  tierBtnTextActive: { color: "#FFFFFF" },
  submitBtn: { backgroundColor: "#047857", borderRadius: 6, paddingVertical: 13, alignItems: "center" },
  submitBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
