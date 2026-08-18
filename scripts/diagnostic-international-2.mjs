/**
 * OÙ EXACTEMENT S'ARRÊTENT LES ÉTRANGERS ?
 *
 * Le premier relevé montre que des visiteurs de France, d'Algérie, des
 * Pays-Bas, d'Italie, d'Allemagne, d'Espagne, de Roumanie, du Canada et du
 * Brésil ATTEIGNENT la page de paiement. Il n'y a donc pas de blocage d'accès.
 *
 * Reste à savoir ce qu'ils font AVANT d'y arriver : ont-ils lancé des analyses,
 * l'application leur a-t-elle répondu ? Un pays qui atteint le paiement sans
 * jamais avoir analysé désignerait un autre défaut.
 *
 * Lecture seule.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: intents } = await sb
  .from('payment_intents')
  .select('pays, user_id, email, amount, created_at, consumed_at')
  .order('created_at', { ascending: false })
  .limit(2000);

// Un utilisateur, un pays (le dernier constaté).
const paysDe = new Map();
for (const i of (intents ?? []).slice().reverse()) if (i.pays) paysDe.set(i.user_id, i.pays);

const { data: analyses } = await sb
  .from('analysis_history')
  .select('user_id, created_at, competition')
  .limit(5000);
const parUtilisateur = new Map();
for (const a of analyses ?? []) parUtilisateur.set(a.user_id, (parUtilisateur.get(a.user_id) ?? 0) + 1);

const { data: echecs } = await sb
  .from('analysis_failures')
  .select('user_id, cause, created_at')
  .limit(2000);
const echecsDe = new Map();
for (const e of echecs ?? []) echecsDe.set(e.user_id, (echecsDe.get(e.user_id) ?? 0) + 1);

const AFRIQUE_MOBILE_MONEY = new Set(['CI', 'BF', 'ML', 'SN', 'TG', 'BJ', 'NE', 'GN', 'CM', 'CD', 'CG', 'GA', 'TD', 'CF', 'MR']);

const parPays = new Map();
for (const [user, pays] of paysDe) {
  const e = parPays.get(pays) ?? { comptes: 0, ayantAnalyse: 0, analyses: 0, echecs: 0, payeurs: 0 };
  e.comptes++;
  const n = parUtilisateur.get(user) ?? 0;
  if (n > 0) e.ayantAnalyse++;
  e.analyses += n;
  e.echecs += echecsDe.get(user) ?? 0;
  parPays.set(pays, e);
}
for (const i of intents ?? []) {
  if (!i.consumed_at || !i.pays) continue;
  const e = parPays.get(i.pays);
  if (e) e.payeurs++;
}

console.log('=================== L\'APPLICATION MARCHE-T-ELLE, PAYS PAR PAYS ? ===================\n');
console.log('  pays | comptes | ont analysé | analyses | échecs | ont payé | zone mobile money');
const lignes = [...parPays].sort((a, b) => b[1].comptes - a[1].comptes);
for (const [p, e] of lignes) {
  const pct = e.comptes ? Math.round((100 * e.ayantAnalyse) / e.comptes) : 0;
  console.log(
    `   ${p.padEnd(4)} | ${String(e.comptes).padStart(7)} | ${String(e.ayantAnalyse).padStart(6)} (${String(pct).padStart(3)} %) | ${String(e.analyses).padStart(8)} | ${String(e.echecs).padStart(6)} | ${String(e.payeurs).padStart(8)} | ${AFRIQUE_MOBILE_MONEY.has(p) ? 'OUI' : 'non'}`
  );
}

// ── Le regroupement qui tranche ─────────────────────────────────────────────
let dansZone = { comptes: 0, analyse: 0, payeurs: 0 };
let horsZone = { comptes: 0, analyse: 0, payeurs: 0 };
for (const [p, e] of parPays) {
  const cible = AFRIQUE_MOBILE_MONEY.has(p) ? dansZone : horsZone;
  cible.comptes += e.comptes;
  cible.analyse += e.ayantAnalyse;
  cible.payeurs += e.payeurs;
}

console.log('\n=================== LE VERDICT ===================');
const ligne = (nom, z) => {
  const usage = z.comptes ? ((100 * z.analyse) / z.comptes).toFixed(0) : '0';
  const achat = z.comptes ? ((100 * z.payeurs) / z.comptes).toFixed(0) : '0';
  console.log(`  ${nom.padEnd(34)} ${String(z.comptes).padStart(4)} comptes | ${usage.padStart(3)} % ont analysé | ${achat.padStart(3)} % ont payé`);
};
ligne('Zone mobile money (Afrique O/C)', dansZone);
ligne('Hors zone (Maghreb, Europe…)', horsZone);
