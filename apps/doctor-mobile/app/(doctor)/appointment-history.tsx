import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppointmentHistory from "../../components/appointments/appointmentHistory";

export default function AppointmentHistoryPage() {
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams();

  return (
    <AppointmentHistory
      patientId={patientId as string}
      patientName={patientName as string}
      onBack={() => router.back()}
    />
  );
}
