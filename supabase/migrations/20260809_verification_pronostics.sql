-- ============================================================================
-- Vérification des pronostics : mesurer la précision réelle
-- ============================================================================
--
-- Les taux de réussite affichés dans l'application (« 79,2 % de vainqueurs
-- corrects », « série de 11 matchs ») étaient écrits en dur dans le code et ne
-- reposaient sur aucune mesure. Ils ont été présentés à des abonnés payants.
--
-- Pour les remplacer par la vérité, il faut d'abord pouvoir la constater :
-- l'historique conserve le score PRÉDIT mais rien du résultat réel, donc rien
-- n'était comparable. Ces colonnes accueillent le résultat constaté après le
-- match, renseigné automatiquement par la tâche quotidienne.
--
-- Aucune donnée existante n'est modifiée : les analyses déjà enregistrées
-- restent intactes et seront vérifiées au fil des matchs.
-- ============================================================================

alter table public.analysis_history
  -- Score réel du match, au format « 2 - 1 ». Null tant que non vérifié.
  add column if not exists real_score text,

  -- Issue réelle : 'team1', 'team2' ou 'draw'.
  add column if not exists real_winner text,

  -- Issue prédite, figée au moment de la vérification pour rester comparable
  -- même si la façon de lire une prédiction évolue plus tard.
  add column if not exists predicted_winner text,

  -- Vrai quand le vainqueur prédit correspond au vainqueur réel.
  add column if not exists winner_correct boolean,

  -- Vrai quand le score exact prédit correspond au score réel.
  add column if not exists score_correct boolean,

  -- Horodatage de la vérification. Null = jamais vérifié.
  add column if not exists verified_at timestamptz,

  -- Identifiant du match chez le fournisseur, pour retrouver le résultat sans
  -- réinterroger par noms d'équipes à chaque passage.
  add column if not exists fixture_id bigint;

-- La tâche quotidienne cherche les analyses non encore vérifiées, les plus
-- anciennes d'abord. Sans cet index, elle parcourt toute la table à chaque
-- exécution.
create index if not exists analysis_history_a_verifier_idx
  on public.analysis_history (created_at)
  where verified_at is null;

-- Le calcul de précision ne lit que les lignes vérifiées.
create index if not exists analysis_history_verifiees_idx
  on public.analysis_history (verified_at)
  where verified_at is not null;

comment on column public.analysis_history.real_score is
  'Score réellement constaté après le match. Null tant que le match n''est pas joué ou pas encore vérifié.';
comment on column public.analysis_history.winner_correct is
  'Comparaison entre le vainqueur prédit et le vainqueur réel. Sert au calcul de la précision affichée.';
