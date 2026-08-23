-- ══════════════════════════════════════════════════════════════════════════
--  LA MESURE MAISON : OÙ LES VISITEURS PASSENT, ET OÙ ILS SORTENT
-- ══════════════════════════════════════════════════════════════════════════
--
--  POURQUOI CETTE TABLE EXISTE
--
--  Microsoft Clarity plafonne à dix appels par jour et rend ses chiffres avec
--  un à trois jours de retard. Le 22 août 2026, le quota a été épuisé en une
--  soirée et plus rien n'a été lisible pendant trente-six heures.
--
--  Or les questions qui décident vraiment — sur quelle page les gens arrivent,
--  combien de temps ils restent, où ils ferment — se répondent avec ce que
--  l'application voit elle-même. Sans plafond, en temps réel, gratuitement.
--
--  CE QU'ON N'ENREGISTRE PAS
--
--  Aucune donnée personnelle. Pas d'adresse IP, pas de nom, pas de cookie.
--  L'identifiant de visite est un nombre au hasard, tiré par le navigateur et
--  oublié dès l'onglet fermé. Il ne sert qu'à recoller les pages d'un même
--  passage pour reconstituer le chemin.
--
--  `compte_id` n'est renseigné que pour une personne déjà connectée, et
--  seulement pour pouvoir dire « les abonnés lisent-ils les mêmes pages que
--  les visiteurs ». Il reste facultatif.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.visites_pages (
  -- Identifiant de la VUE, tiré par le navigateur avant l'envoi : il permet de
  -- rattacher le départ à l'arrivée sans que le serveur ait à répondre quoi que
  -- ce soit — un signal de fermeture d'onglet ne peut pas attendre de réponse.
  vue_id      text primary key,

  -- Identifiant du PASSAGE : commun à toutes les pages d'une même visite.
  visite_id   text not null,

  chemin      text not null,
  entre_le    timestamptz not null default now(),

  -- Rempli au départ de la page. Reste nul si la personne ferme brutalement :
  -- une durée absente est une information, pas une erreur.
  duree_ms    integer,

  -- Rang de la page dans le passage : 1 pour la première. C'est lui qui permet
  -- de dire « ils arrivent ici » et « ils ferment là ».
  ordre       smallint not null default 1,

  pays        text,
  mobile      boolean,
  compte_id   uuid
);

-- ── LES INDEX, ET CE QU'ILS SERVENT ───────────────────────────────────────
--
-- Sans eux, chaque affichage du tableau de bord relirait la table entière.
-- Elle grossit d'environ trois mille lignes par jour.

-- « Que s'est-il passé aujourd'hui » : la question posée à chaque ouverture.
create index if not exists visites_pages_entre_le_idx
  on public.visites_pages (entre_le desc);

-- « Quelles pages, et combien de temps » : le regroupement principal.
create index if not exists visites_pages_chemin_idx
  on public.visites_pages (chemin, entre_le desc);

-- « Quel chemin a suivi cette personne » : reconstitution d'un passage.
create index if not exists visites_pages_visite_idx
  on public.visites_pages (visite_id, ordre);

-- ── PERSONNE NE LIT CETTE TABLE DEPUIS UN NAVIGATEUR ──────────────────────
--
-- L'écriture passe par notre serveur, la lecture par l'administration. Aucune
-- politique d'accès public n'est déclarée : sans elle, la table est fermée par
-- défaut, ce qui est exactement ce qu'on veut.
alter table public.visites_pages enable row level security;
