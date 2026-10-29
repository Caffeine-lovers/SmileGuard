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
  gender?: string;
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
  status: "pending" | "PENDING" | "scheduled" | "completed" | "cancelled" | "no-show" | "declined";
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

export interface MedicalIntakeData {
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

export type medical_intake = MedicalIntakeData;



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
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: string; // "Male" | "Female" | string (used to identify Dr. vs Dra.)
  doctor_name?: string; // Legacy fallback
  doctor_phone?: string;
  office_hours?: OfficeHours;
  years_of_experience?: number;
  profile_picture_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const EMPTY_DOCTOR: Doctor = {
  user_id: "",
  license_number: "",
  specialization: "",
  bio: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
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
  profile_picture_url: "",
};

/**
 * Helper to get doctor prefix title ("Dr." or "Dra.") based on gender.
 * Defaults to "Dr." if gender is unspecified, male, or non-female.
 * Returns "Dra." when gender is female.
 */
export function getDoctorPrefix(
  doctorOrGender?: { gender?: string | null } | string | null,
  options?: { withDot?: boolean }
): string {
  const withDot = options?.withDot !== false;
  const rawGender =
    typeof doctorOrGender === "string"
      ? doctorOrGender
      : doctorOrGender?.gender;

  const normalized = (rawGender || "").trim().toLowerCase();
  const isFemale =
    normalized === "female" ||
    normalized === "f" ||
    normalized === "dra" ||
    normalized === "dra." ||
    normalized === "doctora";

  if (withDot) {
    return isFemale ? "Dra." : "Dr.";
  }
  return isFemale ? "Dra" : "Dr";
}

/**
 * Helper to construct the full name of a doctor
 */
export function getDoctorFullName(doctor?: {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  doctor_name?: string;
  name?: string;
  gender?: string;
}): string {
  if (!doctor) return "";
  const parts = [doctor.first_name, doctor.middle_name, doctor.last_name]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return doctor.doctor_name || doctor.name || "";
}

/**
 * Helper to construct doctor title with full name: [Dr.|Dra.] [First] [Middle] [Last]
 */
export function getDoctorTitleName(
  doctor?: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    doctor_name?: string;
    name?: string;
    gender?: string;
  },
  options?: { withDot?: boolean }
): string {
  if (!doctor) return "";
  const prefix = getDoctorPrefix(doctor, options);
  const fullName = getDoctorFullName(doctor);
  if (!fullName) return prefix;
  const cleanedName = fullName.replace(/^(?:Dr|Dra)\.?\s+/i, "");
  return `${prefix} ${cleanedName}`.trim();
}

/**
 * Helper to construct doctor display name: first_name, middle initial (if present), and last_name
 */
export function formatDoctorDisplayName(
  doctor?: {
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    gender?: string | null;
  },
  options?: { includePrefix?: boolean; withDot?: boolean }
): string {
  if (!doctor) return "";
  const firstName = (doctor.first_name || "").trim();
  const lastName = (doctor.last_name || "").trim();
  const middleTrimmed = (doctor.middle_name || "").trim();

  let middleInitial = "";
  if (middleTrimmed) {
    const match = middleTrimmed.match(/\p{L}/u);
    if (match) {
      middleInitial = `${match[0].toUpperCase()}.`;
    }
  }

  const parts = [firstName, middleInitial, lastName].filter(Boolean);
  const name = parts.join(" ");
  if (!name) return "";

  if (options?.includePrefix) {
    const prefix = getDoctorPrefix(doctor, { withDot: options.withDot });
    return `${prefix} ${name}`;
  }

  return name;
}


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
  payment_method?: "cash" | "card" | "gcash" | "bank-transfer" | "grab_pay" | "paymaya";
  payment_date?: string;
  created_at?: string;
  updated_at?: string;
}

export function calculateDiscount(
  amount: number,
  discountType?: Billing["discount_type"]
): { discountAmount: number; finalAmount: number } {
  let discountAmount = 0;

  switch (discountType) {
    case "pwd":
    case "senior":
      discountAmount = amount * 0.2; // 20% statutory discount
      break;
    default:
      discountAmount = 0;
  }

  return {
    discountAmount,
    finalAmount: amount - discountAmount,
  };
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

// ─────────────────────────────────────────
// Pre-Flight AI Quality Gate Types
// ─────────────────────────────────────────

export type PreflightRejectionReason =
  | 'NO_TEETH_DETECTED'
  | 'BRACES_DETECTED'
  | 'IMAGE_TOO_BLURRY'
  | 'POOR_LIGHTING'
  | 'NON_DENTAL_SUBJECT'
  | 'FACIAL_FEATURES_DETECTED';

export interface PreflightPatientFeedback {
  headline: string;
  description: string;
  tips: string[];
}

export interface PreflightCheckResult {
  passed: boolean;
  has_teeth: boolean;
  has_braces: boolean;
  is_clear: boolean;
  has_no_facial_features?: boolean;
  rejection_reason?: PreflightRejectionReason | null;
  patient_feedback?: PreflightPatientFeedback | null;
  confidence?: number;
}

