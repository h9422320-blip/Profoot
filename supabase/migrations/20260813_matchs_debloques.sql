-- ═══════════════════════════════════════════════════════════════════
-- Déblocage d'un match à l'unité
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI
--
-- Le plus petit achat possible était un abonnement mensuel. Pour un visiteur
-- qui découvre l'application, c'est un engagement — et 88 % du trafic vient de
-- comptes qui n'ont jamais payé. Débloquer UN match pour 500 FCFA capte
-- l'impulsion du moment, fait entrer le mobile money une première fois, et
-- lève la vraie barrière : celle du premier achat.

create table if not exists public.matchs_debloques (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Identité du match, sans date : « equipe1__equipe2 » normalisé par ordre
  -- alphabétique. La clé du quota, elle, contient le jour — ce serait un piège
  -- ici : on vend « ce match », il se joue le lendemain, et l'utilisateur
  -- devrait repayer pour relire ce qu'il a déjà acheté.
  match_key text not null,

  -- Une vente ne peut débloquer qu'une fois, quel que soit le nombre de
  -- réessais du webhook.
  sale_id text unique,

  -- Conservés pour l'affichage en administration : la clé seule ne dit rien.
  equipe1_nom text,
  equipe2_nom text,
  montant integer,
  devise text default 'XOF',

  created_at timestamptz not null default now()
);

-- Un même utilisateur ne paie jamais deux fois le même match.
create unique index if not exists matchs_debloques_user_match_idx
  on public.matchs_debloques (user_id, match_key);

create index if not exists matchs_debloques_date_idx
  on public.matchs_debloques (created_at desc);

-- Table lue et écrite uniquement par le serveur. Aucune politique n'est
-- définie : avec RLS activé, cela signifie qu'aucun navigateur ne peut y
-- accéder, même avec un jeton valide. Un utilisateur ne doit pas pouvoir
-- s'auto-débloquer un match en écrivant une ligne.
alter table public.matchs_debloques enable row level security;

-- L'identité du match voyage du paiement jusqu'au déblocage par cette colonne :
-- Chariow ne conserve pas les métadonnées qu'on lui transmet, donc sans elle
-- une vente payée reviendrait sans qu'on sache quel match débloquer.
alter table public.payment_intents
  add column if not exists match_key text,
  add column if not exists equipe1_nom text,
  add column if not exists equipe2_nom text;

comment on table public.matchs_debloques is
  'Matchs achetés à l''unité. Le déblocage est définitif : aucune date d''expiration.';
