/**
 * Full-screen, swipeable deck of pending appointment requests for the clinic assistant.
 * One patient fills the screen at a time: swipe right (or tap ✓) to accept,
 * swipe left (or tap ✕) to decline. Requests arrive already sorted oldest-first.
 */

import React, { useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Phone,
  Stethoscope,
  X,
} from "lucide-react-native";
import { formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";
import type { DashboardAppointment } from "./AssistantDashboard";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 90;
const FLY_DISTANCE = SCREEN_WIDTH * 1.3;

interface RequestDeckProps {
  requests: DashboardAppointment[];
  onAccept: (request: DashboardAppointment) => void;
  onDecline: (request: DashboardAppointment) => void;
}

function formatRequestedAt(createdAt?: string): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
    </View>
  );
}

/** The patient profile shown on a card (same details as the dashboard's Patient Details panel). */
function PatientCardBody({ request }: { request: DashboardAppointment }) {
  const intake = request.medicalIntake;
  const requestedAt = formatRequestedAt(request.created_at);
  const isPwdApproved = intake?.pwd_status === "approved";
  const isPwdPending = intake?.pwd_status === "pending";

  return (
    <>
      <View style={styles.profileHeader}>
        <Image
          source={
            typeof request.imageUrl === "string" && request.imageUrl.length > 0
              ? { uri: request.imageUrl }
              : require("../../assets/images/user.png")
          }
          style={styles.avatar}
        />
        <Text style={styles.name} numberOfLines={2}>
          {request.name}
        </Text>
        {requestedAt ? (
          <View style={styles.requestedPill}>
            <Clock size={11} color="#B45309" />
            <Text style={styles.requestedText}>Requested {requestedAt}</Text>
          </View>
        ) : null}

        {request.contact ? (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${request.contact}`)}
            activeOpacity={0.8}
          >
            <Phone size={12} color="#047857" />
            <Text style={styles.callBtnText}>Call {request.contact}</Text>
          </TouchableOpacity>
        ) : request.email ? (
          <Text style={styles.emailText}>{request.email}</Text>
        ) : null}

        {isPwdApproved && (
          <View style={styles.pwdApproved}>
            <Text style={styles.pwdApprovedText}>
              ✓ {intake?.pwd_type === "senior" ? "Senior Citizen" : "PWD"}
            </Text>
          </View>
        )}
        {isPwdPending && (
          <View style={styles.pwdPending}>
            <Text style={styles.pwdPendingText}>Senior / PWD under review</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionBox}>
        <View style={styles.sectionHeader}>
          <Calendar size={13} color="#047857" />
          <Text style={styles.sectionTitle}>APPOINTMENT</Text>
        </View>
        <InfoRow label="Service" value={request.service || "General Dental"} />
        <InfoRow label="Date" value={formatAppointmentDate(request.date) || "Not set"} />
        <InfoRow
          label="Time"
          value={request.time ? formatAppointmentTime(request.time) : "Not set"}
          highlight
        />
        {request.notes ? <InfoRow label="Notes" value={request.notes} /> : null}
      </View>

      <View style={[styles.sectionBox, styles.alertBox]}>
        <View style={styles.sectionHeader}>
          <AlertTriangle size={13} color="#B45309" />
          <Text style={[styles.sectionTitle, { color: "#92400E" }]}>HEALTH ALERTS</Text>
        </View>

        {intake?.allergies ? (
          <View style={styles.allergyCard}>
            <Text style={styles.allergyLabel}>ALLERGIES</Text>
            <Text style={styles.allergyValue}>{intake.allergies}</Text>
          </View>
        ) : (
          <View style={styles.safeRow}>
            <CheckCircle2 size={13} color="#059669" />
            <Text style={styles.safeText}>No known allergies reported</Text>
          </View>
        )}

        {intake?.medicalConditions ? (
          <InfoRow label="Conditions" value={intake.medicalConditions} />
        ) : null}
        {intake?.currentMedications ? (
          <InfoRow label="Medications" value={intake.currentMedications} />
        ) : null}
        {intake?.pastSurgeries ? <InfoRow label="Surgeries" value={intake.pastSurgeries} /> : null}
        {intake?.emergencyContactName || intake?.emergencyContactPhone ? (
          <InfoRow
            label="Emergency"
            value={`${intake?.emergencyContactName || "Family Member"} (${
              intake?.emergencyContactPhone || "No number"
            })`}
          />
        ) : null}
      </View>

      {intake?.gender || intake?.dateOfBirth || intake?.address ? (
        <View style={styles.sectionBox}>
          <View style={styles.sectionHeader}>
            <Stethoscope size={13} color="#047857" />
            <Text style={styles.sectionTitle}>PATIENT INFO</Text>
          </View>
          {intake?.gender ? <InfoRow label="Gender" value={intake.gender} /> : null}
          {intake?.dateOfBirth ? <InfoRow label="Birthday" value={intake.dateOfBirth} /> : null}
          {intake?.address ? <InfoRow label="Address" value={intake.address} /> : null}
        </View>
      ) : null}
    </>
  );
}

function TopCard({
  request,
  onAccept,
  onDecline,
}: {
  request: DashboardAppointment;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false);

  const flyOut = (direction: 1 | -1) => {
    if (busy.current) return;
    busy.current = true;
    Animated.timing(pan, {
      toValue: { x: direction * FLY_DISTANCE, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (direction === 1) onAccept();
      else onDecline();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          !busy.current && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderMove: (_, g) => {
          pan.setValue({ x: g.dx, y: 0 });
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD) flyOut(1);
          else if (g.dx < -SWIPE_THRESHOLD) flyOut(-1);
          else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              friction: 6,
              tension: 40,
              useNativeDriver: false,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-10deg", "0deg", "10deg"],
  });
  const acceptOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const declineOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.card, { transform: [{ translateX: pan.x }, { rotate }] }]}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <PatientCardBody request={request} />
        </ScrollView>

        <Animated.View
          pointerEvents="none"
          style={[styles.stamp, styles.stampAccept, { opacity: acceptOpacity }]}
        >
          <Text style={[styles.stampText, { color: "#047857" }]}>ACCEPT</Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.stamp, styles.stampDecline, { opacity: declineOpacity }]}
        >
          <Text style={[styles.stampText, { color: "#DC2626" }]}>DECLINE</Text>
        </Animated.View>
      </Animated.View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.declineBtn]}
          onPress={() => flyOut(-1)}
          activeOpacity={0.85}
          accessibilityLabel="Decline request"
        >
          <X size={26} color="#DC2626" strokeWidth={2.6} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.acceptBtn]}
          onPress={() => flyOut(1)}
          activeOpacity={0.85}
          accessibilityLabel="Accept request"
        >
          <Check size={28} color="#FFFFFF" strokeWidth={2.8} />
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function RequestDeck({ requests, onAccept, onDecline }: RequestDeckProps) {
  if (requests.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Inbox size={34} color="#047857" />
        </View>
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyText}>No pending booking requests right now.</Text>
      </View>
    );
  }

  const top = requests[0];
  const next = requests[1];

  return (
    <View style={styles.deck}>
      <Text style={styles.counter}>
        {requests.length} {requests.length === 1 ? "request" : "requests"} · oldest first
      </Text>

      <View style={styles.stack}>
        {next ? (
          <View style={[styles.card, styles.cardBehind]} pointerEvents="none">
            <View style={styles.behindPeek}>
              <Text style={styles.behindName} numberOfLines={1}>
                {next.name}
              </Text>
              <Text style={styles.behindService} numberOfLines={1}>
                {next.service || "General Dental"}
              </Text>
            </View>
          </View>
        ) : null}

        <TopCard
          key={top.id}
          request={top}
          onAccept={() => onAccept(top)}
          onDecline={() => onDecline(top)}
        />
      </View>

      <Text style={styles.hint}>Swipe right to accept · left to decline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  counter: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#64748B",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  stack: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  cardBehind: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    bottom: 96,
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  behindPeek: { padding: 16 },
  behindName: { fontSize: 15, fontWeight: "800", color: "#334155" },
  behindService: { fontSize: 12, color: "#64748B", marginTop: 2 },
  cardContent: { padding: 18, paddingBottom: 28 },
  profileHeader: { alignItems: "center", marginBottom: 14 },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
    marginBottom: 10,
  },
  name: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  requestedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  requestedText: { fontSize: 11, fontWeight: "700", color: "#B45309" },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  callBtnText: { fontSize: 12, fontWeight: "700", color: "#047857" },
  emailText: { marginTop: 10, fontSize: 12, color: "#64748B" },
  pwdApproved: {
    marginTop: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pwdApprovedText: { fontSize: 11, fontWeight: "800", color: "#047857" },
  pwdPending: {
    marginTop: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pwdPendingText: { fontSize: 11, fontWeight: "800", color: "#B45309" },
  sectionBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  alertBox: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, color: "#047857" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  infoLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  infoValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  infoValueHighlight: { color: "#047857", fontWeight: "800" },
  allergyCard: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
  },
  allergyLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6, color: "#B91C1C" },
  allergyValue: { fontSize: 13, fontWeight: "700", color: "#7F1D1D", marginTop: 2 },
  safeRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  safeText: { fontSize: 12, fontWeight: "600", color: "#047857" },
  stamp: {
    position: "absolute",
    top: 26,
    borderWidth: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  stampAccept: { left: 20, borderColor: "#047857", transform: [{ rotate: "-12deg" }] },
  stampDecline: { right: 20, borderColor: "#DC2626", transform: [{ rotate: "12deg" }] },
  stampText: { fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 36, paddingTop: 14 },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  declineBtn: { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#FECACA" },
  acceptBtn: { backgroundColor: "#10B981" },
  hint: {
    textAlign: "center",
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 10,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  emptyText: { fontSize: 13, color: "#64748B", marginTop: 4, textAlign: "center" },
});
