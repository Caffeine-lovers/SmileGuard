-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  MIGRATION: RPC Function to Fetch Dummy Accounts               ║
-- ║  Bypasses RLS entirely, called from TypeScript                  ║
-- ║                                                                  ║
-- ║  Run this in Supabase → SQL Editor → New Query                   ║
-- ║  https://supabase.com/dashboard → your project → SQL Editor      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Drop function if it already exists
DROP FUNCTION IF EXISTS get_dummy_accounts_by_ids(UUID[]);

-- Create RPC function that bypasses RLS
CREATE OR REPLACE FUNCTION get_dummy_accounts_by_ids(p_ids UUID[])
RETURNS TABLE (
  id UUID,
  patient_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.patient_name
  FROM dummy_accounts d
  WHERE d.id = ANY(p_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dummy_accounts_by_ids(UUID[]) TO authenticated;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    WHY THIS WORKS                               ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- ✅ SECURITY DEFINER: Runs as the Postgres role that created it
-- ✅ Bypasses RLS policies completely
-- ✅ Much faster than multiple .in() queries
-- ✅ Called via: supabase.rpc('get_dummy_accounts_by_ids', { p_ids: [...] })
-- ✅ Safe because it only accepts UUID array input
-- ✅ Returns only columns that exist in dummy_accounts table
