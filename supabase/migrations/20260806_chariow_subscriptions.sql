-- Migration Chariow : plans monthly/yearly, traçabilité multi-fournisseur, idempotence des webhooks.

-- 1. Étendre les plans autorisés (yearly) tout en conservant l'historique (monthly, lifetime).
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('monthly', 'yearly', 'lifetime'));

-- 2. Traçabilité du fournisseur de paiement et de la vente Chariow.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'moneroo';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS chariow_sale_id TEXT UNIQUE;
ALTER TABLE public.subscriptions ALTER COLUMN provider SET DEFAULT 'chariow';

-- Index de recherche d'abonnement actif (requête la plus fréquente : droits d'accès).
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
    ON public.subscriptions(user_id, status, expires_at DESC);

-- 3. Idempotence des webhooks : chaque livraison Pulse (x-pulse-delivery-id) n'est traitée qu'une fois.
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'chariow',
    delivery_id TEXT NOT NULL UNIQUE,
    event TEXT NOT NULL,
    payload JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Aucune politique pour anon/authenticated : seul le service role (serveur) y accède.
