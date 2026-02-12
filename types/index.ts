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
  name: string;
  email: string;
  role: "patient" | "doctor";
}

// Medical intake — biography & medical history for patient registration
export interface MedicalIntake {
  // Biography
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;

  // Medical History
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
  // Doctor registration — access code required
  doctorAccessCode?: string;
}

// Password strength helper
export interface PasswordCheck {
  label: string;
  met: boolean;
}

export interface Appointment {
  id: string;
  service: string;
  date: string;
  status: "Pending" | "Completed";
}

