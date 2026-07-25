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
