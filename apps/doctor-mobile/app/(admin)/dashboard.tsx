import React, { useState, useEffect } from "react";
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
  Sparkles,
} from "lucide-react-native";
import AccessCodesTab from "../../components/admin/AccessCodesTab";
import DentistAccountsTab from "../../components/admin/DentistAccountsTab";
import PatientAccountsTab from "../../components/admin/PatientAccountsTab";
import SupportRequestsTab from "../../components/admin/SupportRequestsTab";
import AttemptLogTab from "../../components/admin/AttemptLogTab";
import AdminTourModal from "../../components/admin/AdminTourModal";

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
  const [showTour, setShowTour] = useState(false);

  // Automatically check if the admin has seen the UI walkthrough tour
  useEffect(() => {
    let timer: NodeJS.Timeout;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        const key = userId ? `@has_seen_admin_tour_${userId}` : "@has_seen_admin_tour_default";
        const hasSeen = await AsyncStorage.getItem(key);
        if (!hasSeen) {
          timer = setTimeout(() => setShowTour(true), 600);
        }
      } catch (err) {
        console.warn("[AdminDashboard] Error checking tour status:", err);
      }
    })();
    return () => clearTimeout(timer);
  }, []);

  const handleTourClose = async () => {
    setShowTour(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const key = userId ? `@has_seen_admin_tour_${userId}` : "@has_seen_admin_tour_default";
      await AsyncStorage.setItem(key, "true");
    } catch (err) {
      console.warn("[AdminDashboard] Error persisting tour completion:", err);
    }
  };

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            await supabase.auth.signOut();
            const keysToRemove = [
              "supabase.auth.token",
              "supabase.auth.refreshToken",
              "supabase.auth.user",
              "@pending_doctor_access_code",
              "@pending_user_role",
              "@pending_is_admin",
            ];
            if (userId) {
              keysToRemove.push(`@admin_authenticated_${userId}`);
            }
            await AsyncStorage.multiRemove(keysToRemove);
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
        <View style={styles.topHeaderActions}>
          <TouchableOpacity
            style={styles.tourBtn}
            onPress={() => setShowTour(true)}
            activeOpacity={0.75}
          >
            <Sparkles size={14} color="#047857" />
            <Text style={styles.tourBtnText}>Tour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <LogOut size={16} color="#B91C1C" />
          </TouchableOpacity>
        </View>
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

      {/* Admin UI Walkthrough & Interactive Tour Modal */}
      <AdminTourModal
        visible={showTour}
        onClose={handleTourClose}
        onSelectTab={(tab) => setActiveTab(tab)}
      />
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
  topHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tourBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  tourBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
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
