/**
 * Image Upload Service
 * Handles uploading images to Supabase Storage
 */

import * as ImagePicker from "expo-image-picker";
import { supabase } from "@smileguard/supabase-client";

export interface ImagePickerResult {
  uri: string;
  name: string;
  type: string;
}

/**
 * Request permission to access device media library
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error(" Permission request failed:", error);
    return false;
  }
};

/**
 * Pick an image from device and return file info
 */
export const pickImage = async (): Promise<ImagePickerResult | null> => {
  try {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      throw new Error("Media library permission denied");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1], // Square for profile pictures
      quality: 0.7,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    const fileUri = asset.uri;

    // Extract filename from URI or create one
    let filename = "profile_picture";
    if (fileUri.includes("/")) {
      const parts = fileUri.split("/");
      filename = parts[parts.length - 1] || filename;
    }

    return {
      uri: fileUri,
      name: filename,
      type: asset.mimeType || "image/jpeg",
    };
  } catch (error) {
    console.error(" Image picker failed:", error);
    throw error;
  }
};

/**
 * Upload image to Supabase Storage
 * Uses direct binary upload to avoid unnecessary string conversions
 * @param image Image to upload
 * @param userId User ID for organizing storage
 * @returns URL of uploaded image
 */
export const uploadProfileImage = async (
  image: ImagePickerResult,
  userId: string
): Promise<string> => {
  try {
    console.log(" Starting image upload...");
    console.log(" Image URI:", image.uri);
    console.log(" Image type:", image.type);

    // Create unique filename
    const timestamp = Date.now();
    const filename = `doctor-profiles/${userId}/profile_${timestamp}`;

    console.log(" Uploading to path:", filename);

    try {
      console.log("🔄 Reading image file as binary...");
      
      // Use fetch to get binary data directly without string conversion
      const response = await fetch(image.uri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      // Get blob directly - this avoids unnecessary string encoding
      const blob = await response.blob();
      console.log("✅ Image blob retrieved, size:", blob.size, "bytes");

      // Upload to Supabase Storage with binary blob
      console.log("📤 Uploading to Supabase storage...");
      console.log("📦 Bucket: doctor-pictures");
      console.log("📦 Content-Type:", image.type || "image/jpeg");
      
      const { data, error } = await supabase.storage
        .from("doctor-pictures")
        .upload(filename, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: image.type || "image/jpeg",
        });

      if (error) {
        console.error("❌ Supabase upload error details:");
        console.error("  - Message:", error.message);
        console.error("  - Name:", error.name);
        console.error("  - Status:", (error as any).status);
        console.error("  - Full Error:", JSON.stringify(error));
        
        // Provide more specific error messages
        if (error.message.includes("Network request failed")) {
          console.error("💡 This usually means:");
          console.error("   1. The 'doctor-pictures' bucket doesn't exist");
          console.error("   2. The bucket is not set to PUBLIC");
          console.error("   3. There's a CORS issue");
          throw new Error(
            "Storage bucket error. Please verify:\\n1. Bucket 'doctor-pictures' exists\\n2. Bucket is set to PUBLIC\\n3. Check Supabase dashboard"
          );
        }
        
        if (error.message.includes("Failed to fetch")) {
          throw new Error(
            "Failed to reach Supabase. Check your internet and Supabase URL."
          );
        }
        
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log(" Upload successful:", data);

      // Get public URL
      console.log("🔗 Generating public URL...");
      const { data: publicUrl } = supabase.storage
        .from("doctor-pictures")
        .getPublicUrl(filename);

      if (!publicUrl?.publicUrl) {
        throw new Error("Failed to generate public URL");
      }

      console.log("✅ Public URL generated successfully");
      return publicUrl.publicUrl;
      
    } catch (uploadError) {
      const errorMsg = uploadError instanceof Error 
        ? uploadError.message 
        : JSON.stringify(uploadError);
      
      console.error("❌ File processing or upload error:", errorMsg);
      throw uploadError;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image upload failed";
    console.error(" Upload error:", message);
    throw error;
  }
};

/**
 * Delete image from Supabase Storage
 */
export const deleteProfileImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract path from URL
    const urlParts = imageUrl.split("/storage/v1/object/public/doctor-pictures/");
    if (urlParts.length < 2) {
      throw new Error("Invalid image URL");
    }

    const filePath = decodeURIComponent(urlParts[1]);
    console.log("️  Deleting image:", filePath);

    const { error } = await supabase.storage
      .from("doctor-pictures")
      .remove([filePath]);

    if (error) {
      throw error;
    }

    console.log(" Image deleted successfully");
  } catch (error) {
    console.error(" Delete failed:", error);
    throw error;
  }
};
