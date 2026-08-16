-- ═══════════════════════════════════════════════════════════════════
-- Les équipes des championnats, conservées en base
-- ═══════════════════════════════════════════════════════════════════
--
-- POURQUOI CETTE TABLE
--
-- La liste des équipes est reconstruite par cinquante-huit appels au
-- fournisseur de données, et elle ne vivait qu'en mémoire du serveur. Or cette
-- mémoire disparaît à chaque démarrage à froid : les cinquante-huit appels
-- recommençaient plusieurs fois par jour, et le premier visiteur après un
-- redémarrage attendait cinq secondes devant un sélecteur vide.
--
-- Ici, un démarrage à froid coûte UNE lecture en base. Le fournisseur n'est
-- interrogé que lorsque la copie a vieilli, ou par la tâche quotidienne.
--
-- CE QUI ARRIVE SI CETTE TABLE DISPARAÎT
--
-- Rien de grave : l'application se rabat sur les appels directs au
-- fournisseur, exactement comme avant. Elle est une réserve, jamais la seule
-- source.

create table if not exists public.equipes (
  -- Identifiant lisible et stable, dérivé du nom officiel (« fcbasel1893 »).
  id text primary key,

  -- Identifiant chez le fournisseur : c'est LUI qui sert aux appels de
  -- statistiques et de confrontations. Un club peut changer de nom, jamais de
  -- numéro.
  api_id integer not null,

  nom text not null,
  logo text,
  pays text,

  -- Clé du championnat côté application (« suisse », « epl »…). Vide pour un
  -- club trouvé hors des championnats préchargés.
  championnat text,
  stade text,

  -- Sert à repérer les lignes qu'un rafraîchissement n'a pas revues : ce sont
  -- les équipes reléguées, qui doivent disparaître du sélecteur.
  mise_a_jour_le timestamptz not null default now()
);

create index if not exists equipes_championnat_idx on public.equipes (championnat);
create index if not exists equipes_api_id_idx on public.equipes (api_id);

-- Écrite uniquement par le serveur. Aucune politique n'est définie : avec RLS
-- activé, aucun navigateur ne peut la modifier. Sans cela, n'importe qui
-- pourrait renommer un club ou en injecter un faux, et ce nom partirait
-- ensuite dans le texte envoyé à l'IA.
alter table public.equipes enable row level security;

comment on table public.equipes is
  'Réserve des équipes par championnat. Si elle est vide, le fournisseur est interrogé directement.';
