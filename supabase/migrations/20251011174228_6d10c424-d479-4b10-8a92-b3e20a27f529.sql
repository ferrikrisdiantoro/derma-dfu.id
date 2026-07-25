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