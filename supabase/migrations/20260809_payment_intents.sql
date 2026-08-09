-- ═══════════════════════════════════════════════════════════════════
-- Lien entre une vente Chariow et l'utilisateur qui l'a déclenchée
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- Le rattachement d'un paiement à un compte reposait sur `custom_metadata`,
-- envoyé à Chariow au moment du checkout. Vérification faite sur une vente
-- réelle : Chariow ne conserve pas ce champ et ne le renvoie ni dans l'API ni
-- dans ses notifications. L'utilisateur payait donc sans que l'abonnement
-- puisse lui être attribué.
--
-- Chariow renvoie en revanche l'identifiant de la vente (`purchase.id`) dès la
-- création du paiement. On enregistre donc nous-mêmes le lien, avant même que
-- l'acheteur n'ait payé. La preuve d'identité reste ainsi de notre côté : elle
-- ne dépend plus de ce qu'un service tiers veut bien nous retourner.

create table if not exists public.payment_intents (
  sale_id     text primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  plan        text        not null,
  email       text,
  amount      integer,
  created_at  timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists payment_intents_user_idx on public.payment_intents (user_id, created_at desc);

alter table public.payment_intents enable row level security;

-- Aucune politique : la table n'est accessible qu'à la clé de service, donc
-- uniquement au code serveur. Un client ne doit jamais pouvoir lire les
-- intentions d'achat d'autrui, ni en fabriquer une à son profit.

comment on table public.payment_intents is
  'Vente Chariow -> compte ProFoot, enregistré au checkout. Sert à activer l abonnement quand Chariow notifie le paiement, ses métadonnées n étant pas conservées de son côté.';
