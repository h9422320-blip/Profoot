-- Passage à trois offres (Essentiel, Pro, VIP Annuel) et compteur d'analyses.
-- Migration ADDITIVE : aucune donnée existante n'est supprimée ni réécrite.

-- 1. Nouveaux identifiants de plan, en conservant les anciens.
--    'monthly', 'yearly' et 'lifetime' restent acceptés : les abonnements déjà
--    vendus continuent de fonctionner, ils sont interprétés côté application
--    (monthly -> Pro, yearly/lifetime -> VIP).
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN (
        'essential_monthly', 'pro_monthly', 'vip_yearly',
        'monthly', 'yearly', 'lifetime'
    ));

-- 2. Consommation des analyses.
--    Une ligne = une analyse décomptée. Compter des lignes est plus fiable
--    qu'incrémenter un compteur : deux requêtes simultanées ne peuvent pas
--    s'écraser mutuellement.
CREATE TABLE IF NOT EXISTS public.analysis_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Début de la période de facturation à laquelle l'analyse est rattachée.
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Identifie le match analysé (équipes + jour). La contrainte d'unicité
    -- ci-dessous en fait la protection contre les doubles consommations :
    -- double clic, réessai réseau ou requêtes simultanées produisent la même
    -- clé, donc une seule ligne — et relancer le même match dans la journée ne
    -- recoûte rien à l'utilisateur.
    match_key TEXT NOT NULL,
    plan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT analysis_usage_unique_per_match UNIQUE (user_id, match_key)
);

-- Requête la plus fréquente : « combien d'analyses sur la période en cours ».
CREATE INDEX IF NOT EXISTS idx_analysis_usage_user_period
    ON public.analysis_usage(user_id, period_start);

ALTER TABLE public.analysis_usage ENABLE ROW LEVEL SECURITY;

-- Lecture de sa propre consommation autorisée ; aucune écriture depuis le
-- navigateur : seul le serveur (service role, qui contourne la RLS) décompte.
DROP POLICY IF EXISTS "Users can view own analysis usage" ON public.analysis_usage;
CREATE POLICY "Users can view own analysis usage"
ON public.analysis_usage FOR SELECT
USING (auth.uid() = user_id);
