/**
 * Doctor Service - Database operations for doctor profiles
 * Used by both patient-web and doctor-mobile apps
 */

import { supabase } from "@smileguard/supabase-client";
import { Doctor, EMPTY_DOCTOR } from "@smileguard/shared-types";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Fetch a doctor's complete profile by user_id
 * @param userId - The auth user ID of the doctor
 * @returns Doctor profile or null if not found
 */
export async function getDoctorProfile(userId: string): Promise<Doctor | null> {
  try {
    console.log(' getDoctorProfile called with userId:', userId);

    // 1. Check profiles table first to determine role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role === "assistant") {
      const { data: ast } = await supabase
        .from("assistants")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (ast) {
        return {
          id: ast.id,
          user_id: ast.user_id,
          first_name: ast.first_name,
          middle_name: ast.middle_name,
          last_name: ast.last_name,
          doctor_name: `${ast.first_name || ""} ${ast.last_name || ""}`.trim(),
          gender: ast.gender,
          doctor_phone: ast.phone,
          profile_picture_url: ast.profile_picture_url,
          role: "assistant",
          license_number: "",
          specialization: "Clinic Assistant",
          created_at: ast.created_at,
          updated_at: ast.updated_at,
        } as Doctor;
      }
      return null;
    }

    if (profile?.role === "admin") {
      const { data: adminData } = await supabase
        .from("admins")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (adminData) {
        return {
          id: adminData.id,
          user_id: adminData.user_id,
          first_name: adminData.first_name,
          middle_name: adminData.middle_name,
          last_name: adminData.last_name,
          doctor_name: `${adminData.first_name || ""} ${adminData.last_name || ""}`.trim(),
          doctor_phone: adminData.phone,
          role: "admin" as any,
          license_number: "",
          specialization: "Clinic Administrator",
          created_at: adminData.created_at,
          updated_at: adminData.updated_at,
        } as any;
      }
      return null;
    }

    // Default: fetch from doctors table
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(" Error fetching doctor profile:", error.message, error.details, error.code);
      console.log("Query attempted: SELECT * FROM doctors WHERE user_id = ?", userId);
      return null;
    }

    if (!data) {
      return null;
    }

    console.log(" Doctor profile found:", data);
    const doctor = data as Doctor;

    // Check for cached gender or user metadata fallback if gender is null or empty
    if (!doctor.gender) {
      try {
        const cachedGender = await AsyncStorage.getItem(`@doctor_gender_${userId}`);
        if (cachedGender) {
          doctor.gender = cachedGender;
        } else {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user?.user_metadata?.gender) {
            doctor.gender = authData.user.user_metadata.gender;
          }
        }
      } catch (e) {
        console.warn("[DoctorService] Could not retrieve cached gender:", e);
      }
    }

    return doctor;
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

export interface AssistantProfileData {
  user_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  phone?: string | null;
  gender?: string | null;
  profile_picture_url?: string | null;
  clinic_name?: string | null;
}

export interface AdminProfileData {
  user_id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  phone?: string | null;
}

/**
 * Create or update an assistant profile (idempotent via UPSERT)
 * Strictly inserts/updates public.assistants and public.profiles. Never touches public.doctors.
 */
export async function createAssistantProfile(
  assistant: AssistantProfileData,
  accessCode?: string
): Promise<{ success: boolean; id?: string }> {
  try {
    const firstName = (assistant.first_name || "").trim();
    const lastName = (assistant.last_name || "").trim();
    const middleName = (assistant.middle_name || "").trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") || "Clinic Assistant";

    if (!assistant.user_id) throw new Error("Missing required field: user_id");
    if (!firstName) throw new Error("Missing required field: first_name");
    if (!lastName) throw new Error("Missing required field: last_name");

    console.log("[DoctorService] Creating/updating assistant profile:", {
      user_id: assistant.user_id,
      first_name: firstName,
      last_name: lastName,
      has_access_code: !!accessCode,
    });

    // 1. Sync public.profiles
    const { error: profileError } = await supabase.from("profiles").upsert(
      [
        {
          id: assistant.user_id,
          name: fullName,
          role: "assistant",
          phone_number: assistant.phone || null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );
    if (profileError) {
      console.warn("[DoctorService] Profile sync error for assistant:", profileError.message);
    }

    // 2. Access code RPC attempt if provided
    let rpcAssistantId: string | undefined;
    if (accessCode && accessCode.trim().length > 0) {
      try {
        const rpcRes = await supabase.rpc("complete_doctor_registration", {
          p_code: accessCode.trim(),
          p_first_name: firstName,
          p_middle_name: middleName || null,
          p_last_name: lastName,
          p_specialization: null,
          p_license_number: null,
          p_bio: null,
          p_profile_picture_url: assistant.profile_picture_url || null,
          p_gender: assistant.gender || null,
        });
        if (rpcRes.data?.success && rpcRes.data?.doctor_id) {
          rpcAssistantId = rpcRes.data.doctor_id;
        }
      } catch (rpcErr) {
        console.warn("[DoctorService] Assistant RPC registration attempt notice:", rpcErr);
      }
    }

    // 3. Upsert directly into public.assistants
    const { data: astData, error: astError } = await supabase
      .from("assistants")
      .upsert(
        [
          {
            user_id: assistant.user_id,
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            phone: assistant.phone || null,
            gender: assistant.gender || null,
            profile_picture_url: assistant.profile_picture_url || null,
            clinic_name: assistant.clinic_name || "Ivy King Dental Clinic",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id" }
      )
      .select()
      .maybeSingle();

    if (astError) {
      console.error("[DoctorService] Error upserting to assistants table:", astError);
      throw new Error(`Database error: ${astError.message}`);
    }

    // 4. Update auth user metadata
    try {
      await supabase.auth.updateUser({
        data: {
          role: "assistant",
          name: fullName,
        },
      });
    } catch (authMetaErr) {
      console.warn("[DoctorService] Could not update user metadata:", authMetaErr);
    }

    return {
      success: true,
      id: astData?.id || rpcAssistantId,
    };
  } catch (err) {
    console.error("[DoctorService] Exception in createAssistantProfile:", err);
    throw err;
  }
}

/**
 * Create or update an admin profile (idempotent via UPSERT)
 * Strictly inserts/updates public.admins and public.profiles. Never touches public.doctors.
 */
export async function createAdminProfile(
  admin: AdminProfileData
): Promise<{ success: boolean; id?: string }> {
  try {
    const firstName = (admin.first_name || "").trim();
    const lastName = (admin.last_name || "").trim();
    const middleName = (admin.middle_name || "").trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") || "Clinic Administrator";

    if (!admin.user_id) throw new Error("Missing required field: user_id");
    if (!firstName) throw new Error("Missing required field: first_name");
    if (!lastName) throw new Error("Missing required field: last_name");

    console.log("[DoctorService] Creating/updating admin profile:", {
      user_id: admin.user_id,
      first_name: firstName,
      last_name: lastName,
    });

    // 1. Sync public.profiles
    const { error: profileError } = await supabase.from("profiles").upsert(
      [
        {
          id: admin.user_id,
          name: fullName,
          role: "admin",
          phone_number: admin.phone || null,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );
    if (profileError) {
      console.warn("[DoctorService] Profile sync error for admin:", profileError.message);
    }

    // 2. Upsert directly into public.admins
    const { data: admData, error: admError } = await supabase
      .from("admins")
      .upsert(
        [
          {
            user_id: admin.user_id,
            first_name: firstName,
            middle_name: middleName || null,
            last_name: lastName,
            phone: admin.phone || null,
            admin_level: "admin",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "user_id" }
      )
      .select()
      .maybeSingle();

    if (admError) {
      console.error("[DoctorService] Error upserting to admins table:", admError);
      throw new Error(`Database error: ${admError.message}`);
    }

    // 3. Update auth metadata
    try {
      await supabase.auth.updateUser({
        data: {
          role: "admin",
          name: fullName,
        },
      });
    } catch (authMetaErr) {
      console.warn("[DoctorService] Could not update user metadata:", authMetaErr);
    }

    return {
      success: true,
      id: admData?.id,
    };
  } catch (err) {
    console.error("[DoctorService] Exception in createAdminProfile:", err);
    throw err;
  }
}

/**
 * Update an assistant's profile
 * Strictly updates public.assistants and public.profiles. Never touches public.doctors.
 */
export async function updateAssistantProfile(
  userId: string,
  updates: {
    first_name?: string;
    middle_name?: string | null;
    last_name?: string;
    phone?: string | null;
    gender?: string | null;
    profile_picture_url?: string | null;
  }
): Promise<any> {
  try {
    const fullName = [updates.first_name, updates.middle_name, updates.last_name].filter(Boolean).join(" ");
    if (updates.phone || fullName) {
      const profileUpdates: any = { role: "assistant", updated_at: new Date().toISOString() };
      if (fullName) profileUpdates.name = fullName;
      if (updates.phone) profileUpdates.phone_number = updates.phone;
      await supabase.from("profiles").update(profileUpdates).eq("id", userId);
    }

    const astUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.first_name !== undefined) astUpdates.first_name = updates.first_name;
    if (updates.middle_name !== undefined) astUpdates.middle_name = updates.middle_name;
    if (updates.last_name !== undefined) astUpdates.last_name = updates.last_name;
    if (updates.phone !== undefined) astUpdates.phone = updates.phone;
    if (updates.gender !== undefined) astUpdates.gender = updates.gender;
    if (updates.profile_picture_url !== undefined) astUpdates.profile_picture_url = updates.profile_picture_url;

    const { data, error } = await supabase
      .from("assistants")
      .update(astUpdates)
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[DoctorService] Error updating assistant profile:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[DoctorService] Exception in updateAssistantProfile:", err);
    return null;
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

    // Strictly route assistant registration to dedicated table
    if (doctor.role === "assistant") {
      const astResult = await createAssistantProfile(
        {
          user_id: doctor.user_id,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          phone: doctor.doctor_phone || null,
          gender: doctor.gender || null,
          profile_picture_url: doctor.profile_picture_url || null,
        },
        accessCode
      );
      return {
        ...doctor,
        id: astResult.id || doctor.id,
        role: "assistant",
        specialization: "Clinic Assistant",
        license_number: "",
      } as Doctor;
    }

    // Strictly route admin registration to dedicated table
    if ((doctor.role as any) === "admin") {
      const admResult = await createAdminProfile({
        user_id: doctor.user_id,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        phone: doctor.doctor_phone || null,
      });
      return {
        ...doctor,
        id: admResult.id || doctor.id,
        role: "admin" as any,
        specialization: "Clinic Administrator",
        license_number: "",
      } as any;
    }

    if (!doctor.specialization) throw new Error("Missing required field: specialization");
    if (!doctor.license_number) throw new Error("Missing required field: license_number");

    const specialization = doctor.specialization;
    const licenseNumber = doctor.license_number;
    const bio = doctor.bio || null;

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

    // Ensure parent row exists in public.profiles before attempting to register doctor
    // (prevents PostgreSQL foreign key constraint violation: doctor_user_id_fkey)
    if (doctor.user_id) {
      try {
        const { error: profileSyncError } = await supabase
          .from("profiles")
          .upsert(
            [
              {
                id: doctor.user_id,
                name: fullName || "Doctor",
                role: "doctor",
                phone_number: doctor.doctor_phone || null,
                updated_at: new Date().toISOString(),
              },
            ],
            { onConflict: "id" }
          );
        if (profileSyncError) {
          console.warn("[DoctorService] Profile pre-sync notice:", profileSyncError.message);
        } else {
          console.log("[DoctorService] Pre-registration profile confirmed in public.profiles");
        }
      } catch (profilePreErr) {
        console.warn("[DoctorService] Profile pre-sync exception:", profilePreErr);
      }
    }

    // If access code is provided, use the secure atomic complete_doctor_registration RPC
    if (accessCode && accessCode.trim().length > 0) {
      console.log("[DoctorService] Calling complete_doctor_registration RPC...");
      let rpcResponse = await supabase.rpc("complete_doctor_registration", {
        p_code: accessCode.trim(),
        p_first_name: firstName,
        p_middle_name: middleName || null,
        p_last_name: lastName,
        p_specialization: specialization,
        p_license_number: licenseNumber,
        p_bio: bio,
        p_profile_picture_url: doctor.profile_picture_url || null,
        p_gender: doctor.gender ? doctor.gender.trim() : null,
      });

      // If database function has not been updated with p_gender yet, retry without p_gender
      if (
        rpcResponse.error &&
        (rpcResponse.error.code === "PGRST202" ||
          rpcResponse.error.hint?.includes("p_gender") ||
          rpcResponse.error.message?.includes("p_gender"))
      ) {
        console.warn(
          "[DoctorService] Database RPC lacks p_gender parameter, retrying without p_gender..."
        );
        rpcResponse = await supabase.rpc("complete_doctor_registration", {
          p_code: accessCode.trim(),
          p_first_name: firstName,
          p_middle_name: middleName || null,
          p_last_name: lastName,
          p_specialization: specialization,
          p_license_number: licenseNumber,
          p_bio: bio,
          p_profile_picture_url: doctor.profile_picture_url || null,
        });
      }

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
          p_specialization: specialization,
          p_license_number: licenseNumber,
          p_bio: bio,
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

        // Crucial: Update doctor_phone, gender, years_of_experience, and office_hours
        // which may not be set by older complete_doctor_registration RPCs
        const postRegUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
          role: "doctor",
        };

        if (doctor.gender !== undefined && doctor.gender !== null) {
          postRegUpdates.gender = doctor.gender.trim() || null;
        }

        if (doctor.doctor_phone !== undefined && doctor.doctor_phone !== null) {
          postRegUpdates.doctor_phone = doctor.doctor_phone.trim() || null;
        }

        const yearsExp = doctor.years_of_experience !== undefined && doctor.years_of_experience !== null
          ? Number(doctor.years_of_experience)
          : 0;
        postRegUpdates.years_of_experience = isNaN(yearsExp) ? 0 : yearsExp;

        postRegUpdates.office_hours = doctor.office_hours || EMPTY_DOCTOR.office_hours;
        postRegUpdates.role = "doctor";

        const targetDoctorId = result.doctor_id || doctor.id;
        console.log("[DoctorService] Updating doctor post-registration fields:", {
          doctorId: targetDoctorId,
          user_id: doctor.user_id,
          gender: postRegUpdates.gender,
          doctor_phone: postRegUpdates.doctor_phone,
          years_of_experience: postRegUpdates.years_of_experience,
          has_office_hours: !!postRegUpdates.office_hours,
        });

        try {
          if (targetDoctorId) {
            let { error: idErr } = await supabase
              .from("doctors")
              .update(postRegUpdates)
              .eq("id", targetDoctorId);
            if (idErr && (idErr.code === "42703" || idErr.message?.includes("gender"))) {
              const { gender: _g, ...withoutGender } = postRegUpdates;
              const retryWithoutGender = await supabase
                .from("doctors")
                .update(withoutGender)
                .eq("id", targetDoctorId);
              idErr = retryWithoutGender.error;
            }
            if (idErr) {
              console.warn("[DoctorService] Could not update doctor record by id, trying by user_id:", idErr);
              if (doctor.user_id) {
                await supabase.from("doctors").update(postRegUpdates).eq("user_id", doctor.user_id);
              }
            }
          } else if (doctor.user_id) {
            await supabase.from("doctors").update(postRegUpdates).eq("user_id", doctor.user_id);
          }
        } catch (updateEx) {
          console.warn("[DoctorService] Exception updating post-registration fields on doctors:", updateEx);
        }

        // Also synchronize doctor_phone and full name with profiles table
        if (doctor.user_id) {
          try {
            const profileUpdates: any = { role: "doctor" };
            if (fullName) profileUpdates.name = fullName;
            if (postRegUpdates.doctor_phone) profileUpdates.phone_number = postRegUpdates.doctor_phone;
            await supabase
              .from("profiles")
              .update(profileUpdates)
              .eq("id", doctor.user_id);
            console.log("[DoctorService] Profiles table synced with role and phone_number");
          } catch (profileErr) {
            console.warn("[DoctorService] Could not update profile phone during RPC registration:", profileErr);
          }
        }

        return {
          ...doctor,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          gender: postRegUpdates.gender ?? doctor.gender,
          id: result.doctor_id || doctor.id,
          doctor_phone: postRegUpdates.doctor_phone ?? doctor.doctor_phone,
          years_of_experience: postRegUpdates.years_of_experience,
          office_hours: postRegUpdates.office_hours,
        } as Doctor;
      }
    }

    // Fallback UPSERT: For existing doctors or environments without access code requirement
    const { is_available, ...rawCleanDoctor } = doctor as any;
    const cleanDoctor = {
      ...rawCleanDoctor,
      role: "doctor",
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      gender: doctor.gender ? doctor.gender.trim() : null,
      doctor_phone: doctor.doctor_phone ? doctor.doctor_phone.trim() : null,
      license_number: licenseNumber,
      specialization,
      bio,
      years_of_experience: Number(doctor.years_of_experience) || 0,
      office_hours: doctor.office_hours || EMPTY_DOCTOR.office_hours,
    };
    delete cleanDoctor.doctor_name;

    // Synchronize name and phone with profiles table if user_id is available
    if (cleanDoctor.user_id) {
      try {
        const profileUpdates: any = {
          id: cleanDoctor.user_id,
          role: "doctor",
          updated_at: new Date().toISOString(),
        };
        if (fullName) profileUpdates.name = fullName;
        if (cleanDoctor.doctor_phone) profileUpdates.phone_number = cleanDoctor.doctor_phone;
        await supabase
          .from("profiles")
          .upsert([profileUpdates], { onConflict: "id" });
      } catch (profileErr) {
        console.warn("[DoctorService] Could not update profile during doctor creation:", profileErr);
      }
    }

    let { data, error } = await supabase
      .from("doctors")
      .upsert([cleanDoctor], { onConflict: "user_id" })
      .select()
      .single();

    // If database table does not yet have gender column (error 42703), retry without gender
    if (error && error.code === "42703" && error.message?.includes("gender")) {
      console.warn("[DoctorService] Database table lacks gender column, retrying without gender...");
      const withoutGender = { ...cleanDoctor };
      delete withoutGender.gender;
      const retryRes = await supabase
        .from("doctors")
        .upsert([withoutGender], { onConflict: "user_id" })
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    // If database table does not yet have first_name column (error 42703), retry with doctor_name
    if (error && error.code === "42703" && error.message?.includes("first_name")) {
      console.warn("[DoctorService] Database table lacks first_name column, retrying with doctor_name...");
      const legacyDoctor = { ...rawCleanDoctor, doctor_name: fullName };
      delete legacyDoctor.first_name;
      delete legacyDoctor.middle_name;
      delete legacyDoctor.last_name;
      delete legacyDoctor.gender;

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

    if (updates.role === "assistant") {
      return updateAssistantProfile(doctorId, {
        first_name: cleanUpdates.first_name,
        middle_name: cleanUpdates.middle_name,
        last_name: cleanUpdates.last_name,
        phone: cleanUpdates.doctor_phone,
        gender: cleanUpdates.gender,
        profile_picture_url: cleanUpdates.profile_picture_url,
      }) as any;
    }

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

    // If error indicates gender column does not exist on doctors table, retry without it
    if (error && (error.message?.includes("gender") || error.code === "42703")) {
      console.warn("[DoctorService] Column gender missing on doctors table, retrying update without it...");
      const { gender, ...withoutGender } = cleanUpdates;
      const retryResult = await supabase
        .from("doctors")
        .update({
          ...withoutGender,
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

    // Cache gender to AsyncStorage and user_metadata as robust fallback
    if (cleanUpdates.gender) {
      const targetUserId = cleanUpdates.user_id || doctorId;
      try {
        await AsyncStorage.setItem(`@doctor_gender_${targetUserId}`, cleanUpdates.gender);
        supabase.auth.updateUser({ data: { gender: cleanUpdates.gender } }).catch(() => {});
      } catch (cacheErr) {
        console.warn("[DoctorService] Could not cache gender:", cacheErr);
      }
    }

    // Also synchronize assistants table if assistant record exists
    const targetUserId = cleanUpdates.user_id || doctorId;
    try {
      const astUpdate: any = { updated_at: new Date().toISOString() };
      if (cleanUpdates.first_name) astUpdate.first_name = cleanUpdates.first_name;
      if (cleanUpdates.middle_name !== undefined) astUpdate.middle_name = cleanUpdates.middle_name;
      if (cleanUpdates.last_name) astUpdate.last_name = cleanUpdates.last_name;
      if (cleanUpdates.doctor_phone) astUpdate.phone = cleanUpdates.doctor_phone;
      if (cleanUpdates.gender) astUpdate.gender = cleanUpdates.gender;
      if (cleanUpdates.profile_picture_url) astUpdate.profile_picture_url = cleanUpdates.profile_picture_url;

      await supabase
        .from("assistants")
        .update(astUpdate)
        .or(`id.eq.${targetUserId},user_id.eq.${targetUserId}`);
    } catch (astUpdErr) {
      console.warn("[DoctorService] Notice updating assistants table:", astUpdErr);
    }

    if (error) {
      console.error("[DoctorService] Error updating doctor profile:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    const resultDoc = (data || { ...cleanUpdates, id: doctorId }) as Doctor;
    if (cleanUpdates.gender && (!resultDoc.gender || resultDoc.gender !== cleanUpdates.gender)) {
      resultDoc.gender = cleanUpdates.gender;
    }

    return resultDoc;
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
 * Check if doctor license already exists in the doctors table
 * @param licenseNumber - License number to check (checks both raw and 7-digit padded versions)
 * @param excludeDoctorId - Optional doctor ID to exclude (useful when editing own profile)
 * @returns true if license exists on another doctor record, false otherwise
 */
export async function doctorLicenseExists(
  licenseNumber: string,
  excludeDoctorId?: string
): Promise<boolean> {
  try {
    const trimmed = (licenseNumber || "").trim();
    if (!trimmed) return false;

    const padded = trimmed.replace(/[^0-9]/g, "").padStart(7, "0").slice(-7);
    const variants = Array.from(new Set([trimmed, padded].filter(Boolean)));

    let query = supabase
      .from("doctors")
      .select("id, user_id")
      .in("license_number", variants);

    if (excludeDoctorId) {
      query = query.neq("id", excludeDoctorId).neq("user_id", excludeDoctorId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error("[DoctorService] Error checking license uniqueness:", error);
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch (error) {
    console.error("[DoctorService] Exception in doctorLicenseExists:", error);
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

export type DoctorGuideId = 'dashboard' | 'appointments' | 'records' | 'billing' | 'requests';

export const ALL_DOCTOR_GUIDES: DoctorGuideId[] = [
  'dashboard',
  'appointments',
  'records',
  'billing',
  'requests',
];

const GUIDE_STORAGE_KEYS: Record<DoctorGuideId, (userId: string) => string> = {
  dashboard: (id) => `@smileguard_doctor_interactive_tour_completed_${id}`,
  appointments: (id) => `@smileguard_doctor_appointments_walkthrough_completed_${id}`,
  records: (id) => `@smileguard_doctor_records_walkthrough_completed_${id}`,
  billing: (id) => `@smileguard_doctor_billing_walkthrough_completed_${id}`,
  requests: (id) => `@smileguard_doctor_appointment_requests_walkthrough_completed_${id}`,
};

/**
 * Check if the doctor has completed all walkthrough guides, or a specific guide step.
 * @param userId - The auth user ID of the doctor
 * @param guideId - Optional specific guide to check ('dashboard', 'appointments', 'records', 'billing', 'requests')
 * @returns boolean indicating whether the guide was completed
 */
export async function isDoctorGuideCompleted(
  userId: string,
  guideId?: DoctorGuideId
): Promise<boolean> {
  if (!userId) return true;
  try {
    // 1. If overall guide is marked as fully completed in AsyncStorage, return true
    const allCompletedLocal = await AsyncStorage.getItem(
      `@smileguard_doctor_all_guides_completed_${userId}`
    );
    if (allCompletedLocal === "true") return true;

    // 2. If checking a specific guide, check that guide's individual AsyncStorage key
    if (guideId) {
      const stepLocal = await AsyncStorage.getItem(GUIDE_STORAGE_KEYS[guideId](userId));
      if (stepLocal === "true") return true;
    }

    // 3. Database check from doctors table
    const { data, error } = await supabase
      .from("doctors")
      .select("guide_completed, completed_guides")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[DoctorService] Error checking guide_completed:", error);
      return false;
    }

    if (data?.guide_completed) {
      await AsyncStorage.setItem(`@smileguard_doctor_all_guides_completed_${userId}`, "true");
      return true;
    }

    const completedList: string[] = data?.completed_guides || [];

    // If checking a specific guide step, see if it is in completed_guides
    if (guideId) {
      if (completedList.includes(guideId)) {
        await AsyncStorage.setItem(GUIDE_STORAGE_KEYS[guideId](userId), "true");
        return true;
      }
      return false;
    }

    // If checking overall, verify if all required guides are in completedList
    const allDone = ALL_DOCTOR_GUIDES.every((g) => completedList.includes(g));
    if (allDone) {
      await AsyncStorage.setItem(`@smileguard_doctor_all_guides_completed_${userId}`, "true");
      return true;
    }

    return false;
  } catch (err) {
    console.error("[DoctorService] Exception in isDoctorGuideCompleted:", err);
    return false;
  }
}

/**
 * Mark a single walkthrough guide as completed.
 * Only turns doctors.guide_completed to TRUE in the database once ALL walkthroughs are completed!
 * @param userId - The auth user ID of the doctor
 * @param guideId - The specific guide completed ('dashboard', 'appointments', 'records', 'billing', 'requests')
 */
export async function markDoctorGuideCompleted(
  userId: string,
  guideId: DoctorGuideId
): Promise<boolean> {
  if (!userId) return false;
  try {
    // 1. Mark this specific walkthrough in AsyncStorage so it NEVER repeats when switching tabs
    await AsyncStorage.setItem(GUIDE_STORAGE_KEYS[guideId](userId), "true");

    // 2. Fetch current list of completed guides from local storage & Supabase
    let localCompleted: string[] = [];
    for (const g of ALL_DOCTOR_GUIDES) {
      const val = await AsyncStorage.getItem(GUIDE_STORAGE_KEYS[g](userId));
      if (val === "true") localCompleted.push(g);
    }

    const { data } = await supabase
      .from("doctors")
      .select("completed_guides, guide_completed")
      .eq("user_id", userId)
      .maybeSingle();

    const dbCompleted: string[] = data?.completed_guides || [];
    const combinedSet = new Set([...dbCompleted, ...localCompleted, guideId]);
    const updatedList = Array.from(combinedSet);

    // 3. Determine if ALL required walkthroughs are now finished
    const allCompleted = ALL_DOCTOR_GUIDES.every((g) => updatedList.includes(g));

    if (allCompleted) {
      await AsyncStorage.setItem(`@smileguard_doctor_all_guides_completed_${userId}`, "true");
    }

    // 4. Update Supabase doctors record
    const updatePayload: Record<string, any> = {
      completed_guides: updatedList,
      guide_completed: allCompleted,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("doctors")
      .update(updatePayload)
      .eq("user_id", userId);

    if (error) {
      console.warn("[DoctorService] Error saving completed_guides to doctors table:", error.message || error);
      if (error.message?.includes("completed_guides")) {
        await supabase
          .from("doctors")
          .update({ guide_completed: allCompleted, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
      return false;
    }

    return true;
  } catch (err) {
    console.error("[DoctorService] Exception in markDoctorGuideCompleted:", err);
    return false;
  }
}

/**
 * Mark all guides as completed at once (e.g. bypass or reset)
 * @param userId - The auth user ID of the doctor
 */
export async function setDoctorGuideCompleted(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    await AsyncStorage.setItem(`@smileguard_doctor_all_guides_completed_${userId}`, "true");
    for (const g of ALL_DOCTOR_GUIDES) {
      await AsyncStorage.setItem(GUIDE_STORAGE_KEYS[g](userId), "true");
    }

    const { error } = await supabase
      .from("doctors")
      .update({
        completed_guides: ALL_DOCTOR_GUIDES,
        guide_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.warn("[DoctorService] Error setting all guides completed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[DoctorService] Exception in setDoctorGuideCompleted:", err);
    return false;
  }
}

/**
 * Check if the assistant has completed all walkthrough guides, or a specific guide step.
 */
export async function isAssistantGuideCompleted(
  userId?: string | null,
  guideId: string = "dashboard"
): Promise<boolean> {
  if (!userId) return true;
  try {
    const key = guideId === "dashboard"
      ? `@smileguard_assistant_tour_completed_${userId}`
      : `@smileguard_assistant_${guideId}_walkthrough_completed_${userId}`;
    const local = await AsyncStorage.getItem(key);
    return local === "true";
  } catch (err) {
    console.error("[DoctorService] Exception in isAssistantGuideCompleted:", err);
    return false;
  }
}

/**
 * Mark an assistant walkthrough guide or tour as completed.
 */
export async function markAssistantGuideCompleted(
  userId?: string | null,
  guideId: string = "dashboard"
): Promise<boolean> {
  if (!userId) return false;
  try {
    const key = guideId === "dashboard"
      ? `@smileguard_assistant_tour_completed_${userId}`
      : `@smileguard_assistant_${guideId}_walkthrough_completed_${userId}`;
    await AsyncStorage.setItem(key, "true");
    return true;
  } catch (err) {
    console.error("[DoctorService] Exception in markAssistantGuideCompleted:", err);
    return false;
  }
}
