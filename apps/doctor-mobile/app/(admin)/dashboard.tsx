import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@smileguard/supabase-client";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import {
  Building2,
  KeyRound,
  Stethoscope,
  Users,
  LifeBuoy,
  ListChecks,
  LogOut,
  Sparkles,
  ShieldCheck,
} from "lucide-react-native";
import ClinicOverviewTab from "../../components/admin/ClinicOverviewTab";
import AccessCodesTab from "../../components/admin/AccessCodesTab";
import DentistAccountsTab from "../../components/admin/DentistAccountsTab";
import PatientAccountsTab from "../../components/admin/PatientAccountsTab";
import SupportRequestsTab from "../../components/admin/SupportRequestsTab";
import AttemptLogTab from "../../components/admin/AttemptLogTab";
import AdminTourModal from "../../components/admin/AdminTourModal";

export type AdminTab = "clinic" | "codes" | "dentists" | "patients" | "support" | "attempts";

interface TabMeta {
  id: AdminTab;
  label: string;
  icon: any;
}

const TABS: TabMeta[] = [
  {
    id: "clinic",
    label: "Clinic",
    icon: Building2,
  },
  {
    id: "codes",
    label: "Access Codes",
    icon: KeyRound,
  },
  {
    id: "dentists",
    label: "Staff",
    icon: Stethoscope,
  },
  {
    id: "patients",
    label: "Patients",
    icon: Users,
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
  },
  {
    id: "attempts",
    label: "Audit Log",
    icon: ListChecks,
  },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("clinic");
  const [showTour, setShowTour] = useState(false);

  const handleTourClose = () => {
    setShowTour(false);
  };

  const handleLogout = () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            const keysToRemove = [
              "supabase.auth.token",
              "supabase.auth.refreshToken",
              "supabase.auth.user",
              "@pending_doctor_access_code",
              "@pending_user_role",
            ];
            await AsyncStorage.multiRemove(keysToRemove);
          } catch (err) {
            console.error("[AdminDashboard] Logout error:", err);
          }
        },
      },
    ]);
  };

  const currentTabMeta = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.appShell}>
        {/* Left Navigation Pane (Icons Only, Originating from Middle Outwards) */}
        <View style={styles.leftNavRail}>
          {/* Top Anchor: Clinic Shield Badge */}
          <View style={styles.railTop}>
            <View style={styles.logoBadge}>
              <ShieldCheck size={20} color="#047857" />
            </View>
          </View>

          {/* Center: Navigation Icons Centered Vertically (Originating from Middle Outwards) */}
          <View style={styles.railCenter}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={styles.navItem}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.75}
                  accessibilityLabel={tab.label}
                >
                  <View style={[styles.navIconBtn, isActive && styles.navIconBtnActive]}>
                    <Icon
                      size={20}
                      color={isActive ? "#FFFFFF" : "#64748B"}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom Actions: Tour Guide & Logout */}
          <View style={styles.railBottom}>
            <TouchableOpacity
              style={styles.bottomIconBtn}
              onPress={() => setShowTour(true)}
              activeOpacity={0.75}
              accessibilityLabel="UI Tour Guide"
            >
              <Sparkles size={17} color="#047857" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomIconBtn, styles.logoutBtn]}
              onPress={handleLogout}
              activeOpacity={0.75}
              accessibilityLabel="Sign Out"
            >
              <LogOut size={17} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Main Content Pane */}
        <View style={styles.mainContent}>
          {/* Top Bar with Section Title & Clinic Status */}
          <View style={styles.contentHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {currentTabMeta.label}
              </Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>ADMIN</Text>
            </View>
          </View>

          {/* Active Tab Screen */}
          <View style={styles.tabBody}>
            <Animated.View
              key={activeTab}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(100)}
              style={styles.tabBodyInner}
            >
              {activeTab === "clinic" && <ClinicOverviewTab onOpenTab={setActiveTab} />}
              {activeTab === "codes" && <AccessCodesTab />}
              {activeTab === "dentists" && <DentistAccountsTab />}
              {activeTab === "patients" && <PatientAccountsTab />}
              {activeTab === "support" && <SupportRequestsTab />}
              {activeTab === "attempts" && <AttemptLogTab />}
            </Animated.View>
          </View>
        </View>
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
  appShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
  },
  leftNavRail: {
    width: 64,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  railTop: {
    alignItems: "center",
    paddingTop: 4,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  railCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  navIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  navIconBtnActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  railBottom: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 4,
  },
  bottomIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  mainContent: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#F8FAFC",
  },
  contentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerBadge: {
    backgroundColor: "#047857",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  tabBody: {
    flex: 1,
    position: "relative",
  },
  tabBodyInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
  },
});
