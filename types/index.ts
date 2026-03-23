// Shared type definitions for SmileGuard app

export interface User {
  name: string;
  email: string;
  password: string;
  role: "patient" | "doctor";
  service?: string;
  specialty?: string;
}

export interface CurrentUser {
  id: string;        // Supabase auth UUID — used as patient_id / dentist_id in DB
  name: string;
  email: string;
  role: "patient" | "doctor";
}

// Medical intake — biography & medical history for patient registration
export interface MedicalIntake {
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  currentMedications: string;
  medicalConditions: string;
  pastSurgeries: string;
  smokingStatus: "never" | "former" | "current" | "";
  pregnancyStatus: "yes" | "no" | "na" | "";
}

export const EMPTY_MEDICAL_INTAKE: MedicalIntake = {
  dateOfBirth: "",
  gender: "",
  phone: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  allergies: "",
  currentMedications: "",
  medicalConditions: "",
  pastSurgeries: "",
  smokingStatus: "",
  pregnancyStatus: "",
};

export interface FormData {
  service: string;
  name: string;
  email: string;
  password: string;
  medicalIntake: MedicalIntake;
  doctorAccessCode?: string;
}

export interface PasswordCheck {
  label: string;
  met: boolean;
}

// NOTE: This is the dashboard display type only.
// The real DB appointment type lives in lib/database.ts as Appointment.
export interface AppointmentDisplay {
  id: string;
  service: string;
  date: string;        // formatted display string e.g. "Mar 15, 2026"
  status: "Pending" | "Completed" | "Cancelled";
}