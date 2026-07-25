-- BUNDLE MIGRASI DERMA-DFU.ID
-- Jalankan di Supabase Dashboard: SQL Editor -> New query -> paste semua -> Run
-- Dibuat: 2026-07-25


-- =====================================
-- MIGRATION: 20251011174228_6d10c424-d479-4b10-8a92-b3e20a27f529.sql
-- =====================================
-- Create triage_records table
CREATE TABLE public.triage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID,
  photo_url TEXT,
  triage_result TEXT NOT NULL CHECK (triage_result IN ('red', 'yellow', 'green')),
  has_scale_card BOOLEAN DEFAULT false,
  wound_duration INTEGER,
  wound_location TEXT,
  has_fever BOOLEAN DEFAULT false,
  has_smell_pus BOOLEAN DEFAULT false,
  has_spreading_redness BOOLEAN DEFAULT false,
  has_rest_pain BOOLEAN DEFAULT false,
  has_foot_pulse BOOLEAN DEFAULT true,
  has_black_cold_skin BOOLEAN DEFAULT false,
  diabetes_history TEXT,
  kidney_condition TEXT DEFAULT 'none',
  abi_value NUMERIC,
  notes TEXT,
  ai_summary TEXT,
  infection_class INTEGER,
  infection_prob NUMERIC,
  ischaemia_prob NUMERIC,
  wound_area_cm2 NUMERIC
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  triage_id UUID REFERENCES public.triage_records(id) ON DELETE CASCADE NOT NULL,
  facility TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  consultation_type TEXT CHECK (consultation_type IN ('video', 'phone', 'inperson')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.triage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Create policies (public untuk development, nanti bisa tambahkan auth)
CREATE POLICY "Allow public access to triage_records" 
  ON public.triage_records 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow public access to referrals" 
  ON public.referrals 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create storage bucket for wound photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wound-photos', 'wound-photos', true);

-- Storage policies
CREATE POLICY "Allow public upload to wound-photos" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'wound-photos');

CREATE POLICY "Allow public read from wound-photos" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'wound-photos');

-- Create indexes for better query performance
CREATE INDEX idx_triage_created_at ON public.triage_records(created_at DESC);
CREATE INDEX idx_triage_result ON public.triage_records(triage_result);
CREATE INDEX idx_referrals_triage_id ON public.referrals(triage_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

-- =====================================
-- MIGRATION: 20251013042508_246fbf73-d1d1-4d45-9930-a0e4ed6ac640.sql
-- =====================================
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

-- =====================================
-- MIGRATION: 20251013045006_b66eb195-7815-4737-a707-0858470ed67c.sql
-- =====================================
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

-- =====================================
-- MIGRATION: 20251013160038_6bb519ea-b949-4213-be5d-73295aa31d2c.sql
-- =====================================
-- Add new columns to triage_records for 4-class model and detailed metrics
ALTER TABLE public.triage_records
ADD COLUMN IF NOT EXISTS wound_area_px integer,
ADD COLUMN IF NOT EXISTS wound_area_pct numeric,
ADD COLUMN IF NOT EXISTS infection_prob_present numeric,
ADD COLUMN IF NOT EXISTS top_class_name text,
ADD COLUMN IF NOT EXISTS top_class_prob numeric,
ADD COLUMN IF NOT EXISTS calibration_mm_per_px numeric,
ADD COLUMN IF NOT EXISTS model_gated boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.triage_records.infection_prob_present IS 'Probability that infection is present (p_inf_present for 4-class)';
COMMENT ON COLUMN public.triage_records.top_class_name IS 'Top predicted class name (None/Infection/Ischaemia/Both)';
COMMENT ON COLUMN public.triage_records.top_class_prob IS 'Probability of the top class';
COMMENT ON COLUMN public.triage_records.wound_area_px IS 'Wound area in pixels';
COMMENT ON COLUMN public.triage_records.wound_area_pct IS 'Wound area as percentage of photo';
COMMENT ON COLUMN public.triage_records.calibration_mm_per_px IS 'Calibration scale in mm per pixel';
COMMENT ON COLUMN public.triage_records.model_gated IS 'Whether AI prediction was gated due to small wound area';

-- =====================================
-- MIGRATION: 20251013165045_4511d8b3-0d7b-4760-a84b-7c84c3767be6.sql
-- =====================================
-- Fix security issues in triage_records table

-- 1. Delete orphaned records with NULL user_id (18 records)
-- These cannot be properly protected by RLS policies
DELETE FROM triage_records WHERE user_id IS NULL;

-- 2. Remove the dangerous public access policy
DROP POLICY IF EXISTS "Allow public access to triage_records" ON triage_records;

-- 3. Make user_id NOT NULL to prevent future orphaned records
ALTER TABLE triage_records ALTER COLUMN user_id SET NOT NULL;

-- =====================================
-- MIGRATION: 20251210120000_add_doctor_teleconsultation.sql
-- =====================================
-- Add 'doctor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';

-- Create doctors table (linked to profiles)
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialization text NOT NULL,
  experience_years integer DEFAULT 0,
  str_number text, 
  sip_number text,
  is_online boolean DEFAULT false,
  price numeric DEFAULT 0,
  rating numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for doctors
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Doctors RLS
CREATE POLICY "Public can view doctors" 
  ON public.doctors FOR SELECT 
  USING (true);

CREATE POLICY "Doctors can update their own info" 
  ON public.doctors FOR UPDATE 
  USING (auth.uid() = id);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.referrals(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat RLS
-- Users can view messages if they are the patient (via referral -> triage -> user_id) or the doctor (if we assign doctors to referrals later)
-- For now, let's assume the 'doctor' finding mechanism might need a direct link in referral, OR we rely on admin/doctor role access.
-- Let's update referrals table to have a doctor_id column first.

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.profiles(id);

-- Update referrals policies to allow assigned doctor to view
DROP POLICY IF EXISTS "Doctors can view assigned referrals" ON public.referrals;
CREATE POLICY "Doctors can view assigned referrals"
  ON public.referrals FOR SELECT
  USING (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Doctors can update assigned referrals" ON public.referrals;
CREATE POLICY "Doctors can update assigned referrals"
  ON public.referrals FOR UPDATE
  USING (doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Chat policies
CREATE POLICY "Users can view messages for their referrals"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.referrals r
      JOIN public.triage_records tr ON r.triage_id = tr.id
      WHERE r.id = chat_messages.referral_id
      AND (tr.user_id = auth.uid() OR r.doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can send messages for their referrals"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.referrals r
      JOIN public.triage_records tr ON r.triage_id = tr.id
      WHERE r.id = referral_id
      AND (tr.user_id = auth.uid() OR r.doctor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );


-- =====================================
-- MIGRATION: 20251210123000_admin_manage_users.sql
-- =====================================
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

