-- ══════════════════════════════════════════════════════════════════════════
--  M1 — L'ADRESSE DE L'ADMINISTRATEUR N'EST PLUS LISIBLE PUBLIQUEMENT
-- ══════════════════════════════════════════════════════════════════════════
--
--  CE QUI A ÉTÉ TROUVÉ LE 23 AOÛT 2026
--
--  L'audit a testé les quatorze tables sensibles avec la CLÉ PUBLIQUE — celle
--  dont dispose n'importe quel visiteur, puisqu'elle voyage dans le navigateur.
--  Treize refusaient la lecture. Une l'acceptait : `app_settings`.
--
--  Ce qu'elle rendait :
--
--      app_name            ProFoot AI
--      contact_email       support@profootai.com
--      maintenance         false
--      maintenance_message …
--      updated_by          l'adresse du compte ADMINISTRATEUR
--
--  Les quatre premières lignes sont publiques par nature. La cinquième non :
--  c'est le premier ingrédient d'une prise de compte. Un attaquant qui sait
--  QUI viser n'a plus qu'à s'occuper du mot de passe.
--
--  POURQUOI ON FERME LA TABLE ENTIÈRE, ET PAS SEULEMENT UNE COLONNE
--
--  Parce que personne n'a besoin de la lire depuis un navigateur. Vérifié dans
--  le code : `src/lib/app-settings.ts` est le seul lecteur, et il utilise la
--  clé de SERVICE — celle qui ne quitte jamais le serveur. La page
--  d'administration passe par lui.
--
--  Fermer une colonne aurait laissé la porte entrouverte pour les suivantes.
--  Fermer la table ne coûte rien puisque rien de public ne s'en sert.
--
--  CE QUI NE CHANGE PAS
--
--  La clé de service IGNORE ces règles, par construction. Le mode maintenance,
--  les prix, le nom de l'application : tout continue de fonctionner à
--  l'identique. Seul le navigateur d'un inconnu perd un accès qu'il n'aurait
--  jamais dû avoir.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Les règles de sécurité par ligne sont activées.
--    Sans politique déclarée ensuite, la table devient inaccessible à tout
--    rôle qui n'est pas la clé de service. C'est exactement ce qu'on veut.
alter table public.app_settings enable row level security;

-- 2. Toute politique permissive existante est retirée.
--
--    La table était lisible : il existe donc soit aucune règle activée, soit
--    une politique qui autorise tout le monde. On les retire sans avoir à
--    connaître leur nom — sinon la première étape resterait sans effet.
do $$
declare
  politique record;
begin
  for politique in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'app_settings'
  loop
    execute format('drop policy if exists %I on public.app_settings', politique.policyname);
    raise notice 'Politique retirée : %', politique.policyname;
  end loop;
end $$;

-- 3. Et par précaution, le droit de lecture est révoqué explicitement.
--
--    Les règles par ligne et les droits de table sont deux mécanismes
--    distincts : l'un peut être contourné si l'autre reste ouvert. On ferme
--    les deux.
revoke all on public.app_settings from anon;
revoke all on public.app_settings from authenticated;

-- ── VÉRIFICATION ──────────────────────────────────────────────────────────
--
-- Doit afficher `true`, et zéro politique.
select
  relrowsecurity as securite_activee,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'app_settings') as nombre_de_politiques
from pg_class
where oid = 'public.app_settings'::regclass;
