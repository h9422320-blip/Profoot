-- ═══════════════════════════════════════════════════════════════════
-- La courbe de précision, jour après jour
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- Le taux de réussite se recalcule à tout moment depuis les analyses. Mais un
-- taux instantané ne dit rien de la TENDANCE : impossible de savoir si le
-- moteur s'améliore, se dégrade, ou si un correctif a servi à quelque chose.
--
-- Sur onze matchs vérifiés, un seul résultat fait bouger le taux de neuf
-- points. C'est précisément pour cela qu'il faut une courbe : elle montre à la
-- fois la valeur et la quantité de matière derrière — et donc à partir de quand
-- le chiffre mérite d'être cru.
--
-- Une ligne par jour, écrite par la tâche planifiée. Rien à lancer à la main.

create table if not exists public.precision_quotidienne (
  -- Le jour observé. Clé primaire : deux passages le même jour mettent la
  -- ligne à jour au lieu d'en créer une seconde.
  jour date primary key,

  -- Ce qui a été vérifié CE JOUR-LÀ.
  matchs_jour integer not null default 0,
  issues_justes_jour integer not null default 0,
  scores_exacts_jour integer not null default 0,

  -- Le cumul depuis le début : c'est lui qui porte le taux affiché.
  matchs_cumules integer not null default 0,
  issues_justes_cumulees integer not null default 0,
  scores_exacts_cumules integer not null default 0,

  -- Analyses individuelles derrière ces matchs. Un match analysé quarante fois
  -- ne compte que pour un dans les colonnes ci-dessus ; ce nombre dit combien
  -- de personnes attendaient ce résultat.
  analyses_cumulees integer not null default 0,

  releve_le timestamptz not null default now()
);

create index if not exists precision_quotidienne_jour_idx
  on public.precision_quotidienne (jour desc);

-- Lue et écrite uniquement par le serveur. Aucune politique n'est définie :
-- avec RLS activé, aucun navigateur ne peut y accéder.
alter table public.precision_quotidienne enable row level security;

comment on table public.precision_quotidienne is
  'Courbe du taux de réussite. Une ligne par jour, écrite par la tâche planifiée.';
comment on column public.precision_quotidienne.matchs_cumules is
  'Nombre de matchs distincts vérifiés depuis le début. En dessous de 50, le taux reste indicatif.';
