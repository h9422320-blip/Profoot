-- ═══════════════════════════════════════════════════════════════════
-- Les pronostics vérifiés, montrés publiquement
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- Environ 70 % des inscrits lancent une analyse, 1,7 % s'abonnent. Le blocage
-- n'est pas le prix : rien ne prouve au visiteur que l'IA tombe juste. Il voit
-- une analyse floutée à 85 % et doit payer pour vérifier. Personne ne fait ça.
--
-- UNE LIGNE PAR MATCH, PAS PAR ANALYSE
--
-- Quarante-deux personnes ont analysé Paris Saint-Germain — Aston Villa. Cela
-- ne fait pas quarante-deux preuves : cela en fait UNE. Compter les analyses
-- laisserait une seule affiche décider de tout l'affichage — c'est exactement
-- le défaut qui avait hissé le taux de scores exacts à 67 %.
--
-- Le pronostic retenu pour un match est celui de la MAJORITÉ des analyses :
-- c'est ce que l'application a réellement annoncé à ses utilisateurs ce jour-là.

create table if not exists public.preuves (
  id uuid primary key default gen_random_uuid(),

  -- Identifiant du match chez le fournisseur. Unique : c'est lui qui garantit
  -- qu'un match ne peut pas apparaître deux fois dans le mur de preuves.
  fixture_id bigint unique,

  team1_name text not null,
  team1_logo text,
  team2_name text not null,
  team2_logo text,
  competition text,
  date_match timestamptz,

  -- Ce que ProFoot a annoncé, avant le match.
  prono_issue text,                    -- team1 | draw | team2
  prono_score text,                    -- « 2 - 1 »

  -- Ce qui s'est réellement passé.
  score_reel text,
  issue_reelle text,

  -- Calculés, jamais saisis à la main.
  issue_correcte boolean not null default false,
  score_exact boolean not null default false,

  -- Curation. « publiee » décide de l'affichage public ; « mise_en_avant »
  -- remonte la preuve en tête du mur.
  publiee boolean not null default false,
  mise_en_avant boolean not null default false,
  ordre integer not null default 0,

  -- D'où vient le résultat réel : relevé automatiquement, ou saisi à la main
  -- quand le fournisseur n'a pas su retrouver la rencontre.
  source text not null default 'auto',
  saisi_par text,

  -- Combien d'analyses ont produit ce pronostic. Sert au suivi interne, jamais
  -- affiché : un match analysé une seule fois reste une preuve valable.
  analyses_comptees integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ═══ LE GARDE-FOU ═══
  -- Un pronostic raté ne peut PAS être publié. Pas « ne devrait pas » : ne
  -- peut pas. La base refuse l'écriture. Une erreur de code, une case cochée
  -- par mégarde ou une requête maladroite ne pourront jamais afficher un échec
  -- sur le mur de preuves.
  constraint preuve_publiee_est_reussie check (not publiee or issue_correcte)
);

create index if not exists preuves_publiques_idx
  on public.preuves (publiee, mise_en_avant desc, date_match desc);

create index if not exists preuves_exactes_idx
  on public.preuves (score_exact, date_match desc);

-- Aucune politique : la table n'est donc lisible que par le serveur. La section
-- publique est rendue côté serveur, le navigateur n'interroge jamais la table
-- directement.
alter table public.preuves enable row level security;

comment on table public.preuves is
  'Pronostics vérifiés affichés publiquement. Une ligne par match. Un pronostic raté ne peut pas être publié (contrainte).';
comment on column public.preuves.prono_issue is
  'Issue annoncée par ProFoot avant le match : team1, draw ou team2.';
comment on column public.preuves.analyses_comptees is
  'Nombre d''analyses ayant porté sur ce match. Suivi interne, jamais affiché.';

-- ═══════════════════════════════════════════════════════════════════
-- Le pronostic, figé au moment où il est émis
-- ═══════════════════════════════════════════════════════════════════
--
-- L'issue annoncée était jusqu'ici déduite du score AU MOMENT DE LA
-- VÉRIFICATION, c'est-à-dire après le match. Le calcul était juste, mais rien
-- dans la base ne prouvait que le pronostic n'avait pas été retouché entre-temps.
--
-- Une preuve dont on peut soupçonner qu'elle a été écrite après coup ne prouve
-- rien. L'issue est désormais figée à la création, avec son horodatage.

alter table public.analysis_history
  add column if not exists predicted_at timestamptz;

comment on column public.analysis_history.predicted_winner is
  'Issue annoncée, figée à la création de l''analyse — avant le match.';
comment on column public.analysis_history.predicted_at is
  'Horodatage de l''émission du pronostic. Prouve qu''il précède le match.';
