-- Allow Admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow Admins to manage user roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow Admins to manage doctors
DROP POLICY IF EXISTS "Admins can manage doctors" ON public.doctors;
CREATE POLICY "Admins can manage doctors"
  ON public.doctors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
