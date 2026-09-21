// LECTURE SEULE : le quota d'un abonné, ce qui l'a consommé, et ses échecs récents.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const cible = String(process.argv[2] ?? '').toLowerCase();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
let u: any = null;
for (let page = 1; page <= 40 && !u; page++) {
  let data: any = null;
  for (let essai = 1; essai <= 5 && !data; essai++) {
    try { const r = await sb.auth.admin.listUsers({ page, perPage: 1000 }); if (!r.error) data = r.data; } catch {}
    if (!data) await new Promise((t) => setTimeout(t, 2500 * essai));
  }
  if (!data) break;
  u = data.users.find((x: any) => String(x.email).toLowerCase() === cible) ?? null;
  if (data.users.length < 1000) break;
}
if (!u) { console.log('compte introuvable'); process.exit(0); }
console.log('compte', u.email, u.id);
const { data: abos } = await sb.from('subscriptions').select('plan, status, created_at, expires_at, chariow_sale_id').eq('user_id', u.id).order('created_at');
console.log('abonnements :', JSON.stringify(abos));
const { data: h } = await sb.from('analysis_history').select('created_at, team1_name, team2_name').eq('user_id', u.id).gte('created_at', '2026-08-20').order('created_at');
const parJour = new Map<string, number>();
for (const a of h ?? []) parJour.set(String(a.created_at).slice(0, 10), (parJour.get(String(a.created_at).slice(0, 10)) ?? 0) + 1);
console.log('analyses enregistrées depuis le 20 août :', (h ?? []).length, '·', [...parJour].map(([j, n]) => `${j.slice(5)}:${n}`).join(' '));
const { data: f } = await sb.from('analysis_failures').select('created_at, cause, message, equipe1, equipe2, servi_quand_meme, rembourse').eq('user_id', u.id).gte('created_at', '2026-09-15').order('created_at', { ascending: false }).limit(15);
console.log('échecs depuis le 15 septembre :', (f ?? []).length);
for (const x of f ?? []) console.log('  ', String(x.created_at).slice(5, 16), x.cause, '·', x.equipe1, '–', x.equipe2, '· servi', x.servi_quand_meme, '· remboursé', (x as any).rembourse, '·', String(x.message ?? '').slice(0, 110));
