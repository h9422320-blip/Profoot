-- ═══════════════════════════════════════════════════════════════════
-- Échecs du moteur d'analyse
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- Quand le moteur d'analyse échouait, l'application servait discrètement un
-- texte de secours écrit en dur — le même pour tous les matchs, avec un score
-- inventé. Constaté sur 228 analyses réelles : 42 portaient ce texte, soit près
-- d'une sur cinq. Ni l'abonné ni l'administrateur n'en savaient rien.
--
-- Le choix retenu est de ne rien montrer à l'abonné : il reçoit une analyse
-- complète et exploitable, désormais calculée et non plus inventée. Mais
-- l'échec doit remonter quelque part, sans quoi la cause ne sera jamais
-- corrigée. C'est le rôle de cette table, lue uniquement par l'administration.
--
-- Elle enregistre ce qui permet de diagnostiquer : quel match, quel compte,
-- combien de temps la tentative a duré, et le message d'erreur exact.

create table if not exists public.analysis_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,

  -- De quel match il s'agissait.
  equipe1 text,
  equipe2 text,
  competition text,

  -- Ce qui a échoué. `cause` est une famille lisible (délai dépassé, quota,
  -- réponse illisible…), `message` le texte brut renvoyé par le moteur.
  cause text not null,
  message text,
  modele text,
  duree_ms integer,

  -- Vrai quand l'abonné a malgré tout reçu une analyse complète, calculée.
  -- Faux signalerait une requête réellement perdue.
  servi_quand_meme boolean not null default true,

  created_at timestamptz not null default now()
);

create index if not exists analysis_failures_date_idx
  on public.analysis_failures (created_at desc);

create index if not exists analysis_failures_cause_idx
  on public.analysis_failures (cause, created_at desc);

-- Aucun accès depuis le navigateur : ces lignes n'ont rien à faire chez
-- l'abonné, c'est tout l'objet de la démarche. Sans politique déclarée, RLS
-- active bloque tout accès client — effet recherché.
alter table public.analysis_failures enable row level security;

comment on table public.analysis_failures is
  'Échecs du moteur d''analyse, visibles uniquement dans l''administration. L''abonné reçoit une analyse calculée sans savoir que le modèle a échoué.';
