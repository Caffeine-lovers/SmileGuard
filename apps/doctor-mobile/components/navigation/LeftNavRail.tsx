/**
 * Icon-only left navigation rail shared by the doctor and assistant dashboards.
 * Same look as the admin console rail: clinic badge on top, section icons centered,
 * app guide and logout at the bottom.
 */

import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Calendar,
  Clock,
  Compass,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react-native";

export type RailTab =
  | "dashboard"
  | "records"
  | "appointments"
  | "appointment-requests"
  | "billing"
  | "settings";

const TABS: { id: RailTab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "records", label: "Records", icon: Users },
  { id: "appointments", label: "Appointments", icon: Calendar },
  { id: "appointment-requests", label: "Requests", icon: Clock },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export const NAV_RAIL_WIDTH = 64;

interface LeftNavRailProps {
  activeTab: string;
  onSelect: (tab: RailTab) => void;
  onTour: () => void;
  onLogout: () => void;
  /** Clinic logo shown at the top of the rail (falls back to a shield icon). */
  logoSource?: any;
  /** Extra space reserved above/below the rail (e.g. status bar / gesture bar). */
  topInset?: number;
  bottomInset?: number;
  /** Tour anchors: the whole rail, and the group of section icons. */
  railRef?: any;
  navRef?: any;
}

export default function LeftNavRail({
  activeTab,
  onSelect,
  onTour,
  onLogout,
  logoSource,
  topInset = 0,
  bottomInset = 0,
  railRef,
  navRef,
}: LeftNavRailProps) {
  return (
    <View
      ref={railRef}
      collapsable={false}
      style={[styles.rail, { top: topInset, bottom: bottomInset }]}
    >
      <View style={styles.railTop}>
        <View style={styles.logoBadge}>
          {logoSource ? (
            <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
          ) : (
            <ShieldCheck size={20} color="#047857" />
          )}
        </View>
      </View>

      <View ref={navRef} collapsable={false} style={styles.railCenter}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onSelect(tab.id)}
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

      <View style={styles.railBottom}>
        <TouchableOpacity
          style={styles.bottomIconBtn}
          onPress={onTour}
          activeOpacity={0.75}
          accessibilityLabel="App guide"
        >
          <Compass size={17} color="#047857" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomIconBtn, styles.logoutBtn]}
          onPress={onLogout}
          activeOpacity={0.75}
          accessibilityLabel="Log out"
        >
          <LogOut size={17} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: NAV_RAIL_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    zIndex: 20,
    elevation: 20,
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
    overflow: "hidden",
  },
  logoImage: {
    width: 28,
    height: 28,
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
});
