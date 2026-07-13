-- Migration: Create monthly_stats table for ProFoot Admin Dashboard
-- Run this SQL in Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS public.monthly_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  new_users int DEFAULT 0,
  cancelled_users int DEFAULT 0,
  total_premium_users int DEFAULT 0,
  total_analyses int DEFAULT 0,
  marketing_budget_cfa bigint DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year, month)
);

-- Enable Row Level Security (but allow admin to read/write)
ALTER TABLE public.monthly_stats ENABLE ROW LEVEL SECURITY;

-- Allow service_role (backend/admin) full access
CREATE POLICY "Service role can do everything on monthly_stats"
  ON public.monthly_stats
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert initial data for 2026 (months Jan to Jul)
-- These are seeded with 0s so admin can update them via the dashboard
INSERT INTO public.monthly_stats (year, month, new_users, cancelled_users, total_premium_users, total_analyses, marketing_budget_cfa)
VALUES
  (2026, 1, 0, 0, 0, 0, 0),
  (2026, 2, 0, 0, 0, 0, 0),
  (2026, 3, 0, 0, 0, 0, 0),
  (2026, 4, 0, 0, 0, 0, 0),
  (2026, 5, 0, 0, 0, 0, 0),
  (2026, 6, 0, 0, 0, 0, 0),
  (2026, 7, 0, 0, 0, 0, 0)
ON CONFLICT (year, month) DO NOTHING;
