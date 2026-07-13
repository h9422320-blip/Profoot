-- Migration: Add tables for AI conversations and Activity Logs
-- 20260713_tracking.sql

CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    score NUMERIC(5,2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own ai conversations" 
    ON public.ai_conversations FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai conversations" 
    ON public.ai_conversations FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ai conversations" 
    ON public.ai_conversations FOR SELECT 
    USING (true);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    country TEXT,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own logs" 
    ON public.activity_logs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own logs" 
    ON public.activity_logs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" 
    ON public.activity_logs FOR SELECT 
    USING (true);
