-- ═══════════════════════════════════════════════════════════════════
-- Pourquoi les paiements n'aboutissent pas
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CES COLONNES
--
-- Sur sept jours, 3 demandes de paiement sur 54 ont abouti. On savait qu'elles
-- échouaient, on ne savait pas pourquoi — et sans le pourquoi, il n'y a rien à
-- corriger.
--
-- La boutique connaît la réponse : chaque vente porte son statut et, quand le
-- client a réellement tenté de payer, le motif exact du refus. Interrogé à la
-- main, le relevé a montré que trois quarts des personnes repartent sans même
-- choisir un moyen de paiement, et que la première cause d'échec réel est le
-- solde insuffisant.
--
-- Ces colonnes conservent ce relevé. L'alternative — interroger la boutique à
-- chaque ouverture de la page — coûterait une cinquantaine d'appels réseau par
-- affichage et rendrait l'administration inutilisable.

alter table public.payment_intents
  -- Statut chez le prestataire : abandoned, failed, completed, settled…
  add column if not exists statut_boutique text,

  -- Motif du refus, quand le client a tenté de payer.
  -- INSUFFICIENT_BALANCE, CUSTOMER_CANCEL_TRANSACTION, UNSPECIFIED_FAILURE…
  add column if not exists cause_echec text,

  -- Le message que le client a vu, dans ses mots.
  add column if not exists message_echec text,

  -- Moyen de paiement retenu. Null quand la personne n'en a jamais choisi :
  -- c'est en soi l'information la plus parlante.
  add column if not exists moyen_paiement text,

  -- Dernier relevé. Sert à ne pas réinterroger la boutique inutilement, et à
  -- savoir quelles ventes n'ont jamais été relevées.
  add column if not exists releve_le timestamptz;

create index if not exists payment_intents_cause_idx
  on public.payment_intents (cause_echec, created_at desc);

create index if not exists payment_intents_releve_idx
  on public.payment_intents (releve_le nulls first);

comment on column public.payment_intents.statut_boutique is
  'Statut de la vente chez le prestataire. « abandoned » = la personne n''a jamais choisi de moyen de paiement.';
comment on column public.payment_intents.cause_echec is
  'Motif du refus quand le paiement a réellement été tenté.';
