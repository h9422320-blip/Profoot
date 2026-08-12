-- ═══════════════════════════════════════════════════════════════════
-- Résultats de l'audit automatique
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- L'audit tourne sans personne devant l'écran. S'il ne laisse aucune trace,
-- il ne sert à rien : une anomalie détectée à trois heures du matin doit
-- pouvoir être lue le lendemain matin.
--
-- Chaque exécution enregistre son verdict complet. Comparer deux exécutions
-- permet aussi de distinguer un incident passager d'un défaut installé, ce
-- qu'un simple relevé instantané ne dit jamais.

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),

  -- Combien de points demandent une intervention, et combien sont à surveiller.
  anomalies integer not null default 0,
  avertissements integer not null default 0,

  -- Le détail, tel que produit : domaine, gravité, message.
  points jsonb not null default '[]',

  duree_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists audits_date_idx on public.audits (created_at desc);

-- Un audit décrit l'état interne de l'application : rien à faire dans un
-- navigateur. Sans politique déclarée, RLS active bloque tout accès client.
alter table public.audits enable row level security;

comment on table public.audits is
  'Verdicts de l''audit automatique. Cherche les pannes qui ne provoquent aucune erreur mais produisent des résultats faux.';
