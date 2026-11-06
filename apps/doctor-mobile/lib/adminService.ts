/**
 * Admin Service - Database operations for the admin console
 * (doctor-mobile app, (admin) route group)
 */

import { supabase } from "@smileguard/supabase-client";

// ─────────────────────────────────────────
// Access Codes
// ─────────────────────────────────────────

export interface DoctorAccessCode {
  id: string;
  code: string;
  label: string | null;
  tier: string;
  is_active: boolean;
  created_at: string;
}

// Rows without a code are legacy hashed entries that can no longer be used.
export async function listAccessCodes(): Promise<DoctorAccessCode[]> {
  const { data, error } = await supabase
    .from("doctor_access_codes")
    .select("id, code, label, tier, is_active, created_at")
    .not("code", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DoctorAccessCode[];
}

export async function regenerateAccessCode(id: string): Promise<DoctorAccessCode> {
  const { data, error } = await supabase.rpc("regenerate_access_code", { p_id: id });
  if (error) throw new Error(error.message);
  return data as DoctorAccessCode;
}

export async function createAccessCode(
  code: string,
  label: string,
  tier: "doctor" | "assistant"
): Promise<DoctorAccessCode | null> {
  const { data, error } = await supabase
    .from("doctor_access_codes")
    .insert([{ code: code.trim().toUpperCase(), label: label.trim(), tier, is_active: true }])
    .select()
    .single();

  if (error) {
    console.error("[AdminService] Error creating access code:", error);
    throw new Error(error.message);
  }
  return data as DoctorAccessCode;
}

export async function deleteAccessCode(id: string): Promise<boolean> {
  const { error } = await supabase.from("doctor_access_codes").delete().eq("id", id);
  if (error) {
    console.error("[AdminService] Error deleting access code:", error);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// Dentist / Assistant Accounts
// ─────────────────────────────────────────

export interface AdminDoctorRow {
  id: string;
  user_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  role: string | null;
  specialization: string | null;
  license_number: string | null;
  is_verified: boolean | null;
  created_at: string;
}

export async function listDentists(): Promise<AdminDoctorRow[]> {
  const { data, error } = await supabase
    .from("doctors")
    .select("id, user_id, first_name, middle_name, last_name, role, specialization, license_number, is_verified, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AdminService] Error listing dentists:", error);
    return [];
  }
  return (data || []) as AdminDoctorRow[];
}

export async function setDoctorVerified(doctorId: string, isVerified: boolean): Promise<boolean> {
  const { error } = await supabase.from("doctors").update({ is_verified: isVerified }).eq("id", doctorId);
  if (error) {
    console.error("[AdminService] Error setting doctor verified:", error);
    return false;
  }
  return true;
}

export async function deleteDoctorAccount(doctorId: string, userId: string): Promise<boolean> {
  const { error: doctorError } = await supabase.from("doctors").delete().eq("id", doctorId);
  if (doctorError) {
    console.error("[AdminService] Error deleting doctor record:", doctorError);
    return false;
  }

  const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId);
  if (profileError) {
    console.warn("[AdminService] Doctor record removed but profile delete failed:", profileError);
  }
  return true;
}

// ─────────────────────────────────────────
// Patient Accounts
// ─────────────────────────────────────────

export interface AdminPatientRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

export async function listPatients(search?: string): Promise<AdminPatientRow[]> {
  let query = supabase
    .from("profiles")
    .select("id, name, email, role, created_at")
    .eq("role", "patient")
    .order("created_at", { ascending: false });

  if (search && search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[AdminService] Error listing patients:", error);
    return [];
  }
  return (data || []) as AdminPatientRow[];
}

export async function deletePatientAccount(profileId: string): Promise<boolean> {
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) {
    console.error("[AdminService] Error deleting patient account:", error);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// Support Requests
// ─────────────────────────────────────────

export interface SupportRequest {
  id: string;
  requester_id: string | null;
  requester_role: string | null;
  source_platform: string | null;
  subject: string | null;
  message: string | null;
  status: "open" | "in_progress" | "resolved";
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  requester?: { name: string | null; email: string | null } | null;
}

export async function listSupportRequests(status?: SupportRequest["status"]): Promise<SupportRequest[]> {
  let query = supabase
    .from("support_requests")
    .select("*, requester:profiles!support_requests_requester_id_fkey(name, email)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[AdminService] Error listing support requests:", error);
    return [];
  }
  return (data || []) as SupportRequest[];
}

export async function resolveSupportRequest(
  id: string,
  resolvedBy: string,
  resolutionNote: string
): Promise<boolean> {
  const { error } = await supabase
    .from("support_requests")
    .update({
      status: "resolved",
      resolved_by: resolvedBy,
      resolution_note: resolutionNote.trim(),
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[AdminService] Error resolving support request:", error);
    return false;
  }
  return true;
}

export async function setSupportRequestStatus(
  id: string,
  status: SupportRequest["status"]
): Promise<boolean> {
  const { error } = await supabase.from("support_requests").update({ status }).eq("id", id);
  if (error) {
    console.error("[AdminService] Error updating support request status:", error);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────
// Audit Log (read-only)
// ─────────────────────────────────────────

export interface DoctorCodeAttempt {
  id: string;
  event: string | null;
  user_id: string | null;
  code: string | null;
  attempted_code: string | null;
  is_successful: boolean;
  ip_address: string | null;
  details: Record<string, any> | null;
  created_at: string;
  actor_name?: string | null;
}

// Rows without an event value are legacy rate-limit counters, not audit entries.
export async function listCodeAttempts(limit = 200): Promise<DoctorCodeAttempt[]> {
  const { data, error } = await supabase
    .from("doctor_code_attempts")
    .select("id, event, user_id, code, attempted_code, is_successful, ip_address, details, created_at")
    .or("attempted_code.not.is.null,event.neq.verification")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const attempts = (data || []) as DoctorCodeAttempt[];
  const userIds = Array.from(new Set(attempts.map((a) => a.user_id).filter(Boolean))) as string[];
  if (userIds.length === 0) return attempts;

  const { data: people } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
  const names = new Map((people || []).map((p) => [p.id, p.name || p.email]));
  return attempts.map((a) => ({ ...a, actor_name: a.user_id ? names.get(a.user_id) ?? null : null }));
}

// ─────────────────────────────────────────
// Clinic Overview
// ─────────────────────────────────────────

export interface ClinicOverview {
  clinic: {
    id: string;
    clinic_name: string | null;
    address: string | null;
    logo_url: string | null;
    services: unknown;
    updated_at: string | null;
  } | null;
  staffCount: number;
  patientCount: number;
  walkInCount: number;
  upcomingAppointments: number;
  totalAppointments: number;
  openFeedback: number;
}

async function countRows(table: string, apply?: (query: any) => any): Promise<number> {
  const base = supabase.from(table).select("id", { count: "exact", head: true });
  const { count, error } = await (apply ? apply(base) : base);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

export async function getClinicOverview(): Promise<ClinicOverview> {
  const today = new Date().toISOString().split("T")[0];
  const [clinicResult, staffCount, patientCount, walkInCount, upcomingAppointments, totalAppointments, openFeedback] =
    await Promise.all([
      supabase.from("clinic_setup").select("id, clinic_name, address, logo_url, services, updated_at").limit(1).maybeSingle(),
      countRows("doctors"),
      countRows("profiles", (q) => q.eq("role", "patient")),
      countRows("dummy_patients"),
      countRows("appointments", (q) => q.gte("appointment_date", today).neq("status", "cancelled")),
      countRows("appointments"),
      countRows("support_requests", (q) => q.neq("status", "resolved")),
    ]);

  if (clinicResult.error) throw new Error(clinicResult.error.message);

  return {
    clinic: clinicResult.data,
    staffCount,
    patientCount,
    walkInCount,
    upcomingAppointments,
    totalAppointments,
    openFeedback,
  };
}

// ─────────────────────────────────────────
// Patient Profile (read-only)
// ─────────────────────────────────────────

export interface PatientOverview {
  appointments: {
    id: string;
    service: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    status: string | null;
  }[];
  appointmentCount: number;
  billingCount: number;
  unpaidBillingCount: number;
  documentCount: number;
  scanCount: number;
  hasMedicalIntake: boolean;
  feedback: Pick<SupportRequest, "id" | "subject" | "status" | "created_at">[];
}

export async function getPatientOverview(patientId: string): Promise<PatientOverview> {
  const forPatient = (q: any) => q.eq("patient_id", patientId);
  const [appointmentResult, appointmentCount, billingCount, unpaidBillingCount, documentCount, scanCount, intakeCount, feedbackResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, service, appointment_date, appointment_time, status")
        .eq("patient_id", patientId)
        .order("appointment_date", { ascending: false })
        .limit(5),
      countRows("appointments", forPatient),
      countRows("billings", forPatient),
      countRows("billings", (q) => forPatient(q).in("payment_status", ["not_paid", "overdue"])),
      countRows("patient_documents", forPatient),
      countRows("analysis_results", forPatient),
      countRows("medical_intake", forPatient),
      supabase
        .from("support_requests")
        .select("id, subject, status, created_at")
        .eq("requester_id", patientId)
        .order("created_at", { ascending: false }),
    ]);

  if (appointmentResult.error) throw new Error(appointmentResult.error.message);
  if (feedbackResult.error) throw new Error(feedbackResult.error.message);

  return {
    appointments: appointmentResult.data || [],
    appointmentCount,
    billingCount,
    unpaidBillingCount,
    documentCount,
    scanCount,
    hasMedicalIntake: intakeCount > 0,
    feedback: (feedbackResult.data || []) as PatientOverview["feedback"],
  };
}
