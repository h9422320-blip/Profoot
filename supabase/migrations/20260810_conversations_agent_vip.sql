-- ============================================================================
-- Conversations de l'Agent VIP
-- ============================================================================
--
-- Rien n'était conservé. Chaque échange entre un abonné et l'agent disparaissait
-- à la fermeture de son onglet : impossible de savoir ce qu'on demande à l'agent,
-- ce qu'il répond, s'il cherche vraiment avant de parler, ni ce que chaque
-- réponse coûte.
--
-- Cette table enregistre les faits mesurables de chaque échange. Aucun jugement
-- n'y est porté par une intelligence artificielle : tout ce qui est stocké est
-- constaté — le nombre de recherches web réellement lancées, les outils de
-- données appelés, la durée, les jetons consommés.
-- ============================================================================

create table if not exists public.vip_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,

  -- L'échange lui-même.
  question text not null,
  reponse text not null,

  -- Ce que l'agent a réellement fait pour répondre. Le nombre de recherches est
  -- la seule preuve qu'une réponse s'appuie sur l'actualité et non sur la
  -- mémoire du modèle : une réponse à zéro recherche est suspecte.
  recherches_web integer not null default 0,
  outils_appeles text[] default '{}',

  -- Coût et performance.
  modele text,
  duree_ms integer,
  jetons_entrants integer,
  jetons_sortants integer,
  jetons_cache integer,
  motif_arret text,

  created_at timestamptz not null default now()
);

create index if not exists vip_conversations_date_idx
  on public.vip_conversations (created_at desc);

create index if not exists vip_conversations_compte_idx
  on public.vip_conversations (user_id, created_at desc);

-- Ces échanges contiennent les questions d'abonnés identifiables : aucun accès
-- depuis le navigateur. Seul le serveur, via la clé de service, y accède. Sans
-- politique déclarée, RLS active bloque tout accès client — effet recherché.
alter table public.vip_conversations enable row level security;

comment on table public.vip_conversations is
  'Échanges avec l''Agent VIP et mesures objectives associées. Aucune notation par IA : seulement des faits constatés.';
comment on column public.vip_conversations.recherches_web is
  'Recherches web réellement effectuées. Zéro signale une réponse produite sans consulter l''actualité.';
