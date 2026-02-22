// Supabase Edge Function for verifying doctor access codes
// Deploy with: supabase functions deploy verify-doctor-code

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with the service role (bypasses RLS)
    // Note: In production, use SUPABASE_SERVICE_ROLE_KEY env variable
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the code from request body
    const { code } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, error: "Code is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Query the database for valid codes
    const { data, error } = await supabase
      .from("doctor_access_codes")
      .select("id, code, label")
      .eq("code", code.toUpperCase())
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid code" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Code is valid
    return new Response(
      JSON.stringify({ 
        valid: true, 
        codeId: data.id,
        label: data.label 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
