-- ═══════════════════════════════════════════════════════════════════════════
--  DEUX COLONNES POUR QUE LA BOUCLE D'APPRENTISSAGE MESURE VRAIMENT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- À coller dans Supabase → SQL Editor → Run. Deux lignes, aucun risque :
-- « add column if not exists » n'efface rien et ne bloque rien.
--
-- ── POURQUOI ────────────────────────────────────────────────────────────────
--
-- Le calibrage comparait les buts RÉELLEMENT MARQUÉS au SCORE ARRONDI.
--
-- Or le score annoncé est le score le PLUS PROBABLE. Dans une loi de Poisson,
-- il est toujours inférieur à la moyenne : on annonce 1-1 là où l'espérance
-- vaut 1,4 contre 1,2. Le rapport « buts réels / score annoncé » dépasse donc
-- 1 par construction, dans tous les championnats, pour toujours.
--
-- Mesuré le 21 août 2026 en rejouant 3 099 rencontres de la saison 2025 :
-- NEUF championnats sur dix ressortaient à 1,250 exactement — la borne haute.
-- Ce n'était pas « le moteur se trompe de 25 % partout », c'était « le calcul
-- a débordé et a cessé de mesurer ».
--
-- Mesuré honnêtement, sur les buts attendus, les facteurs tombent entre 0,90
-- et 1,16, autour de 1,00 : LE MOTEUR N'A PAS DE BIAIS DE BUTS À CORRIGER.
-- C'est une bonne nouvelle, et c'est le contraire de ce que le calcul saturé
-- racontait.
--
-- ── CE QUE ÇA CHANGE UNE FOIS PASSÉ ─────────────────────────────────────────
--
-- Rien immédiatement : les facteurs restent proches de 1 et le moteur travaille
-- comme aujourd'hui. Ce que ça change, c'est le JOUR où un vrai biais
-- apparaîtra — un championnat qui se met à marquer nettement plus, une saison
-- qui démarre autrement. La boucle le verra et le corrigera, au lieu de rester
-- collée à sa borne sans rien dire.
--
-- L'application fonctionne sans ces colonnes : elle réessaie sans elles quand
-- elles manquent. Elles ne sont pas urgentes, elles rendent la mesure exacte.

alter table public.jugements_moteur
  add column if not exists buts_attendus_domicile  numeric,
  add column if not exists buts_attendus_exterieur numeric;

comment on column public.jugements_moteur.buts_attendus_domicile is
  'Buts attendus de l''équipe qui reçoit, AVANT arrondi. C''est sur cette valeur que se mesure le facteur de correction : la comparer aux buts réels est la seule comparaison honnête.';

comment on column public.jugements_moteur.buts_attendus_exterieur is
  'Buts attendus de l''équipe qui se déplace, AVANT arrondi. Voir la colonne domicile.';
