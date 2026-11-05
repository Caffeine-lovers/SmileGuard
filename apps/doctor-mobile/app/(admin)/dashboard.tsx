import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@smileguard/supabase-client";
import {
  KeyRound,
  Stethoscope,
  Users,
  LifeBuoy,
  ListChecks,
  LogOut,
} from "lucide-react-native";
import AccessCodesTab from "../../components/admin/AccessCodesTab";
import DentistAccountsTab from "../../components/admin/DentistAccountsTab";
import PatientAccountsTab from "../../components/admin/PatientAccountsTab";
import SupportRequestsTab from "../../components/admin/SupportRequestsTab";
import AttemptLogTab from "../../components/admin/AttemptLogTab";

type AdminTab = "codes" | "dentists" | "patients" | "support" | "attempts";

const TABS: { id: AdminTab; label: string; icon: any }[] = [
  { id: "codes", label: "Access Codes", icon: KeyRound },
  { id: "dentists", label: "Dentists", icon: Stethoscope },
  { id: "patients", label: "Patients", icon: Users },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "attempts", label: "Attempt Log", icon: ListChecks },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("codes");

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            await AsyncStorage.multiRemove([
              "supabase.auth.token",
              "supabase.auth.refreshToken",
              "supabase.auth.user",
            ]);
          } catch (err) {
            console.error("[AdminDashboard] Logout error:", err);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.topHeaderTitle}>ADMIN CONSOLE</Text>
          <Text style={styles.topHeaderSubtitle}>SmileGuard Clinic Administration</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
          <LogOut size={16} color="#B91C1C" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Icon size={15} color={isActive ? "#FFFFFF" : "#047857"} />
              <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {activeTab === "codes" && <AccessCodesTab />}
        {activeTab === "dentists" && <DentistAccountsTab />}
        {activeTab === "patients" && <PatientAccountsTab />}
        {activeTab === "support" && <SupportRequestsTab />}
        {activeTab === "attempts" && <AttemptLogTab />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
  },
  topHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.6,
  },
  topHeaderSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  tabPillActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  tabPillTextActive: {
    color: "#FFFFFF",
  },
});
