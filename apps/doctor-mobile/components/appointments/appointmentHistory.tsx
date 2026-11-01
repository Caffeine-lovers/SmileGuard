import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react-native";
import { getPatientAppointments } from "../../lib/profilesPatients";
import { getStatusColor, getStatusBgColor, getStatusLabel } from "../../lib/statusHelpers";
import { formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";
import AppointmentEdit from "./appointmentEdit";

interface AppointmentHistoryProps {
  patientId: string;
  patientName: string;
  doctorId?: string;
  onBack: () => void;
}

const categorizeAppointments = (appointments: any[]) => {
  // Get today's date at midnight in local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const past: any[] = [];
  const current: any[] = [];
  const future: any[] = [];

  appointments.forEach((appt) => {
    if (!appt?.appointment_date) {
      past.push(appt);
      return;
    }
    // Parse appointment_date string (format: YYYY-MM-DD)
    const cleanDate = String(appt.appointment_date).split("T")[0];
    const dateParts = cleanDate.split("-");
    if (dateParts.length < 3) {
      past.push(appt);
      return;
    }
    const apptDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );
    apptDate.setHours(0, 0, 0, 0);

    const timeDiff = apptDate.getTime() - today.getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) {
      // Same day = current/today
      current.push(appt);
    } else if (daysDiff > 0) {
      // Future dates
      future.push(appt);
    } else {
      // Past dates
      past.push(appt);
    }
  });

  return { past, current, future };
};

function AppointmentCard({
  appointment,
  onEdit,
}: {
  appointment: any;
  onEdit: (appt: any) => void;
}) {
  const status = ((appointment.status || "scheduled") as string).toLowerCase();
  const statusColor = getStatusColor(status);
  const statusBg = getStatusBgColor(status);
  const statusLabel = getStatusLabel(status);

  const dateValue = appointment.appointment_date || appointment.date;
  const timeValue = appointment.appointment_time || appointment.time;

  return (
    <View style={styles.appointmentCard}>
      {/* Top Header Row: Service + Status + Edit */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardService} numberOfLines={1}>
            {appointment.service || "General Dental Treatment"}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusBg, borderColor: statusColor },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => onEdit(appointment)}
          activeOpacity={0.8}
        >
          <Text style={styles.editButtonText}>EDIT</Text>
        </TouchableOpacity>
      </View>

      {/* Date & Time Meta Row */}
      <View style={styles.cardMetaRow}>
        <View style={styles.metaItem}>
          <Calendar size={12} color="#64748B" />
          <Text style={styles.metaText}>
            {formatAppointmentDate(dateValue)}
          </Text>
        </View>

        <Text style={styles.metaDot}>•</Text>

        <View style={styles.metaItem}>
          <Clock size={12} color="#64748B" />
          <Text style={styles.metaText}>
            {formatAppointmentTime(timeValue)}
          </Text>
        </View>
      </View>

      {/* Notes / Clinical Callout if present */}
      {appointment.notes ? (
        <View style={styles.cardNotesBox}>
          <View style={styles.cardNotesHeader}>
            <FileText size={11} color="#64748B" />
            <Text style={styles.cardNotesLabel}>CLINICAL REMARKS</Text>
          </View>
          <Text style={styles.cardNotesText}>{appointment.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function AppointmentHistory({
  patientId,
  patientName,
  doctorId,
  onBack,
}: AppointmentHistoryProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "current" | "future" | "past">("all");
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, [patientId]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const appts = await getPatientAppointments(patientId);
      setAppointments(appts || []);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAppointment = (appointment: any) => {
    setEditingAppointment(appointment);
    setShowEditModal(true);
  };

  const handleSaveAppointment = () => {
    loadAppointments();
  };

  const { past, current, future } = categorizeAppointments(appointments);

  const getFilteredAppointments = () => {
    switch (activeTab) {
      case "current":
        return current;
      case "future":
        return future;
      case "past":
        return past;
      case "all":
      default:
        return appointments;
    }
  };

  const filteredAppointments = getFilteredAppointments();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top Application Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color="#047857" />
          <Text style={styles.backButtonText}>BACK</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>APPOINTMENT HISTORY</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {patientName || "Patient Records"}
          </Text>
        </View>

        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{appointments.length}</Text>
        </View>
      </View>

      {/* Segmented Filter Control */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "all" && styles.activeTab]}
            onPress={() => setActiveTab("all")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "all" && styles.activeTabText]}>
              All ({appointments.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "current" && styles.activeTab]}
            onPress={() => setActiveTab("current")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "current" && styles.activeTabText]}>
              Today ({current.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "future" && styles.activeTab]}
            onPress={() => setActiveTab("future")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "future" && styles.activeTabText]}>
              Upcoming ({future.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "past" && styles.activeTab]}
            onPress={() => setActiveTab("past")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "past" && styles.activeTabText]}>
              Past ({past.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading appointment history...</Text>
          </View>
        ) : filteredAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Calendar size={28} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === "all"
                ? "No Appointments Found"
                : `No ${activeTab === "current" ? "Today's" : activeTab === "future" ? "Upcoming" : "Past"} Appointments`}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === "all"
                ? "This patient does not have any recorded visits or consultations yet."
                : `There are currently no appointments categorized under ${activeTab}.`}
            </Text>
          </View>
        ) : (
          <>
            {/* When "ALL" tab is selected: show categorized blocks */}
            {activeTab === "all" ? (
              <>
                {current.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.categoryHeaderRow}>
                      <View style={styles.categoryTitleGroup}>
                        <Clock size={13} color="#047857" />
                        <Text style={styles.categoryTitle}>TODAY'S VISITS</Text>
                      </View>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{current.length}</Text>
                      </View>
                    </View>
                    {current.map((appt: any) => (
                      <AppointmentCard
                        key={appt.id}
                        appointment={appt}
                        onEdit={handleEditAppointment}
                      />
                    ))}
                  </View>
                )}

                {future.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.categoryHeaderRow}>
                      <View style={styles.categoryTitleGroup}>
                        <Calendar size={13} color="#0369A1" />
                        <Text style={[styles.categoryTitle, { color: "#0369A1" }]}>
                          UPCOMING APPOINTMENTS
                        </Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD" }]}>
                        <Text style={[styles.countBadgeText, { color: "#0369A1" }]}>
                          {future.length}
                        </Text>
                      </View>
                    </View>
                    {future.map((appt: any) => (
                      <AppointmentCard
                        key={appt.id}
                        appointment={appt}
                        onEdit={handleEditAppointment}
                      />
                    ))}
                  </View>
                )}

                {past.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <View style={styles.categoryHeaderRow}>
                      <View style={styles.categoryTitleGroup}>
                        <CheckCircle2 size={13} color="#64748B" />
                        <Text style={[styles.categoryTitle, { color: "#475569" }]}>
                          PAST VISITS
                        </Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }]}>
                        <Text style={[styles.countBadgeText, { color: "#475569" }]}>
                          {past.length}
                        </Text>
                      </View>
                    </View>
                    {past.map((appt: any) => (
                      <AppointmentCard
                        key={appt.id}
                        appointment={appt}
                        onEdit={handleEditAppointment}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              /* When a specific filter tab is active */
              <View style={styles.sectionBlock}>
                {filteredAppointments.map((appt: any) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    onEdit={handleEditAppointment}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <AppointmentEdit
          visible={showEditModal}
          appointment={editingAppointment}
          doctorId={doctorId || editingAppointment.dentist_id || ""}
          onClose={() => {
            setShowEditModal(false);
            setEditingAppointment(null);
          }}
          onSave={handleSaveAppointment}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderBottomWidth: 2,
    borderBottomColor: "#059669",
    gap: 2,
  },
  backButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },
  headerTitleWrap: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#047857",
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 1,
  },
  totalBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
  },

  // Segmented Tabs
  tabsWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#F8FAFC",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#EDF2F7",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 3,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderBottomWidth: 2,
    borderBottomColor: "#047857",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.2,
  },
  activeTabText: {
    color: "#0F172A",
    fontWeight: "800",
  },

  // Main Container
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
  },

  // Loading & Empty States
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 70,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#047857",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260,
  },

  // Section Groupings
  sectionBlock: {
    marginTop: 10,
    marginBottom: 4,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  categoryTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.6,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },

  // Modernized Skeuomorphic Appointment Card
  appointmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 13,
    marginBottom: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
    flexWrap: "wrap",
  },
  cardService: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3.5,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  editButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#10B981",
    borderBottomWidth: 2,
    borderBottomColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.4,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
  },
  metaDot: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "700",
  },
  cardNotesBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardNotesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  cardNotesLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  cardNotesText: {
    fontSize: 11.5,
    color: "#334155",
    fontWeight: "500",
    lineHeight: 16,
  },
});
