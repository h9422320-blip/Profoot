/**
 * QUI A PAYÉ ET N'A RIEN OBTENU ?
 *
 * Un client écrit : « j'ai fait l'abonnement à 2 000 F, ça n'a rien donné comme
 * analyse ». Deux explications possibles, et elles n'appellent pas la même
 * réponse :
 *
 *   — soit l'accès n'a pas été ouvert : c'est un défaut, il faut le réparer ;
 *   — soit l'accès est ouvert mais la personne n'a lancé aucune analyse : c'est
 *     un problème d'usage, il faut l'accompagner.
 *
 * On regarde donc, pour chaque payeur, ce qu'il POSSÈDE et ce qu'il a FAIT.
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
const quand = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

const { data: intents } = await sb
  .from('payment_intents')
  .select('user_id, plan, email, amount, created_at, consumed_at')
  .not('consumed_at', 'is', null)
  .order('created_at', { ascending: false });

const { data: abos } = await sb.from('subscriptions').select('user_id, plan, status, expires_at, created_at');
const actifs = new Map();
for (const a of abos ?? []) {
  if (a.status !== 'active') continue;
  if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) continue;
  if (!actifs.has(a.user_id)) actifs.set(a.user_id, a);
}

console.log('=============== CHAQUE PAYEUR, CE QU\'IL A ET CE QU\'IL FAIT ===============\n');
const casses = [], inactifs = [], sains = [];

for (const i of intents ?? []) {
  const abo = actifs.get(i.user_id);
  const { count } = await sb
    .from('analysis_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', i.user_id);
  const analyses = count ?? 0;
  const ligne = { ...i, abo, analyses };
  if (!abo) casses.push(ligne);
  else if (analyses === 0) inactifs.push(ligne);
  else sains.push(ligne);
}

console.log(`>>> ACCÈS CASSÉ (payé, aucun abonnement actif) : ${casses.length}`);
for (const c of casses) {
  console.log(`    ${quand(c.created_at)}  ${String(c.amount).padStart(6)} F  ${c.plan}  ${c.email}  (${c.analyses} analyses)`);
}

console.log(`\n>>> PAYÉ MAIS AUCUNE ANALYSE LANCÉE : ${inactifs.length}`);
for (const c of inactifs) {
  console.log(`    ${quand(c.created_at)}  ${String(c.amount).padStart(6)} F  ${c.abo.plan.padEnd(18)} ${c.email}`);
}

console.log(`\n>>> PAYÉ ET UTILISÉ : ${sains.length}`);
const parNb = sains.map((s) => s.analyses).sort((a, b) => a - b);
if (parNb.length) {
  console.log(`    analyses par abonné — mini ${parNb[0]}, médiane ${parNb[Math.floor(parNb.length / 2)]}, maxi ${parNb[parNb.length - 1]}`);
}
for (const c of sains.slice(0, 12)) {
  console.log(`    ${quand(c.created_at)}  ${String(c.amount).padStart(6)} F  ${c.abo.plan.padEnd(18)} ${String(c.email).padEnd(34)} ${c.analyses} analyses`);
}

console.log('\n=============== CE QUE CHAQUE OFFRE DONNE ===============');
const { data: offres } = await sb.from('offres').select('*').order('prix', { ascending: true });
for (const o of offres ?? []) console.log(`  ${JSON.stringify(o)}`);
