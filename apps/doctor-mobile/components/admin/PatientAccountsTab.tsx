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
import { User, Search, Trash2, Mail, Phone, Calendar, X } from "lucide-react-native";
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
      `Permanently delete ${patient.name || patient.email || "this patient"}'s account? This removes their profile record.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
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
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchWrap}>
          <Search size={15} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search patients by name or email..."
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <Text style={styles.sectionTitle}>Registered Patients</Text>
          <Text style={styles.sectionSubtitle}>
            {patients.length} {patients.length === 1 ? "patient on portal" : "patients on portal"}
          </Text>
        </View>

        {patients.length === 0 ? (
          <View style={styles.emptyCard}>
            <User size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Patients Found</Text>
            <Text style={styles.emptySub}>
              {search.trim().length > 0
                ? "No registered patients match your search query."
                : "Registered patient accounts will appear here."}
            </Text>
          </View>
        ) : (
          patients.map((patient) => (
            <View key={patient.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarBox}>
                  <User size={17} color="#047857" />
                </View>

                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{patient.name || "Anonymous Patient"}</Text>
                  <View style={styles.contactRow}>
                    {patient.email ? (
                      <View style={styles.contactItem}>
                        <Mail size={11} color="#64748B" />
                        <Text style={styles.contactText} numberOfLines={1}>
                          {patient.email}
                        </Text>
                      </View>
                    ) : null}
                    {patient.phone_number ? (
                      <View style={styles.contactItem}>
                        <Phone size={11} color="#64748B" />
                        <Text style={styles.contactText}>{patient.phone_number}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.deleteIconBtn}
                  onPress={() => handleDelete(patient)}
                  activeOpacity={0.7}
                  accessibilityLabel="Delete patient"
                >
                  <Trash2 size={15} color="#DC2626" />
                </TouchableOpacity>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>PATIENT PORTAL</Text>
                </View>
                <View style={styles.dateWrap}>
                  <Calendar size={11} color="#94A3B8" />
                  <Text style={styles.createdDate}>
                    Joined {new Date(patient.created_at).toLocaleDateString()}
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
  searchBarContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    padding: 0,
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
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  contactRow: {
    gap: 2,
    marginTop: 3,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  contactText: {
    fontSize: 11.5,
    color: "#64748B",
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
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
  rolePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#475569",
  },
  dateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  createdDate: {
    fontSize: 11,
    color: "#94A3B8",
  },
});
