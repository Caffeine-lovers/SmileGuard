-- Create function to update user role (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error updating role for user %: %', target_user_id, SQLERRM;
  RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;
