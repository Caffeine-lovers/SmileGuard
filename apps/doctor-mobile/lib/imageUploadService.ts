/**
 * Image Upload Service
 * Handles uploading images to Supabase Storage
 * 
 * IMPORTANT: The 'doctor-pictures' bucket must exist and be set to PUBLIC in Supabase
 * SQL migration to create bucket:
 * 
 * -- Create the bucket if it doesn't exist
 * INSERT INTO storage.buckets (id, name, public)
 * VALUES ('doctor-pictures', 'doctor-pictures', true)
 * ON CONFLICT (id) DO NOTHING;
 * 
 * -- Set RLS policies (see setupStoragePolicies.sql)
 */

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
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
    console.error("[ImageUpload] Image picker failed:", error);
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
    console.log("[ImageUpload] Starting image upload...");
    console.log("[ImageUpload] Image URI:", image.uri);
    console.log("[ImageUpload] Image type:", image.type);

    // Create unique filename
    const timestamp = Date.now();
    const filename = `profile/${userId}/profile_${timestamp}`;

    console.log("[ImageUpload] Uploading to path:", filename);

    try {
      console.log("[ImageUpload] Reading image file as base64...");
      
      // Read file as base64 using expo-file-system (more reliable than fetch on React Native)
      const base64 = await FileSystem.readAsStringAsync(image.uri, {
        encoding: 'base64' as any,
      });
      
      console.log("[ImageUpload] File read successfully, converting to binary...");
      
      // Convert base64 to Uint8Array for upload
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      console.log("[ImageUpload] Binary conversion complete, size:", bytes.length, "bytes");

      // Upload to Supabase Storage with binary data
      console.log("[ImageUpload] Uploading to Supabase storage...");
      console.log("[ImageUpload] Bucket: doctor-pictures");
      console.log("[ImageUpload] Content-Type:", image.type || "image/jpeg");
      
      const { data, error } = await supabase.storage
        .from("doctor-pictures")
        .upload(filename, bytes, {
          cacheControl: "3600",
          upsert: true,
          contentType: image.type || "image/jpeg",
        });

      if (error) {
        console.error("[ImageUpload] Supabase upload error details:");
        console.error("  - Message:", error.message);
        console.error("  - Name:", error.name);
        console.error("  - Status:", (error as any).status);
        console.error("  - Full Error:", JSON.stringify(error));
        
        // Provide more specific error messages
        if (error.message.includes("Network request failed") || error.message.includes("bucket")) {
          console.error("[ImageUpload] Upload failed:");
          console.error("   1. Check your internet connection");
          console.error("   2. Verify Supabase project is accessible");
          console.error("   3. Check bucket 'doctor-pictures' exists");
          throw new Error(
            "Upload failed. Possible causes:\n1. No internet connection\n2. Supabase project unreachable\n3. Bucket 'doctor-pictures' missing"
          );
        }
        
        if (error.message.includes("Failed to fetch")) {
          throw new Error(
            "Failed to reach Supabase. Check your internet and Supabase URL."
          );
        }
        
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log("[ImageUpload] Upload successful:", data);

      // Get public URL
      console.log("[ImageUpload] Generating public URL...");
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
