/**
 * Supabase Storage Setup Verification
 * Helps diagnose and troubleshoot image upload issues
 */

import { supabase } from "@smileguard/supabase-client";

export interface StorageCheckResult {
  bucketExists: boolean;
  bucketsAvailable: string[];
  hasPublicAccess: boolean;
  canAuthenticate: boolean;
  error?: string;
}

/**
 * Check if storage bucket is properly configured
 */
export const checkStorageSetup = async (): Promise<StorageCheckResult> => {
  const result: StorageCheckResult = {
    bucketExists: false,
    bucketsAvailable: [],
    hasPublicAccess: false,
    canAuthenticate: false,
  };

  try {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    result.canAuthenticate = !!user;
    console.log("🔐 User authenticated:", !!user);

    // List all buckets
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error("❌ Failed to list buckets:", bucketsError);
        result.error = `Failed to list buckets: ${bucketsError.message}`;
      } else if (buckets) {
        result.bucketsAvailable = buckets.map(b => b.name);
        console.log("📦 Available buckets:", result.bucketsAvailable);
        result.bucketExists = buckets.some(b => b.name === "doctor-pictures");
      }
    } catch (bucketListError) {
      console.error("❌ Error listing buckets:", bucketListError);
      // This might fail if the bucket doesn't exist, which is expected
    }

    // Try to access the doctor-pictures bucket
    if (result.bucketExists || result.bucketsAvailable.includes("doctor-pictures")) {
      console.log("✅ doctor-pictures bucket found");
      result.hasPublicAccess = true;
    } else {
      console.error("❌ doctor-pictures bucket NOT found");
      result.error = result.error || "doctor-pictures bucket does not exist. Please create it in Supabase Dashboard.";
    }

    return result;
  } catch (error) {
    console.error("❌ Storage check failed:", error);
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
};

/**
 * Log storage setup diagnostics
 */
export const logStorageDiagnostics = async (): Promise<void> => {
  console.log("\n" + "=".repeat(50));
  console.log("🔍 STORAGE SETUP DIAGNOSTICS");
  console.log("=".repeat(50));

  const result = await checkStorageSetup();

  console.log("\n📋 Check Results:");
  console.log(`  - User Authenticated: ${result.canAuthenticate ? "✅" : "❌"}`);
  console.log(`  - doctor-pictures Bucket Exists: ${result.bucketExists ? "✅" : "❌"}`);
  console.log(`  - Has Public Access: ${result.hasPublicAccess ? "✅" : "❌"}`);
  console.log(`  - Available Buckets: ${result.bucketsAvailable.length > 0 ? result.bucketsAvailable.join(", ") : "None"}`);

  if (result.error) {
    console.log(`\n⚠️  Issue Found:\n  ${result.error}`);
  }

  console.log("\n" + "=".repeat(50));

  // Provide setup instructions if bucket doesn't exist
  if (!result.bucketExists && result.bucketsAvailable.length === 0) {
    console.log("\n📚 SETUP INSTRUCTIONS:");
    console.log(`
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to Storage (left sidebar)
3. Click "Create New Bucket"
4. Set the following:
   - Name: doctor-pictures
   - Make it PUBLIC
5. Click Create
6. Restart your Expo app after creating the bucket
    `);
  }
};
