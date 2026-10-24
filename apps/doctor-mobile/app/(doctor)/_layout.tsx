import React from "react";
import { Slot } from "expo-router";
import { ClinicProvider } from "../../contexts/ClinicContext";

export default function DoctorLayout() {
  return (
    <ClinicProvider>
      <Slot />
    </ClinicProvider>
  );
}