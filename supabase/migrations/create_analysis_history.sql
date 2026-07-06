-- Table analysis_history pour ProFoot AI
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS public.analysis_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Équipe 1
  team1_id TEXT NOT NULL,
  team1_name TEXT NOT NULL,
  team1_logo TEXT,
  team1_league TEXT,
  
  -- Équipe 2
  team2_id TEXT NOT NULL,
  team2_name TEXT NOT NULL,
  team2_logo TEXT,
  team2_league TEXT,
  
  -- Données de l'analyse
  competition TEXT,
  score TEXT,
  confidence INTEGER,
  summary TEXT,
  is_finished BOOLEAN DEFAULT FALSE,
  win_prob INTEGER,
  draw_prob INTEGER,
  lose_prob INTEGER,
  analysis_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index pour accélérer les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON public.analysis_history(created_at DESC);

-- Sécurité RLS (Row Level Security) — chaque utilisateur ne voit que ses propres données
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

-- Politique : lecture uniquement de ses propres analyses
CREATE POLICY "Users can view own history" ON public.analysis_history
  FOR SELECT USING (auth.uid() = user_id);

-- Politique : insertion uniquement pour soi-même
CREATE POLICY "Users can insert own history" ON public.analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique : suppression uniquement de ses propres analyses
CREATE POLICY "Users can delete own history" ON public.analysis_history
  FOR DELETE USING (auth.uid() = user_id);
