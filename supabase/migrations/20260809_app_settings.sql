-- ═══════════════════════════════════════════════════════════════════
-- Configuration de l'application, modifiable depuis l'administration
-- ═══════════════════════════════════════════════════════════════════
--
-- Une seule ligne, verrouillée par `id = 1` : une table de configuration à
-- plusieurs lignes finit toujours par en avoir deux qui se contredisent.

create table if not exists public.app_settings (
  id                  smallint primary key default 1,
  app_name            text        not null default 'ProFoot AI',
  contact_email       text        not null default 'support@profootai.com',
  maintenance          boolean     not null default false,
  maintenance_message text        not null default 'ProFoot AI est momentanément en maintenance. Nous revenons très vite.',
  updated_at          timestamptz not null default now(),
  updated_by          text,

  constraint app_settings_ligne_unique check (id = 1)
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Lecture ouverte : ces valeurs sont destinées à être affichées publiquement
-- (nom de l'application, adresse de contact, bandeau de maintenance). Le
-- middleware doit pouvoir lire l'état de maintenance à chaque requête, y
-- compris pour un visiteur non connecté.
drop policy if exists "app_settings_lecture_publique" on public.app_settings;
create policy "app_settings_lecture_publique"
  on public.app_settings for select
  using (true);

-- Aucune politique d'écriture : seule la clé de service peut modifier la
-- configuration, donc uniquement le code serveur de l'administration.

comment on table public.app_settings is
  'Configuration modifiable depuis /admin/settings. Ligne unique (id = 1). Écriture réservée à la clé de service.';
