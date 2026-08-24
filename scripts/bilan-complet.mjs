/** Bilan complet : chiffres réels, aucun jugement sans mesure. */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });

const H = (t) => { console.log(`\n  ══ ${t} ══\n`); };

// ── ARGENT ────────────────────────────────────────────────────────────────
const { recettesParJour, totalEntre } = await jiti.import('../src/lib/recettes-boutique.ts');
const j = await recettesParJour();
H('ARGENT');
if (j) {
  const tout = totalEntre(j);
  const auj = totalEntre(j, '2026-08-24', '2026-08-24');
  const hier = totalEntre(j, '2026-08-23', '2026-08-23');
  const semaine = totalEntre(j, '2026-08-18', null);
  console.log(`  Depuis le lancement : ${tout.xof.toLocaleString('fr-FR')} FCFA · ${tout.ventes} ventes`);
  console.log(`  7 derniers jours    : ${semaine.xof.toLocaleString('fr-FR')} FCFA · ${semaine.ventes} ventes`);
  console.log(`  Hier (23)           : ${hier.xof.toLocaleString('fr-FR')} FCFA · ${hier.ventes} ventes`);
  console.log(`  Aujourd'hui (24)    : ${auj.xof.toLocaleString('fr-FR')} FCFA · ${auj.ventes} ventes`);
} else console.log('  Caisse injoignable');

// ── COMPTES ───────────────────────────────────────────────────────────────
H('COMPTES ET ABONNEMENTS');
const comptes = [];
for (let p = 1; p <= 30; p++) {
  const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 });
  if (!data?.users?.length) break; comptes.push(...data.users); if (data.users.length < 1000) break;
}
const { data: abos } = await sb.from('subscriptions').select('status, plan, expires_at, created_at');
const actifs = (abos ?? []).filter((a) => a.status === 'active' && (!a.expires_at || new Date(a.expires_at) > new Date()));
console.log(`  Comptes inscrits    : ${comptes.length}`);
console.log(`  Abonnements actifs  : ${actifs.length}  (${Math.round(actifs.length / Math.max(1, comptes.length) * 1000) / 10} % de conversion)`);
const parPlan = new Map();
for (const a of actifs) parPlan.set(a.plan, (parPlan.get(a.plan) ?? 0) + 1);
for (const [p, n] of [...parPlan].sort((a, b) => b[1] - a[1])) console.log(`     ${String(p).padEnd(20)} ${n}`);

// ── MOTEUR ────────────────────────────────────────────────────────────────
H('LE MOTEUR');
const { data: v } = await sb.from('analysis_history')
  .select('winner_correct, score_correct').not('verified_at', 'is', null).limit(2000);
const n = (v ?? []).length;
const justes = (v ?? []).filter((a) => a.winner_correct).length;
const exacts = (v ?? []).filter((a) => a.score_correct).length;
console.log(`  Pronostics jugés    : ${n}`);
console.log(`  Vainqueur trouvé    : ${Math.round(justes / Math.max(1, n) * 1000) / 10} %`);
console.log(`  Score exact         : ${Math.round(exacts / Math.max(1, n) * 1000) / 10} %`);

// ── ÉCHECS ────────────────────────────────────────────────────────────────
H('FIABILITE DES ANALYSES');
const { getBilanEchecs } = await jiti.import('../src/lib/echecs-analyse.ts');
const e = await getBilanEchecs(200);
console.log(`  Analyses servies    : ${e.analysesTotales}`);
console.log(`  Echecs (24 h)       : ${e.recents}`);
console.log(`  Taux d'echec        : ${e.tauxEchec === null ? '—' : e.tauxEchec + ' %'}`);
console.log(`  SANS REPONSE        : ${e.sansReponse}  ${e.sansReponse === 0 ? '(doit rester a zero — OK)' : '<-- A CORRIGER'}`);

// ── AUTOMATIQUE ───────────────────────────────────────────────────────────
H('CE QUI TOURNE TOUT SEUL');
const { dernierEntretien } = await jiti.import('../src/lib/entretien-quotidien.ts');
const d = await dernierEntretien();
console.log(`  Dernier entretien   : ${d ? d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC (il y a ' + Math.round((Date.now() - d.getTime()) / 3600000 * 10) / 10 + ' h)' : 'JAMAIS'}`);
const { count: attente } = await sb.from('analysis_history').select('id', { count: 'exact', head: true }).is('verified_at', null);
const { count: total } = await sb.from('analysis_history').select('id', { count: 'exact', head: true });
console.log(`  Analyses verifiees  : ${total - attente} sur ${total}  (${attente} en attente)`);
const { count: preuves } = await sb.from('preuves').select('id', { count: 'exact', head: true });
console.log(`  Preuves sur le mur  : ${preuves}`);
console.log('');
