-- Fix security issues in triage_records table

-- 1. Delete orphaned records with NULL user_id (18 records)
-- These cannot be properly protected by RLS policies
DELETE FROM triage_records WHERE user_id IS NULL;

-- 2. Remove the dangerous public access policy
DROP POLICY IF EXISTS "Allow public access to triage_records" ON triage_records;

-- 3. Make user_id NOT NULL to prevent future orphaned records
ALTER TABLE triage_records ALTER COLUMN user_id SET NOT NULL;