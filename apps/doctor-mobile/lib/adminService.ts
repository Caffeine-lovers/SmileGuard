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

export async function listAccessCodes(): Promise<DoctorAccessCode[]> {
  const { data, error } = await supabase
    .from("doctor_access_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AdminService] Error listing access codes:", error);
    return [];
  }
  return (data || []) as DoctorAccessCode[];
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

export async function updateAccessCode(
  id: string,
  updates: Partial<Pick<DoctorAccessCode, "label" | "tier" | "is_active">>
): Promise<boolean> {
  const { error } = await supabase.from("doctor_access_codes").update(updates).eq("id", id);
  if (error) {
    console.error("[AdminService] Error updating access code:", error);
    return false;
  }
  return true;
}

export async function deactivateAccessCode(id: string): Promise<boolean> {
  return updateAccessCode(id, { is_active: false });
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
  phone_number: string | null;
  role: string;
  created_at: string;
}

export async function listPatients(search?: string): Promise<AdminPatientRow[]> {
  let query = supabase
    .from("profiles")
    .select("id, name, email, phone_number, role, created_at")
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
  subject: string | null;
  message: string | null;
  status: "open" | "in_progress" | "resolved";
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export async function listSupportRequests(status?: SupportRequest["status"]): Promise<SupportRequest[]> {
  let query = supabase.from("support_requests").select("*").order("created_at", { ascending: false });
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
// Access Code Attempt Log (read-only)
// ─────────────────────────────────────────

export interface DoctorCodeAttempt {
  id: string;
  code: string | null;
  attempted_code: string | null;
  is_successful: boolean;
  ip_address: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export async function listCodeAttempts(limit = 100): Promise<DoctorCodeAttempt[]> {
  const { data, error } = await supabase
    .from("doctor_code_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[AdminService] Error listing code attempts:", error);
    return [];
  }
  return (data || []) as DoctorCodeAttempt[];
}
