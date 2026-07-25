-- Assign admin role to existing admin@test.com user if exists
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user id
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@test.com';
  
  -- If user exists, assign admin role
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;