-- ═══════════════════════════════════════════════════════════════════
-- Offres modifiables depuis l'administration
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- Les prix et les quotas vivaient dans le code. Chaque essai tarifaire
-- demandait donc une modification, une relecture et un redéploiement — pour
-- changer un nombre. Un lancement se règle en tâtonnant : il faut pouvoir
-- essayer 2 000 FCFA un lundi et 2 500 le jeudi.
--
-- CE QUI RESTE DANS LE CODE, ET POURQUOI
--
-- Seuls le PRIX, le NOMBRE D'ANALYSES et l'ACCÈS À L'AGENT VIP sont éditables.
-- La durée, le niveau et les montants historiques restent au code : ils
-- gouvernent la reconnaissance des paiements déjà encaissés. Une faute de
-- frappe sur une durée casserait des abonnements en cours ; une faute de frappe
-- sur un prix ne fait que changer un prix.
--
-- Une ligne par offre. L'absence de ligne signifie « valeurs du code » : si
-- cette table disparaît, l'application continue de fonctionner.

create table if not exists public.offres (
  -- Identifiant de l'offre, tel que le code le connaît :
  -- essential_monthly, pro_monthly, vip_yearly.
  cle text primary key,

  -- Prix affiché ET facturé, en FCFA. Doit correspondre au produit Chariow.
  prix_xof integer not null check (prix_xof > 0),

  -- Analyses complètes par période. -1 signifie « sans limite ».
  limite_analyses integer not null check (limite_analyses = -1 or limite_analyses >= 0),

  -- Accès à l'Agent VIP.
  agent_vip boolean not null default false,

  modifiee_le timestamptz not null default now(),
  modifiee_par text
);

-- Table lue et écrite uniquement par le serveur. Aucune politique n'est
-- définie : avec RLS activé, aucun navigateur ne peut y toucher. Un utilisateur
-- ne doit pas pouvoir s'offrir l'accès VIP en écrivant une ligne.
alter table public.offres enable row level security;

-- Valeurs de départ : le nouveau tarif décidé le 16 août 2026.
insert into public.offres (cle, prix_xof, limite_analyses, agent_vip) values
  ('essential_monthly',  2000, 20, true),
  ('pro_monthly',        5000, 50, true),
  ('vip_yearly',        15000, -1, true)
on conflict (cle) do nothing;

comment on table public.offres is
  'Prix et quotas modifiables depuis l''administration. Sans ligne, le code fait foi.';
comment on column public.offres.limite_analyses is
  '-1 = sans limite. Le quota d''un abonné en cours suit toujours la valeur actuelle.';
