// Supabase Edge Function for verifying doctor access codes
// Deploy with: supabase functions deploy verify-doctor-code

import { createClient } from "npm:@supabase/supabase-js@2.33.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with the service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Server configuration error",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

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

    // Query the database for valid, active codes
    const { data, error } = await supabase
      .from("doctor_access_codes")
      .select("id, code, label")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
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
        label: data.label,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
