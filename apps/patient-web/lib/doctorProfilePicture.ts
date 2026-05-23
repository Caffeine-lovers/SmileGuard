/**
 * Doctor Profile Picture Service
 * Fetches doctor profile pictures from Supabase storage bucket
 */

import { supabase } from '@smileguard/supabase-client';

/**
 * Fetch the most recent doctor profile picture URL from storage
 * Storage structure: doctor-pictures/profile/{doctorId}/image files
 * @param doctorId - The doctor's ID
 * @returns Public URL of the most recent image or null if not found
 */
export async function getDoctorProfilePictureUrl(
  doctorId: string
): Promise<string | null> {
  try {
    if (!doctorId) {
      console.warn('[getDoctorProfilePictureUrl] No doctorId provided');
      return null;
    }

    // List all files in the doctor's profile folder
    const { data, error } = await supabase.storage
      .from('doctor-pictures')
      .list(`profile/${doctorId}`, {
        limit: 100,
        sortBy: {
          column: 'created_at',
          order: 'desc',
        },
      });

    if (error) {
      console.error(
        `[getDoctorProfilePictureUrl] Error listing files for doctor ${doctorId}:`,
        error
      );
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`[getDoctorProfilePictureUrl] No profile pictures found for doctor ${doctorId}`);
      return null;
    }

    // Get the most recent image file (first one after sorting by created_at DESC)
    const mostRecentFile = data[0];

    if (!mostRecentFile.name) {
      console.warn(`[getDoctorProfilePictureUrl] File has no name for doctor ${doctorId}`);
      return null;
    }

    // Get the public URL for the file
    const { data: urlData } = supabase.storage
      .from('doctor-pictures')
      .getPublicUrl(`profile/${doctorId}/${mostRecentFile.name}`);

    if (!urlData?.publicUrl) {
      console.warn(`[getDoctorProfilePictureUrl] Could not generate public URL for doctor ${doctorId}`);
      return null;
    }

    console.log(`[getDoctorProfilePictureUrl] Found picture for doctor ${doctorId}:`, urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error(`[getDoctorProfilePictureUrl] Exception for doctor ${doctorId}:`, err);
    return null;
  }
}

/**
 * Batch fetch doctor profile pictures for multiple doctors
 * @param doctorIds - Array of doctor IDs
 * @returns Map of doctorId -> profile picture URL
 */
export async function getDoctorProfilePictureMap(
  doctorIds: string[]
): Promise<Record<string, string | null>> {
  try {
    const uniqueDoctorIds = [...new Set(doctorIds)].filter(Boolean);

    if (uniqueDoctorIds.length === 0) {
      return {};
    }

    const picturePromises = uniqueDoctorIds.map(async (doctorId) => ({
      doctorId,
      url: await getDoctorProfilePictureUrl(doctorId),
    }));

    const results = await Promise.all(picturePromises);

    const pictureMap: Record<string, string | null> = {};
    results.forEach(({ doctorId, url }) => {
      pictureMap[doctorId] = url;
    });

    console.log('[getDoctorProfilePictureMap] Fetched pictures for', uniqueDoctorIds.length, 'doctors');
    return pictureMap;
  } catch (err) {
    console.error('[getDoctorProfilePictureMap] Error fetching doctor pictures:', err);
    return {};
  }
}
