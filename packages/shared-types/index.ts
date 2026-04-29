/**
 * Shared TypeScript Types for SmileGuard
 * Used by both patient-web and doctor-mobile
 */

// ─────────────────────────────────────────
// User & Auth Types
// ─────────────────────────────────────────

export interface CurrentUser {
  id?: string;
  name: string;
  email: string;
  role: "patient" | "doctor";
  service?: string; // Patient's service type (e.g., "Cleaning", "Whitening")
  clinic_id?: string; // Doctor's clinic
}

export interface MedicalIntakeData {
  [key: string]: unknown;
}

export interface FormData {
  service: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  nationality?: string;
  medicalIntake: MedicalIntakeData;
  doctorAccessCode: string;
}

// ─────────────────────────────────────────
// Appointment Types
// ─────────────────────────────────────────

export interface Appointment {
  id?: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM
  status: "scheduled" | "completed" | "cancelled" | "no-show" | "declined";
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────
// Patient Types
// ─────────────────────────────────────────

export interface Patient {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  medical_conditions?: string;
  allergies?: string;
  created_at?: string;
  updated_at?: string;
}

export interface medical_intake {
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies?: string;
  current_medications?: string;
  medical_conditions?: string;
  past_surgeries?: string;
  smoking_status?: string;
  pregnancy_status?: string;
  notes?: string;
}



// ─────────────────────────────────────────
// Doctor Types
// ─────────────────────────────────────────

export interface OfficeHours {
  [day: string]: {
    open: string; // HH:MM format
    close: string; // HH:MM format
    isClosed?: boolean;
  };
}

export interface Doctor {
  id?: string;
  user_id: string;
  license_number: string;
  specialization: string;
  bio?: string;
  doctor_name?: string;
  doctor_phone?: string;
  office_hours?: OfficeHours;
  years_of_experience?: number;
  is_available?: boolean;
  profile_picture_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const EMPTY_DOCTOR: Doctor = {
  user_id: "",
  license_number: "",
  specialization: "",
  bio: "",
  doctor_name: "",
  doctor_phone: "",
  office_hours: {
    monday: { open: "09:00", close: "17:00" },
    tuesday: { open: "09:00", close: "17:00" },
    wednesday: { open: "09:00", close: "17:00" },
    thursday: { open: "09:00", close: "17:00" },
    friday: { open: "09:00", close: "17:00" },
    saturday: {
      isClosed: true,
      open: "",
      close: ""
    },
    sunday: {
      isClosed: true,
      open: "",
      close: ""
    },
  },
  years_of_experience: 0,
  is_available: true,
  profile_picture_url: "",
};

// ─────────────────────────────────────────
// Treatment Types
// ─────────────────────────────────────────

export interface Treatment {
  id?: string;
  patient_id: string;
  dentist_id: string;
  procedure_name: string;
  description?: string;
  status: "pending" | "in-progress" | "completed";
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────
// Billing Types
// ─────────────────────────────────────────

export interface Billing {
  id?: string;
  patient_id: string;
  appointment_id?: string;
  amount: number;
  discount_type?: "none" | "pwd" | "senior" | "insurance";
  discount_amount?: number;
  final_amount: number;
  payment_status: "pending" | "paid" | "overdue";
  payment_method?: "cash" | "card" | "gcash" | "bank-transfer";
  payment_date?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────
// Password Validation
// ─────────────────────────────────────────

export interface PasswordCheck {
  label: string;
  met: boolean;
}

export interface PasswordCheckDetailed {
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  length: boolean;
}

export const emptyPasswordCheckDetailed = (): PasswordCheckDetailed => ({
  hasUpperCase: false,
  hasLowerCase: false,
  hasNumber: false,
  hasSpecialChar: false,
  length: false,
});

export function checkPasswordStrengthDetailed(password: string): PasswordCheckDetailed {
  return {
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    length: password.length >= 8,
  };
}

export function isPasswordStrongDetailed(check: PasswordCheckDetailed): boolean {
  return Object.values(check).every((v) => v === true);
}

// ─────────────────────────────────────────
// Image Analysis Types
// ─────────────────────────────────────────

export interface ImageAnalysis {
  id?: string;
  patient_id: string;
  image_url?: string;
  status: "pending" | "processing" | "completed" | "failed";
  detections?: Detection[];
  analysis_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Detection {
  id?: string;
  analysis_id?: string;
  type: "cavity" | "crack" | "discoloration" | "gingivitis" | "ulcer" | "lesion" | "inflammation";
  confidence: number; // 0-1
  location?: string; // e.g., "tooth_12" or "upper_left"
  description?: string;
  recommendation?: string;
}

// ─────────────────────────────────────────
// Pending Transaction (for offline sync)
// ─────────────────────────────────────────

export interface PendingTransaction {
  id: string;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}
