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