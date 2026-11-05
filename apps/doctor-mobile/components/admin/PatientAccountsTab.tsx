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
  TextInput,
} from "react-native";
import { User, Search, Trash2 } from "lucide-react-native";
import { AdminPatientRow, listPatients, deletePatientAccount } from "../../lib/adminService";

export default function PatientAccountsTab() {
  const [patients, setPatients] = useState<AdminPatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchPatients = useCallback(async (query?: string) => {
    const data = await listPatients(query);
    setPatients(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPatients();
      setLoading(false);
    })();
  }, [fetchPatients]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPatients(search);
    setRefreshing(false);
  };

  const handleSearch = async (text: string) => {
    setSearch(text);
    await fetchPatients(text);
  };

  const handleDelete = (patient: AdminPatientRow) => {
    Alert.alert(
      "Delete Patient Account",
      `Permanently delete ${patient.name || patient.email || "this patient"}'s account? This removes their profile record. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ok = await deletePatientAccount(patient.id);
            if (ok) await fetchPatients(search);
            else Alert.alert("Error", "Failed to delete patient account.");
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
      <View style={styles.searchWrap}>
        <Search size={14} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Search patients by name or email"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Text style={styles.sectionLabel}>PATIENT ACCOUNTS ({patients.length})</Text>

        {patients.length === 0 ? (
          <Text style={styles.emptyText}>No patient accounts found.</Text>
        ) : (
          patients.map((patient) => (
            <View key={patient.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}>
                  <User size={16} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{patient.name || "Unnamed Patient"}</Text>
                  <Text style={styles.cardSubtitle}>
                    {patient.email || "No email"}
                    {patient.phone_number ? ` · ${patient.phone_number}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(patient)}
                  activeOpacity={0.75}
                >
                  <Trash2 size={14} color="#B91C1C" />
                </TouchableOpacity>
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0F172A" },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.6, marginBottom: 12 },
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
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
});
