// Connexions réussies par heure (UTC) sur une journée : révèle une panne du service de connexion.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const jour = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const sb = createAdminClient();
const parHeure = new Map<string, number>();
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) {
    for (const quand of [u.last_sign_in_at]) {
      if (quand?.startsWith(jour)) { const h = quand.slice(11, 13); parHeure.set(h, (parHeure.get(h) ?? 0) + 1); }
    }
  }
  if (data.users.length < 1000) break;
}
for (let h = 0; h < 24; h++) { const k = String(h).padStart(2, '0'); console.log(`${k} h  ${'█'.repeat(parHeure.get(k) ?? 0)} ${parHeure.get(k) ?? 0}`); }
