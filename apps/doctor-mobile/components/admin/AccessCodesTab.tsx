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
  KeyboardAvoidingView,
  Share,
} from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { Plus, X, RefreshCw, Trash2, KeyRound, Stethoscope, Users, CheckCircle2, ShieldAlert, Share2 } from "lucide-react-native";
import {
  DoctorAccessCode,
  listAccessCodes,
  createAccessCode,
  regenerateAccessCode,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regeneratedCode, setRegeneratedCode] = useState<DoctorAccessCode | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      setCodes(await listAccessCodes());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load access codes.");
    }
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
      const created = await createAccessCode(newCode, newLabel, newTier);
      setNewCode("");
      setNewLabel("");
      setNewTier("doctor");
      setShowCreateModal(false);
      if (created) {
        setCodes((prev) => [created, ...prev]);
      } else {
        await fetchCodes();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create access code.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const runRegenerate = async (item: DoctorAccessCode) => {
    setRegeneratingId(item.id);
    try {
      const updated = await regenerateAccessCode(item.id);
      setCodes((prev) => prev.map((c) => (c.id === item.id ? { ...c, ...updated } : c)));
      setRegeneratedCode(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to regenerate access code.";
      Alert.alert("Error", message);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleRegenerate = (item: DoctorAccessCode) => {
    const warning =
      item.tier === "admin"
        ? "The old code stops working immediately. You'll need the new code the next time you sign in, so save it somewhere safe."
        : "The old code stops working immediately. Staff will need the new code the next time they sign in.";
    Alert.alert(`Regenerate "${item.code}"?`, warning, [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", onPress: () => runRegenerate(item) },
    ]);
  };

  const handleShareCode = (item: DoctorAccessCode) => {
    Share.share({ message: item.code }).catch((err) => {
      console.warn("[AccessCodesTab] Share failed:", err);
    });
  };

  const handleDelete = (item: DoctorAccessCode) => {
    Alert.alert(
      "Delete Access Code",
      `Permanently delete "${item.code}"? Staff will no longer be able to register with it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setCodes((prev) => prev.filter((c) => c.id !== item.id));
            const ok = await deleteAccessCode(item.id);
            if (!ok) {
              Alert.alert("Error", "Failed to delete access code.");
              await fetchCodes();
            }
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Header Action Bar */}
        <View style={[styles.headerBar, { justifyContent: "flex-end" }]}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New Code</Text>
          </TouchableOpacity>
        </View>

        {loadError ? (
          <View style={styles.emptyCard}>
            <ShieldAlert size={32} color="#DC2626" />
            <Text style={styles.emptyTitle}>Couldn't Load Access Codes</Text>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : codes.length === 0 ? (
          <View style={styles.emptyCard}>
            <KeyRound size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Access Codes</Text>
          </View>
        ) : (
          codes.map((item, index) => {
            const isDoctor = item.tier === "doctor";
            const isAdmin = item.tier === "admin";
            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 35)}
                exiting={FadeOut.duration(150)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, isAdmin && styles.iconBoxAdmin]}>
                    <KeyRound size={17} color={isAdmin ? "#D97706" : "#047857"} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.codeText} selectable>{item.code}</Text>
                    <Text style={styles.labelText}>{item.label || "Clinic Code"}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      item.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        item.is_active ? styles.statusTextActive : styles.statusTextInactive,
                      ]}
                    >
                      {item.is_active ? "ACTIVE" : "INACTIVE"}
                    </Text>
                  </View>
                </View>

                {/* Tier Tag & Dates */}
                <View style={styles.metaRow}>
                  <View style={styles.tierPill}>
                    {isDoctor ? (
                      <Stethoscope size={12} color="#047857" />
                    ) : (
                      <Users size={12} color="#2563EB" />
                    )}
                    <Text style={styles.tierPillText}>{item.tier.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.createdDate}>
                    Added {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>

                {/* Action Row */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.btnRegenerate]}
                    onPress={() => handleRegenerate(item)}
                    disabled={regeneratingId === item.id}
                    activeOpacity={0.75}
                  >
                    {regeneratingId === item.id ? (
                      <ActivityIndicator size="small" color="#047857" />
                    ) : (
                      <RefreshCw size={13} color="#047857" />
                    )}
                    <Text style={[styles.actionBtnText, { color: "#047857" }]}>Re-generate</Text>
                  </TouchableOpacity>

                  {!isAdmin && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.btnDelete]}
                      onPress={() => handleDelete(item)}
                      activeOpacity={0.75}
                    >
                      <Trash2 size={13} color="#DC2626" />
                      <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* New code, shown right after regenerating */}
      <Modal
        visible={!!regeneratedCode}
        animationType="fade"
        transparent
        onRequestClose={() => setRegeneratedCode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Access Code</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRegeneratedCode(null)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.newCodeHint}>
                The old code no longer works. Save this one now and share it with whoever needs it.
              </Text>
              <View style={styles.newCodeBox}>
                <Text style={styles.newCodeText} selectable>{regeneratedCode?.code}</Text>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setRegeneratedCode(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={() => regeneratedCode && handleShareCode(regeneratedCode)}
                  activeOpacity={0.85}
                >
                  <Share2 size={16} color="#FFFFFF" />
                  <Text style={styles.modalSubmitText}>Share Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Redesigned Modal: New Access Code */}
      <Modal
        visible={showCreateModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Generate Access Code</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowCreateModal(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>ACCESS CODE</Text>
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
                placeholder="e.g. Orthodontic Resident (Batch 2027)"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>STAFF ROLE TIER</Text>
              <View style={styles.tierSelector}>
                <TouchableOpacity
                  style={[styles.tierOption, newTier === "doctor" && styles.tierOptionActive]}
                  onPress={() => setNewTier("doctor")}
                  activeOpacity={0.8}
                >
                  <Stethoscope size={16} color={newTier === "doctor" ? "#FFFFFF" : "#047857"} />
                  <Text style={[styles.tierOptionText, newTier === "doctor" && styles.tierOptionTextActive]}>
                    Dentist
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tierOption, newTier === "assistant" && styles.tierOptionActive]}
                  onPress={() => setNewTier("assistant")}
                  activeOpacity={0.8}
                >
                  <Users size={16} color={newTier === "assistant" ? "#FFFFFF" : "#047857"} />
                  <Text style={[styles.tierOptionText, newTier === "assistant" && styles.tierOptionTextActive]}>
                    Assistant
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowCreateModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleCreate}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#FFFFFF" />
                      <Text style={styles.modalSubmitText}>Save Code</Text>
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
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
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
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxAdmin: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  cardInfo: {
    flex: 1,
  },
  codeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  labelText: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusBadgeInactive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statusTextActive: {
    color: "#047857",
  },
  statusTextInactive: {
    color: "#DC2626",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  createdDate: {
    fontSize: 11,
    color: "#94A3B8",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  btnRegenerate: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  errorText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  newCodeHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#475569",
    marginBottom: 12,
  },
  newCodeBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  newCodeText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnActivate: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  btnDeactivate: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  btnDelete: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
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
    marginBottom: 16,
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
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  tierSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  tierOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  tierOptionActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  tierOptionText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#475569",
  },
  tierOptionTextActive: {
    color: "#FFFFFF",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
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
