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
    console.log(' getDoctorProfile called with userId:', userId);
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error(" Error fetching doctor profile:", error.message, error.details, error.code);
      console.log("Query attempted: SELECT * FROM doctors WHERE user_id = ?", userId);
      return null;
    }

    console.log(" Doctor profile found:", data);
    return data as Doctor;
  } catch (error) {
    console.error(" Exception in getDoctorProfile:", error);
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
 * Get available doctors
 * @returns Array of available doctors
 */
export async function getAvailableDoctors(): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
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
 * Create or update a doctor profile (idempotent via UPSERT)
 * Uses UPSERT to handle the case where a profile already exists.
 * If a doctor with the same user_id already exists, it will be updated.
 * This prevents unique constraint violations on repeated calls.
 * @param doctor - The doctor object to insert or update
 * @returns Created/updated doctor or null if failed
 */
export async function createDoctorProfile(
  doctor: Doctor,
  accessCode?: string
): Promise<Doctor | null> {
  try {
    const firstName = (doctor.first_name || (doctor.doctor_name ? doctor.doctor_name.trim().split(" ")[0] : "") || "").trim();
    const lastName = (doctor.last_name || (doctor.doctor_name ? doctor.doctor_name.trim().split(" ").slice(1).join(" ") : "") || "").trim();
    const middleName = (doctor.middle_name || "").trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") || doctor.doctor_name || "";

    // Validate required fields before attempting creation
    if (!doctor.user_id) throw new Error("Missing required field: user_id");
    if (!firstName) throw new Error("Missing required field: first_name");
    if (!lastName) throw new Error("Missing required field: last_name");
    if (!doctor.specialization) throw new Error("Missing required field: specialization");
    if (!doctor.license_number) throw new Error("Missing required field: license_number");

    console.log("[DoctorService] Creating/updating doctor profile with data:", {
      user_id: doctor.user_id,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      specialization: doctor.specialization,
      license_number: doctor.license_number,
      has_access_code: !!accessCode,
      profile_picture_url: doctor.profile_picture_url ? "✓ (URL set)" : "✗ (no URL)",
    });

    // If access code is provided, use the secure atomic complete_doctor_registration RPC
    if (accessCode && accessCode.trim().length > 0) {
      console.log("[DoctorService] Calling complete_doctor_registration RPC...");
      let rpcResponse = await supabase.rpc("complete_doctor_registration", {
        p_code: accessCode.trim(),
        p_first_name: firstName,
        p_middle_name: middleName || null,
        p_last_name: lastName,
        p_specialization: doctor.specialization,
        p_license_number: doctor.license_number,
        p_bio: doctor.bio || null,
        p_profile_picture_url: doctor.profile_picture_url || null,
      });

      // If database still has the legacy complete_doctor_registration(..., p_doctor_name, ...)
      if (
        rpcResponse.error &&
        (rpcResponse.error.code === "PGRST202" ||
          rpcResponse.error.hint?.includes("p_doctor_name") ||
          rpcResponse.error.message?.includes("p_doctor_name"))
      ) {
        console.warn(
          "[DoctorService] Database RPC expects legacy p_doctor_name, retrying with p_doctor_name..."
        );
        rpcResponse = await supabase.rpc("complete_doctor_registration", {
          p_code: accessCode.trim(),
          p_doctor_name: fullName,
          p_specialization: doctor.specialization,
          p_license_number: doctor.license_number,
          p_bio: doctor.bio || null,
          p_profile_picture_url: doctor.profile_picture_url || null,
        });
      }

      if (rpcResponse.error) {
        console.error("[DoctorService] complete_doctor_registration error:", rpcResponse.error);
        // If RPC function is not found in database, fallback to direct upsert
        if (
          rpcResponse.error.code === "PGRST202" ||
          rpcResponse.error.message?.includes("function") ||
          rpcResponse.error.message?.includes("not found")
        ) {
          console.warn(
            "[DoctorService] complete_doctor_registration RPC not available in DB, falling back to direct upsert..."
          );
        } else {
          throw new Error(`Database error (${rpcResponse.error.code || "RPC"}): ${rpcResponse.error.message}`);
        }
      } else {
        const result = rpcResponse.data as { success: boolean; message?: string; doctor_id?: string };
        if (!result || !result.success) {
          throw new Error(result?.message || "Failed to register doctor profile");
        }

        console.log("[DoctorService] Doctor registered via RPC successfully:", result);
        return {
          ...doctor,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          id: result.doctor_id,
        } as Doctor;
      }
    }

    // Fallback UPSERT: For existing doctors or environments without access code requirement
    const { is_available, ...rawCleanDoctor } = doctor as any;
    const cleanDoctor = {
      ...rawCleanDoctor,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
    };
    delete cleanDoctor.doctor_name;

    // Synchronize name and phone with profiles table if user_id is available
    if (cleanDoctor.user_id) {
      try {
        const profileUpdates: any = { role: "doctor" };
        if (fullName) profileUpdates.name = fullName;
        if (cleanDoctor.doctor_phone) profileUpdates.phone_number = cleanDoctor.doctor_phone;
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", cleanDoctor.user_id);
      } catch (profileErr) {
        console.warn("[DoctorService] Could not update profile during doctor creation:", profileErr);
      }
    }

    let { data, error } = await supabase
      .from("doctors")
      .upsert([cleanDoctor], { onConflict: "user_id" })
      .select()
      .single();

    // If database table does not yet have first_name column (error 42703), retry with doctor_name
    if (error && error.code === "42703" && error.message?.includes("first_name")) {
      console.warn("[DoctorService] Database table lacks first_name column, retrying with doctor_name...");
      const legacyDoctor = { ...rawCleanDoctor, doctor_name: fullName };
      delete legacyDoctor.first_name;
      delete legacyDoctor.middle_name;
      delete legacyDoctor.last_name;

      const retryRes = await supabase
        .from("doctors")
        .upsert([legacyDoctor], { onConflict: "user_id" })
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error("[DoctorService] Supabase upsert error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw new Error(`Database error (${error.code}): ${error.message}`);
    }

    console.log("[DoctorService] Doctor profile created/updated successfully");
    return data as Doctor;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DoctorService] Exception in createDoctorProfile:", message);
    throw error; // Re-throw so caller gets the actual error
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
    const { id, created_at, is_available, doctor_name, ...cleanUpdates } = updates as any;

    const fullName = [cleanUpdates.first_name, cleanUpdates.middle_name, cleanUpdates.last_name]
      .filter(Boolean)
      .join(" ");

    // Synchronize phone and name with profiles table if user_id is available
    if (cleanUpdates.user_id) {
      try {
        const profileUpdates: any = {};
        if (cleanUpdates.doctor_phone) profileUpdates.phone_number = cleanUpdates.doctor_phone;
        if (fullName) profileUpdates.name = fullName;
        if (Object.keys(profileUpdates).length > 0) {
          await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("id", cleanUpdates.user_id);
        }
      } catch (profileErr) {
        console.warn("[DoctorService] Could not update profile phone_number:", profileErr);
      }
    }

    // Attempt update by matching either doctor id or user_id
    let { data, error } = await supabase
      .from("doctors")
      .update({
        ...cleanUpdates,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${doctorId},user_id.eq.${doctorId}`)
      .select()
      .maybeSingle();

    // If error indicates doctor_phone column does not exist on doctors table, retry without it
    if (error && (error.message?.includes("doctor_phone") || error.code === "42703")) {
      console.warn("[DoctorService] Column doctor_phone missing on doctors table, retrying update without it...");
      const { doctor_phone, ...withoutPhone } = cleanUpdates;
      const retryResult = await supabase
        .from("doctors")
        .update({
          ...withoutPhone,
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${doctorId},user_id.eq.${doctorId}`)
        .select()
        .maybeSingle();

      data = retryResult.data;
      error = retryResult.error;
    }

    // If no row was found to update, attempt inserting a new record
    if (!data && !error && (cleanUpdates.user_id || doctorId)) {
      console.log("[DoctorService] Doctor record not found for update, attempting insert...");
      const effectiveUserId = cleanUpdates.user_id || doctorId;
      const insertPayload = {
        ...cleanUpdates,
        user_id: effectiveUserId,
        updated_at: new Date().toISOString(),
      };

      const insertResult = await supabase
        .from("doctors")
        .insert([insertPayload])
        .select()
        .maybeSingle();

      data = insertResult.data;
      error = insertResult.error;
    }

    if (error) {
      console.error("[DoctorService] Error updating doctor profile:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    return data as Doctor;
  } catch (error) {
    console.error("[DoctorService] Exception in updateDoctorProfile:", error);
    throw error;
  }
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
}> {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, is_verified");

    if (error) {
      console.error("Error fetching doctor stats:", error);
      return { total: 0, verified: 0 };
    }

    const doctors = (data || []) as Array<{
      id: string;
      is_verified: boolean;
    }>;

    return {
      total: doctors.length,
      verified: doctors.filter((d) => d.is_verified).length,
    };
  } catch (error) {
    console.error("Exception in getDoctorStats:", error);
    return { total: 0, verified: 0 };
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
