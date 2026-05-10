import { supabase } from '@smileguard/supabase-client'; // adjust import to your monorepo setup

export const uploadPatientProfilePicture = async (userId: string, file: File) => {
  try {
    // 1. Create a unique path (e.g., profile/user123/profile_1692837.jpg)
    const fileExt = file.name.split('.').pop();
    const filePath = `profile/${userId}/profile_${Date.now()}.${fileExt}`;

    // 2. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('patient-pictures')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // 3. Get the public URL for the newly uploaded image
    const { data: publicUrlData } = supabase.storage
      .from('patient-pictures')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 4. Update the Patient's database record with the new URL
    const { error: dbError } = await supabase
      .from('patients')
      .update({ profile_picture_url: publicUrl })
      .eq('id', userId);

    if (dbError) throw dbError;

    return publicUrl;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
};