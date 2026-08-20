-- ═══════════════════════════════════════════════════════════════════════════
--  CE QUE LE MOTEUR APPREND DE SES PROPRES ERREURS
-- ═══════════════════════════════════════════════════════════════════════════
--
--  POURQUOI CETTE TABLE EXISTE
--
--  Le moteur calcule les forces de chaque équipe à partir des matchs joués, et
--  il le fait bien. Mais il ne s'est jamais retourné pour regarder SES PROPRES
--  pronostics face aux résultats. Il ne sait donc pas s'il annonce trop de
--  buts, pas assez, ou s'il surestime l'équipe qui reçoit.
--
--  Ce sont des biais SYSTÉMATIQUES : ils ne se voient pas sur un match, ils se
--  voient sur cent. Et une fois mesurés, ils se corrigent d'un facteur.
--
--  UNE LIGNE PAR CHAMPIONNAT, ET C'EST VOULU
--
--  L'avantage du terrain n'a pas la même valeur en Premier League et en Ligue
--  guinéenne. Le nombre de buts non plus. Un facteur unique pour tous les
--  championnats corrigerait l'un en cassant l'autre.
--
--  RIEN N'EST APPLIQUÉ SANS MATIÈRE SUFFISANTE
--
--  `matchs_observes` sert de garde-fou : sous un seuil, le facteur est ignoré
--  et le moteur travaille comme avant. Corriger un biais mesuré sur six matchs
--  reviendrait à prendre le hasard pour une tendance.
--
--  À exécuter dans l'éditeur SQL de Supabase. Sans effet si déjà appliqué.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.calibrage_ligue (
  -- Le nom du championnat tel que le fournisseur le donne. C'est la seule clé
  -- disponible : l'historique des analyses ne conserve pas l'identifiant.
  ligue text primary key,

  -- ── CE QUI EST APPRIS ────────────────────────────────────────────────────

  -- Rapport entre les buts RÉELLEMENT marqués et les buts que le moteur avait
  -- annoncés. Au-dessus de 1, le moteur sous-estime et il faut monter ses buts
  -- attendus ; en dessous, il exagère.
  facteur_buts real not null default 1,

  -- Même idée, appliquée séparément à l'équipe qui reçoit. Elle capte
  -- l'avantage du terrain propre au championnat, celui que la moyenne globale
  -- écrase.
  facteur_domicile real not null default 1,
  facteur_exterieur real not null default 1,

  -- ── CE QUI PERMET D'Y CROIRE ─────────────────────────────────────────────

  -- Nombre de rencontres jugées. En dessous du seuil, les facteurs ci-dessus
  -- sont connus mais NON appliqués.
  matchs_observes integer not null default 0,

  -- Part d'issues correctement annoncées sur ces rencontres, en pourcentage.
  -- C'est la mesure que l'on suit dans le temps : si elle baisse après un
  -- calibrage, c'est le calibrage qu'il faut revoir.
  justesse real,

  -- Score de Brier : mesure la CALIBRATION des probabilités, pas seulement le
  -- vainqueur. Annoncer 90 % et se tromper coûte plus cher qu'annoncer 55 % et
  -- se tromper. Plus il est bas, mieux c'est.
  brier real,

  -- Les mêmes mesures AVANT que le calibrage ne s'applique, conservées pour
  -- pouvoir répondre à « est-ce que ça a servi ». Sans elles, on ne saurait
  -- jamais si le système s'améliore ou se dégrade.
  justesse_avant real,
  brier_avant real,

  mis_a_jour_le timestamptz not null default now()
);

comment on table public.calibrage_ligue is
  'Biais systématiques du moteur, mesurés championnat par championnat sur ses propres pronostics passés.';

-- ═══════════════════════════════════════════════════════════════════════════
--  LE JOURNAL DES JUGEMENTS
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Une ligne par rencontre jugée : ce que le moteur avait annoncé, ce qui est
--  arrivé. C'est la matière première du calibrage, et c'est aussi la seule
--  façon de vérifier plus tard qu'un réglage a bien amélioré les choses.
--
--  Séparé de `analysis_history` à dessein : cette table-là contient une ligne
--  par ANALYSE (la même rencontre y figure trente fois), celle-ci une ligne par
--  RENCONTRE. Mélanger les deux fausserait toute moyenne.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.jugements_moteur (
  fixture_id bigint primary key,
  ligue text,
  date_match timestamptz,

  equipe_domicile text,
  equipe_exterieur text,

  -- Ce que le moteur avait annoncé, dans le sens domicile — extérieur.
  buts_prevus_domicile integer,
  buts_prevus_exterieur integer,
  proba_domicile real,
  proba_nul real,
  proba_exterieur real,
  confiance real,

  -- Ce qui est arrivé.
  buts_reels_domicile integer,
  buts_reels_exterieur integer,

  -- Déduits, pour ne pas avoir à les recalculer à chaque lecture.
  issue_prevue text check (issue_prevue in ('domicile', 'nul', 'exterieur')),
  issue_reelle text check (issue_reelle in ('domicile', 'nul', 'exterieur')),
  issue_juste boolean,
  score_exact boolean,
  -- Contribution de cette rencontre au score de Brier.
  brier real,

  juge_le timestamptz not null default now()
);

create index if not exists jugements_moteur_ligue_idx on public.jugements_moteur (ligue);
create index if not exists jugements_moteur_date_idx on public.jugements_moteur (date_match desc);

comment on table public.jugements_moteur is
  'Une ligne par rencontre jugée : le pronostic du moteur confronté au résultat réel.';

-- Ces tables ne sont lues que par le serveur, avec la clé de service.
alter table public.calibrage_ligue enable row level security;
alter table public.jugements_moteur enable row level security;
