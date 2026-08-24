/**
 * LA QUESTION QUI COMPTE : parmi ceux qui ont VRAIMENT fini leurs 20 analyses,
 * combien ont remis la main à la poche ?
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: abos } = await sb.from('subscriptions')
  .select('user_id, plan, amount, created_at').order('created_at', { ascending: true });

const usage = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('analysis_usage').select('user_id').range(de, de + 999);
  if (!data?.length) break; usage.push(...data); if (data.length < 1000) break;
}
const utilise = new Map();
for (const u of usage) utilise.set(u.user_id, (utilise.get(u.user_id) ?? 0) + 1);

// Chaque utilisateur, ses achats dans l'ordre.
const achats = new Map();
for (const a of abos ?? []) {
  if (!achats.has(a.user_id)) achats.set(a.user_id, []);
  achats.get(a.user_id).push(a);
}

// Ceux qui ont commencé par l'Essentiel.
const essentiels = [...achats.entries()].filter(([, l]) => l[0].plan === 'essential_monthly');

const epuise = essentiels.filter(([uid]) => (utilise.get(uid) ?? 0) >= 20);
const nonEpuise = essentiels.filter(([uid]) => (utilise.get(uid) ?? 0) < 20);

const ontRepaye = (l) => l.length > 1;

console.log(`\n  ══ LE PRODUIT RETIENT-IL ? ══\n`);
console.log(`  Abonnés ayant commencé par l'Essentiel : ${essentiels.length}\n`);

const bloc = (titre, liste) => {
  const r = liste.filter(([, l]) => ontRepaye(l));
  console.log(`  ${titre}`);
  console.log(`    ${String(liste.length).padStart(4)} abonnés`);
  console.log(`    ${String(r.length).padStart(4)} ont repayé  →  ${Math.round(r.length / Math.max(1, liste.length) * 100)} %\n`);
  return r;
};
const rEpuise = bloc('ONT FINI LEURS 20 ANALYSES', epuise);
bloc("IL LEUR EN RESTE", nonEpuise);

// ── Combien de temps ont-ils tenu avant de manquer d'analyses ? ───────────
// Supabase rend mille lignes au maximum par requête : sans cette boucle, les
// durées se calculaient sur le premier millier d'analyses seulement.
const usageDates = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('analysis_usage')
    .select('user_id, created_at').order('created_at', { ascending: true }).range(de, de + 999);
  if (!data?.length) break; usageDates.push(...data); if (data.length < 1000) break;
}
console.log(`\n  (${usageDates.length} analyses datées, lues page par page)`);
const premiere = new Map(), vingtieme = new Map(), compteur = new Map();
for (const u of usageDates ?? []) {
  const n = (compteur.get(u.user_id) ?? 0) + 1;
  compteur.set(u.user_id, n);
  if (n === 1) premiere.set(u.user_id, u.created_at);
  if (n === 20) vingtieme.set(u.user_id, u.created_at);
}
const durees = [];
for (const [uid] of epuise) {
  const a = premiere.get(uid), b = vingtieme.get(uid);
  if (a && b) durees.push((new Date(b) - new Date(a)) / 86400000);
}
if (durees.length) {
  durees.sort((x, y) => x - y);
  const moy = durees.reduce((s, x) => s + x, 0) / durees.length;
  console.log(`  ══ COMBIEN DE TEMPS DURENT 20 ANALYSES ? ══\n`);
  console.log(`  Moyenne ... ${Math.round(moy * 10) / 10} jours`);
  console.log(`  Médiane ... ${Math.round(durees[Math.floor(durees.length / 2)] * 10) / 10} jours`);
  console.log(`  Le plus rapide : ${Math.round(durees[0] * 10) / 10} j   ·   le plus lent : ${Math.round(durees[durees.length - 1] * 10) / 10} j`);
}

// ── Et ceux qui ont fini, quand ont-ils fini ? ────────────────────────────
let finiDepuis3j = 0, finiRecent = 0;
const maintenant = Date.now();
for (const [uid] of epuise) {
  const b = vingtieme.get(uid);
  if (!b) continue;
  if ((maintenant - new Date(b)) / 86400000 >= 3) finiDepuis3j++; else finiRecent++;
}
console.log(`\n  ══ DEPUIS QUAND SONT-ILS À SEC ? ══\n`);
console.log(`  Ont fini il y a 3 jours ou plus : ${finiDepuis3j}  (ils ont eu le temps de racheter)`);
console.log(`  Ont fini dans les 3 derniers jours : ${finiRecent}  (trop tôt pour juger)`);
console.log('');
