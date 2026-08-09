-- ============================================================================
-- Partenaires influenceurs : contrats, dépenses et suivi
-- ============================================================================
--
-- Les accès offerts étaient de simples adresses e-mail dans le code. Cela
-- suffisait pour ouvrir un accès, mais ne disait rien de l'essentiel : qui est
-- cette personne, ce qui a été convenu avec elle, combien elle a coûté, et ce
-- qu'elle a rapporté.
--
-- Ces tables portent la partie commerciale. L'ouverture de l'accès VIP reste
-- gérée dans le code, là où elle fonctionne : une panne de base ne doit jamais
-- pouvoir retirer son accès à un partenaire.
-- ============================================================================

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),

  -- Clé de rapprochement avec le compte applicatif, quand il sera créé.
  email text not null unique,
  name text not null,
  handle text,                       -- pseudo public : « Becken.225 »
  platform text,                     -- TikTok, Instagram, YouTube…
  country text,
  audience text,                     -- description de la communauté

  -- Montant convenu, dans la devise réellement versée. Les deux premiers
  -- contrats sont en euros et en dollars : convertir en FCFA ferait perdre le
  -- montant réel de la transaction.
  amount numeric(12, 2) default 0,
  currency text default 'EUR',
  paid boolean default false,
  paid_at timestamptz,

  -- Ce qui a été convenu, en toutes lettres.
  terms text,
  starts_on date,
  ends_on date,

  status text not null default 'actif',   -- actif | termine | suspendu
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partners is
  'Contrats des partenaires influenceurs : identité, montant versé, termes convenus. L''accès VIP lui-même reste géré dans le code.';

-- ----------------------------------------------------------------------------
-- Relevés périodiques : vues cumulées, publications, remarques.
-- ----------------------------------------------------------------------------
-- Le suivi convenu est hebdomadaire, relevé chaque lundi. Une table séparée
-- plutôt qu'un compteur unique : on veut voir la progression semaine après
-- semaine, pas seulement le dernier chiffre.
create table if not exists public.partner_reports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,

  period_start date not null,
  period_end date not null,
  views integer default 0,
  posts integer default 0,
  signups integer default 0,          -- inscriptions attribuées, si mesurable
  notes text,

  created_at timestamptz not null default now(),
  unique (partner_id, period_start)
);

create index if not exists partner_reports_partenaire_idx
  on public.partner_reports (partner_id, period_start desc);

-- ----------------------------------------------------------------------------
-- Accès réservé à l'administration.
-- ----------------------------------------------------------------------------
-- Ces tables contiennent des montants et des accords commerciaux : aucun accès
-- depuis le navigateur d'un abonné. Seul le serveur, via la clé de service, y
-- accède. Sans politique déclarée, RLS active bloque tout le monde côté client,
-- ce qui est exactement l'effet recherché.
alter table public.partners enable row level security;
alter table public.partner_reports enable row level security;
