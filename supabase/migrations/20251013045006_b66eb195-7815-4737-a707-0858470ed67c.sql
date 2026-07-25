-- Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
USING (auth.uid() = user_id);

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create trigger function for new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Create trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update RLS for triage_records to include user_id check
ALTER TABLE public.triage_records ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Users can view their own triage records" ON public.triage_records;
CREATE POLICY "Users can view their own triage records"
ON public.triage_records FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert their own triage records" ON public.triage_records;
CREATE POLICY "Users can insert their own triage records"
ON public.triage_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all triage records" ON public.triage_records;
CREATE POLICY "Admins can view all triage records"
ON public.triage_records FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS for referrals
DROP POLICY IF EXISTS "Allow public access to referrals" ON public.referrals;

DROP POLICY IF EXISTS "Users can view referrals for their triages" ON public.referrals;
CREATE POLICY "Users can view referrals for their triages"
ON public.referrals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.triage_records tr
    WHERE tr.id = referrals.triage_id
    AND tr.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Users can insert referrals for their triages" ON public.referrals;
CREATE POLICY "Users can insert referrals for their triages"
ON public.referrals FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.triage_records tr
    WHERE tr.id = referrals.triage_id
    AND tr.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all referrals" ON public.referrals;
CREATE POLICY "Admins can manage all referrals"
ON public.referrals FOR ALL
USING (public.has_role(auth.uid(), 'admin'));