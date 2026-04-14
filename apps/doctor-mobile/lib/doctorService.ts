/**
 * Doctor Service - Database operations for doctor profiles
 * Used by both patient-web and doctor-mobile apps
 */

import { supabase } from "@smileguard/supabase-client";
import { Doctor } from "@smileguard/shared-types";

/**
 * Fetch a doctor's complete profile by user_id
 * @param userId - The auth user ID of the doctor
 * @returns Doctor profile or null if not found
 */
export async function getDoctorProfile(userId: string): Promise<Doctor | null> {
  try {
    console.log('🔍 getDoctorProfile called with userId:', userId);
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      // PGRST116 = No rows found, which is normal for new users
      if (error.code === "PGRST116") {
        console.log("ℹ️ No doctor profile found (new user) - this is normal");
        return null;
      }
      console.error("❌ Error fetching doctor profile:", error.message, error.details, error.code);
      console.log("Query attempted: SELECT * FROM doctors WHERE user_id = ?", userId);
      return null;
    }

    console.log("✅ Doctor profile found:", data);
    return data as Doctor;
  } catch (error) {
    console.error("❌ Exception in getDoctorProfile:", error);
    return null;
  }
}

/**
 * Get doctor by ID (doctor record ID, not user_id)
 * @param doctorId - The doctor record ID (UUID)
 * @returns Doctor profile or null
 */
export async function getDoctorById(doctorId: string): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("id", doctorId)
      .single();

    if (error) {
      console.error("Error fetching doctor by ID:", error);
      return null;
    }

    return data as Doctor;
  } catch (error) {
    console.error("Exception in getDoctorById:", error);
    return null;
  }
}

/**
 * Get all verified doctors
 * @returns Array of verified doctors
 */
export async function getVerifiedDoctors(): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("is_verified", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching verified doctors:", error);
      return [];
    }

    return (data || []) as Doctor[];
  } catch (error) {
    console.error("Exception in getVerifiedDoctors:", error);
    return [];
  }
}

/**
 * Get available doctors (is_available = true)
 * @returns Array of available doctors
 */
export async function getAvailableDoctors(): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("is_available", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching available doctors:", error);
      return [];
    }

    return (data || []) as Doctor[];
  } catch (error) {
    console.error("Exception in getAvailableDoctors:", error);
    return [];
  }
}

/**
 * Get doctors by specialization
 * @param specialization - The medical specialization to filter by
 * @returns Array of doctors with matching specialization
 */
export async function getDoctorsBySpecialization(
  specialization: string
): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("specialization", specialization)
      .eq("is_available", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching doctors by specialization:", error);
      return [];
    }

    return (data || []) as Doctor[];
  } catch (error) {
    console.error("Exception in getDoctorsBySpecialization:", error);
    return [];
  }
}

/**
 * Get doctors by clinic
 * @param clinicName - The clinic name to filter by
 * @returns Array of doctors at the clinic
 */
export async function getDoctorsByClinic(clinicName: string): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("clinic_name", clinicName)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching doctors by clinic:", error);
      return [];
    }

    return (data || []) as Doctor[];
  } catch (error) {
    console.error("Exception in getDoctorsByClinic:", error);
    return [];
  }
}

/**
 * Create or insert a new doctor profile
 * @param doctor - The doctor object to insert
 * @returns Created doctor or null if failed
 */
export async function createDoctorProfile(doctor: Doctor): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .insert([doctor])
      .select()
      .single();

    if (error) {
      console.error("Error creating doctor profile:", error);
      return null;
    }

    return data as Doctor;
  } catch (error) {
    console.error("Exception in createDoctorProfile:", error);
    return null;
  }
}

/**
 * Update a doctor's profile
 * @param doctorId - The doctor record ID
 * @param updates - Partial doctor object with fields to update
 * @returns Updated doctor or null if failed
 */
export async function updateDoctorProfile(
  doctorId: string,
  updates: Partial<Doctor>
): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doctorId)
      .select()
      .single();

    if (error) {
      console.error("Error updating doctor profile:", error);
      return null;
    }

    return data as Doctor;
  } catch (error) {
    console.error("Exception in updateDoctorProfile:", error);
    return null;
  }
}

/**
 * Update doctor availability status
 * @param doctorId - The doctor record ID
 * @param isAvailable - Whether doctor is available
 * @returns Updated doctor or null
 */
export async function updateAvailabilityStatus(
  doctorId: string,
  isAvailable: boolean
): Promise<Doctor | null> {
  return updateDoctorProfile(doctorId, {
    is_available: isAvailable,
  });
}

/**
 * Search doctors by name (via LIKE query on user id)
 * and other criteria
 * @param query - Search query
 * @returns Array of matching doctors
 */
export async function searchDoctors(query: string): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .or(
        `specialization.ilike.%${query}%,clinic_name.ilike.%${query}%,bio.ilike.%${query}%`
      )
      .eq("is_available", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error searching doctors:", error);
      return [];
    }

    return (data || []) as Doctor[];
  } catch (error) {
    console.error("Exception in searchDoctors:", error);
    return [];
  }
}

/**
 * Get a doctor with lookup via user profile
 * Fetches doctor profile and joins with profiles table
 * @param userId - The auth user ID
 * @returns Doctor with profile info
 */
export async function getDoctorWithProfile(userId: string): Promise<Doctor | null> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select(
        `
        *,
        profiles:user_id (
          id,
          email,
          name,
          phone
        )
      `
      )
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching doctor with profile:", error);
      return null;
    }

    return data as Doctor;
  } catch (error) {
    console.error("Exception in getDoctorWithProfile:", error);
    return null;
  }
}

/**
 * Check if doctor license already exists
 * @param licenseNumber - License number to check
 * @returns true if license exists, false otherwise
 */
export async function doctorLicenseExists(licenseNumber: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("id")
      .eq("license_number", licenseNumber)
      .limit(1);

    if (error) {
      console.error("Error checking license:", error);
      return false;
    }

    return data !== null && data.length > 0;
  } catch (error) {
    console.error("Exception in doctorLicenseExists:", error);
    return false;
  }
}

/**
 * Get doctor stats (count of doctors by various metrics)
 * @returns Object with doctor statistics
 */
export async function getDoctorStats(): Promise<{
  total: number;
  verified: number;
  available: number;
  unavailable: number;
}> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, is_verified, is_available");

    if (error) {
      console.error("Error fetching doctor stats:", error);
      return { total: 0, verified: 0, available: 0, unavailable: 0 };
    }

    const doctors = (data || []) as Array<{
      id: string;
      is_verified: boolean;
      is_available: boolean;
    }>;

    return {
      total: doctors.length,
      verified: doctors.filter((d) => d.is_verified).length,
      available: doctors.filter((d) => d.is_available).length,
      unavailable: doctors.filter((d) => !d.is_available).length,
    };
  } catch (error) {
    console.error("Exception in getDoctorStats:", error);
    return { total: 0, verified: 0, available: 0, unavailable: 0 };
  }
}

/**
 * Delete a doctor profile (admin only - call should be secured)
 * @param doctorId - Doctor record ID to delete
 * @returns true if successful, false otherwise
 */
export async function deleteDoctorProfile(doctorId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("doctors").delete().eq("id", doctorId);

    if (error) {
      console.error("Error deleting doctor profile:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Exception in deleteDoctorProfile:", error);
    return false;
  }
}
