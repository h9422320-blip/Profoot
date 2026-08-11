-- ═══════════════════════════════════════════════════════════════════
-- Origine géographique de chaque intention d'achat
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CES COLONNES
--
-- Pendant plusieurs jours, toutes les ventes se sont créées avec « États-Unis »
-- comme pays : le prestataire de paiement géolocalisait l'appelant de son API,
-- c'est-à-dire notre serveur, et non l'acheteur. Les clients d'Abidjan, Dakar ou
-- Conakry se voyaient proposer Apple Pay et Cash App, et repartaient sans payer.
--
-- Le défaut est corrigé, mais rien ne le signalait : il a fallu qu'un tableau de
-- ventes soit lu à la main pour le découvrir. On enregistre donc désormais nous-
-- mêmes ce que l'on a détecté, au moment où on le détecte.
--
-- Deux usages, également importants :
--
--  1. Savoir d'où viennent réellement les acheteurs, sans dépendre de ce qu'un
--     service tiers veut bien afficher.
--
--  2. Surveiller la détection elle-même. `pays_source` dit COMMENT le pays a été
--     obtenu. La valeur « defaut » signifie qu'aucun indice n'a fonctionné :
--     c'est le signal d'alerte qui manquait.

alter table public.payment_intents
  add column if not exists pays        text,
  add column if not exists pays_source text,
  add column if not exists ip_acheteur text;

-- Les intentions créées avant cette migration n'ont pas de pays : elles restent
-- à NULL. Aucune valeur n'est inventée rétroactivement — un pays deviné après
-- coup serait indiscernable d'un pays réellement constaté.

create index if not exists payment_intents_pays_idx
  on public.payment_intents (pays, created_at desc);

comment on column public.payment_intents.pays is
  'Code ISO du pays de l''acheteur, relevé au moment où son navigateur demande le paiement.';
comment on column public.payment_intents.pays_source is
  'Comment le pays a été obtenu : ip (fiable), fuseau (approché), defaut (aucun indice — à surveiller).';
comment on column public.payment_intents.ip_acheteur is
  'Adresse IP transmise au prestataire pour qu''il propose les bons moyens de paiement.';
