/**
 * QUI EST EN TRAIN DE PERDRE CONFIANCE ? — LECTURE SEULE.
 *
 * Les deux règles du projet : garder chaque personne qui a payé, et n'avoir
 * aucun payeur qui parle mal du produit. Or celui qui va partir ne prévient
 * pas — il enchaîne trois ou quatre analyses ratées, il se tait, et il ne
 * revient plus.
 *
 * Ce relevé le nomme AVANT qu'il écrive, en regardant les analyses que chaque
 * abonné a réellement lancées et ce qu'elles ont donné.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tout = async (t, c) => { const o = []; for (let d = 0; d < 300000; d += 1000) { const { data, error } = await sb.from(t).select(c).range(d, d + 999); if (error) throw new Error(error.message); o.push(...(data ?? [])); if (!data || data.length < 1000) break; } return o; };

const users = [];
for (let p = 1; p <= 40; p++) {
  const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 });
  users.push(...data.users); if (data.users.length < 1000) break;
}
const mail = new Map(users.map((u) => [u.id, u.email]));
const subs = await tout('subscriptions', 'user_id,plan,expires_at');
const actifs = new Set(subs.filter((s) => s.expires_at && new Date(s.expires_at) > new Date()).map((s) => s.user_id));

const a = await tout('analysis_history', 'user_id,team1_name,team2_name,score,real_score,is_finished,created_at');
const issue = (s) => { const m = String(s).match(/(\d+)\s*-\s*(\d+)/); if (!m) return null; const p=+m[1], q=+m[2]; return p>q?'V1':p<q?'V2':'N'; };

const parClient = new Map();
for (const x of a) {
  if (!x.user_id || !actifs.has(x.user_id)) continue;
  if (!x.is_finished || !x.real_score) continue;
  const k = `${x.user_id}|${x.team1_name}|${x.team2_name}|${String(x.created_at).slice(0,10)}`;
  if (!parClient.has(x.user_id)) parClient.set(x.user_id, new Map());
  parClient.get(x.user_id).set(k, x);
}

const enDanger = [];
for (const [uid, m] of parClient) {
  const l = [...m.values()].sort((p, q) => String(q.created_at).localeCompare(String(p.created_at)));
  if (l.length < 4) continue;
  const dix = l.slice(0, 10);
  const justes = dix.filter((x) => issue(x.score) && issue(x.score) === issue(x.real_score)).length;
  const cinq = l.slice(0, 5);
  const justesCinq = cinq.filter((x) => issue(x.score) && issue(x.score) === issue(x.real_score)).length;
  enDanger.push({ uid, email: mail.get(uid), total: l.length, dix: dix.length, justes, justesCinq, derniere: String(l[0].created_at).slice(0, 10) });
}
enDanger.sort((x, y) => (x.justes / x.dix) - (y.justes / y.dix));

console.log(`${parClient.size} abonnés actifs ont au moins une analyse vérifiée.\n`);
const critiques = enDanger.filter((x) => x.dix >= 5 && x.justes / x.dix <= 0.3);
console.log(`══ ${critiques.length} ABONNÉS À MOINS DE 30 % SUR LEURS DIX DERNIÈRES ══\n`);
for (const x of critiques.slice(0, 20)) {
  console.log(`   ${String(x.email).padEnd(38)} ${x.justes}/${x.dix} justes   ${x.justesCinq}/5 sur les cinq dernières   dernière analyse ${x.derniere}`);
}

const moyenne = enDanger.reduce((s, x) => s + x.justes / x.dix, 0) / Math.max(1, enDanger.length);
console.log(`\n   réussite moyenne par abonné : ${(100*moyenne).toFixed(1)} %`);
console.log(`   abonnés sous 40 % : ${enDanger.filter((x) => x.dix >= 5 && x.justes/x.dix < 0.4).length}`);
console.log(`   abonnés au-dessus de 60 % : ${enDanger.filter((x) => x.dix >= 5 && x.justes/x.dix > 0.6).length}`);
