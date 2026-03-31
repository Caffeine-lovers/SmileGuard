import React from "react";
import {
  View,
  Alert,
  StyleSheet,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  AppointmentCard,
  Navbar,
  PatientDetailCard,
  RequestListItem,
  SectionHeader,
  ScreenHeading,
} from "./index";
import StatCard from "./StatCard.tsx";
import { CurrentUser } from "@smileguard/shared-types";
import { theme } from "../../constants/theme.ts";

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);

  const handleAppointmentPress = (id: string, name: string) => {
    setSelectedAppointmentId(id);
    Alert.alert("Appointment Selected", `You selected ${name}'s appointment.`);
  };

  const handleRequestAccept = (id: string) => {
    Alert.alert("Request Accepted", `Request ${id} has been accepted.`);
  };

  const handleRequestReject = (id: string) => {
    Alert.alert("Request Rejected", `Request ${id} has been rejected.`);
  };

  // Mock data - in production, fetch from API
  const appointments = [
    { id: "apt-1", name: "Mart Emman", service: "Whitening", time: "10:00", status: "upcoming" as const },
    { id: "apt-2", name: "Jendri Jacin", service: "Aligners", time: "13:00", status: "confirmed" as const },
    { id: "apt-3", name: "Kyler Per", service: "Root Canals", time: "15:00", status: "upcoming" as const },
  ];

  const requests = [
    { id: "req-1", name: "Marie Yan", requestType: "Cleaning" },
    { id: "req-2", name: "Alex Johnson", requestType: "Consultation" },
  ];

  const nextPatient = appointments[0];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <Navbar onLogout={onLogout} showLogout={true} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <ScreenHeading title="Quick Actions" />

            {/* Stats Panel */}
            <View style={styles.statsPanel}>
              <StatCard number={67} label="Patients" />
              <StatCard number={21} label="Appointments" />
              <StatCard number={911} label="Treatments" />
            </View>

            {/* Appointments Section */}
            <View style={styles.section}>
              <SectionHeader 
                label="Today Appointments:" 
                actionLabel="See more"
                onActionPress={() => Alert.alert("See more appointments")}
              />
              {appointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  id={apt.id}
                  name={apt.name}
                  service={apt.service}
                  time={apt.time}
                  status={apt.status}
                  isSelected={selectedAppointmentId === apt.id}
                  onPress={() => handleAppointmentPress(apt.id, apt.name)}
                />
              ))}
            </View>

            {/* Next Patient Details Section */}
            <View style={styles.section}>
              <SectionHeader label="Next Patient Details:" />
              <PatientDetailCard
                patientName={nextPatient.name}
                service={nextPatient.service}
                time={nextPatient.time}
                age={41}
                gender="Male"
                contact="0919-345-6789"
                email="kyler@email.com"
                notes="Follow-up appointment. Patient requests extra numbing gel. History of sensitivity."
              />
            </View>

            {/* Requests Section */}
            <View style={styles.section}>
              <SectionHeader label="Requests:" />
              {requests.map((req) => (
                <RequestListItem
                  key={req.id}
                  id={req.id}
                  name={req.name}
                  requestType={req.requestType}
                  onAccept={handleRequestAccept}
                  onReject={handleRequestReject}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors["bg-screen"],
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: theme.spacing.screenHorizontalPadding,
    paddingVertical: theme.spacing.sectionVerticalGap,
  },
  statsPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: theme.spacing.sectionVerticalGap,
  },
  section: {
    marginBottom: theme.spacing.sectionVerticalGap,
  },
});
