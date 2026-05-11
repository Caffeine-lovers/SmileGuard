// apps/patient-web/components/dashboard/uploadPatientProfilePicture.ts

import { supabase } from '@smileguard/supabase-client';

export const uploadPatientProfilePicture = async (userId: string, file: File) => {
  try {
    // Uses the bucket folder structure: {userId}/avatar.extension
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/avatar.${fileExt}`;

    // Upload to 'avatars' bucket (as per your new rules)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { 
        upsert: true,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Update the 'profiles' table with the url directly
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ Avatar_url: publicUrl })
      .eq('id', userId);

    if (dbError) throw dbError;

    // Return the URL with a cache-busting timestamp
    return `${publicUrl}?t=${Date.now()}`;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
};