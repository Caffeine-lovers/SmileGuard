import { supabase } from "./supabase.ts";
import { saveTransactionLocally, isOnline, syncPendingTransactions } from "./syncService.ts";

// Type definitions for database operations
export interface Appointment {
  id?: string;
  patient_id: string;
  dentist_id: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  status: "scheduled" | "completed" | "cancelled" | "no-show";
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

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

// Generic save function that handles offline/online automatically
async function saveRecord<T>(
  table: "appointments" | "patients" | "treatments" | "billings",
  data: T,
  operation: "INSERT" | "UPDATE" = "INSERT"
): Promise<{ success: boolean; data?: T; error?: string; offlineId?: string }> {
  const online = await isOnline();

  if (!online) {
    // Save locally for later sync
    try {
      const offlineId = await saveTransactionLocally(table, operation, data as unknown as Record<string, unknown>);
      console.log(`Saved ${table} locally with ID: ${offlineId}`);
      return { 
        success: true, 
        data, 
        offlineId,
        error: "Saved offline. Will sync when connection is restored." 
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save offline";
      return { success: false, error: errorMessage };
    }
  }

  // Online - save directly to Supabase
  try {
    let result;
    
    if (operation === "INSERT") {
      result = await supabase.from(table).insert(data).select().single();
    } else {
      const record = data as { id: string };
      result = await supabase.from(table).update(data).eq("id", record.id).select().single();
    }

    if (result.error) {
      // If direct save fails, try saving locally
      console.error(`Direct save failed: ${result.error.message}, trying offline save`);
      try {
        const offlineId = await saveTransactionLocally(table, operation, data as unknown as Record<string, unknown>);
        return { 
          success: true, 
          data, 
          offlineId,
          error: `Direct save failed. Saved offline: ${result.error.message}` 
        };
      } catch (err) {
        return { success: false, error: result.error.message };
      }
    }

    return { success: true, data: result.data as T };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

// Appointments
export const saveAppointment = async (
  appointment: Omit<Appointment, "id" | "created_at" | "updated_at">,
  existingId?: string
): Promise<{ success: boolean; data?: Appointment; error?: string; offlineId?: string }> => {
  const data = existingId ? { ...appointment, id: existingId } : appointment;
  return saveRecord("appointments", data, existingId ? "UPDATE" : "INSERT");
};

export const getAppointments = async (dentistId?: string): Promise<Appointment[]> => {
  let query = supabase.from("appointments").select("*");
  
  if (dentistId) {
    query = query.eq("dentist_id", dentistId);
  }
  
  const { data, error } = await query.order("appointment_date", { ascending: true });
  
  if (error) {
    console.error("Error fetching appointments:", error);
    return [];
  }
  
  return data || [];
};

export const updateAppointmentStatus = async (
  id: string,
  status: Appointment["status"]
): Promise<{ success: boolean; error?: string }> => {
  // First get the existing appointment to preserve other fields
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: fetchError?.message || "Appointment not found" };
  }

  // Update only the status field
  const result = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  return { success: true };
};

// Patients
export const savePatient = async (
  patient: Omit<Patient, "id" | "created_at" | "updated_at">,
  existingId?: string
): Promise<{ success: boolean; data?: Patient; error?: string; offlineId?: string }> => {
  const data = existingId ? { ...patient, id: existingId } : patient;
  return saveRecord("patients", data, existingId ? "UPDATE" : "INSERT");
};

export const getPatients = async (): Promise<Patient[]> => {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching patients:", error);
    return [];
  }

  return data || [];
};

export const getPatientById = async (id: string): Promise<Patient | null> => {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching patient:", error);
    return null;
  }

  return data;
};

// Treatments
export const saveTreatment = async (
  treatment: Omit<Treatment, "id" | "created_at" | "updated_at">,
  existingId?: string
): Promise<{ success: boolean; data?: Treatment; error?: string; offlineId?: string }> => {
  const data = existingId ? { ...treatment, id: existingId } : treatment;
  return saveRecord("treatments", data, existingId ? "UPDATE" : "INSERT");
};

export const getTreatments = async (patientId?: string): Promise<Treatment[]> => {
  let query = supabase.from("treatments").select("*");
  
  if (patientId) {
    query = query.eq("patient_id", patientId);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching treatments:", error);
    return [];
  }
  
  return data || [];
};

// Billings
export const saveBilling = async (
  billing: Omit<Billing, "id" | "created_at" | "updated_at">,
  existingId?: string
): Promise<{ success: boolean; data?: Billing; error?: string; offlineId?: string }> => {
  const data = existingId ? { ...billing, id: existingId } : billing;
  return saveRecord("billings", data, existingId ? "UPDATE" : "INSERT");
};

export const getBillings = async (patientId?: string): Promise<Billing[]> => {
  let query = supabase.from("billings").select("*");
  
  if (patientId) {
    query = query.eq("patient_id", patientId);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching billings:", error);
    return [];
  }
  
  return data || [];
};

export const calculateDiscount = (
  amount: number,
  discountType: Billing["discount_type"]
): { discountAmount: number; finalAmount: number } => {
  let discountAmount = 0;
  
  switch (discountType) {
    case "pwd":
    case "senior":
      discountAmount = amount * 0.20; // 20% discount
      break;
    case "insurance":
      discountAmount = amount * 0.30; // 30% discount (example)
      break;
    default:
      discountAmount = 0;
  }
  
  return {
    discountAmount,
    finalAmount: amount - discountAmount,
  };
};

// Manual sync trigger (can be called from UI)
export const triggerSync = async () => {
  return syncPendingTransactions();
};
