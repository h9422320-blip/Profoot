/**
 * RENDRE LES ANALYSES FACTURÉES DEUX FOIS POUR LA MÊME RENCONTRE.
 *
 * ── CE QU'UN CLIENT A ÉCRIT LE 3 SEPTEMBRE 2026 ───────────────────────────
 *
 *     « L'application est génial mais après mon achat j'ai analysé un 10 match
 *       normalement il doit me rester encore 10 matchs puisque c'est
 *       l'abonnement de 2000f et le lendemain je suis revenu revoir le même
 *       matchs et sa m'a faire un match de moins »
 *
 * Il avait raison, et il a été le seul à le dire.
 *
 * ── LA CAUSE ──────────────────────────────────────────────────────────────
 *
 * La clé de décompte contenait le jour : `lille__toulouse__2026-09-01`.
 * Revenir voir la MÊME analyse le lendemain produisait une clé neuve, donc un
 * second prélèvement — alors que le pronostic est figé et que la page rendue
 * était rigoureusement identique.
 *
 * Mesuré sur les 8 760 décomptes : **141 clients, 309 analyses perdues.**
 *
 * ── CE QUE FAIT CE SCRIPT ─────────────────────────────────────────────────
 *
 * Pour chaque client et chaque période d'abonnement, il regroupe les décomptes
 * qui désignent la même rencontre, garde le PREMIER, supprime les suivants, et
 * réécrit la clé conservée sans la date.
 *
 * La réécriture est aussi indispensable que le remboursement : sans elle, une
 * ligne ancienne (`lille__toulouse__2026-09-02`) ne correspondrait plus à la
 * clé que le moteur calcule désormais (`lille__toulouse`), et le prochain
 * passage de ce client sur ce match le ferait payer UNE FOIS DE PLUS.
 *
 * ── L'ORDRE DES OPÉRATIONS N'EST PAS INDIFFÉRENT ─────────────────────────
 *
 * On supprime AVANT de réécrire. La table porte une contrainte d'unicité sur
 * (client, clé) : réécrire d'abord ferait entrer en collision deux lignes du
 * même groupe, et la mise à jour échouerait en silence.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *
 *     node scripts/rendre-analyses-facturees-deux-fois.mjs            (simulation)
 *     node scripts/rendre-analyses-facturees-deux-fois.mjs --ecrire   (applique)
 */

import fs from 'node:fs';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = ligne.indexOf('=');
  if (i > 0 && !ligne.startsWith('#')) {
    process.env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
}

const ECRIRE = process.argv.includes('--ecrire');
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const tout = async (table, colonnes) => {
  const sortie = [];
  for (let depart = 0; depart < 500_000; depart += 1000) {
    const { data, error } = await sb.from(table).select(colonnes).range(depart, depart + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    sortie.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return sortie;
};

/** La clé débarrassée de sa date — celle que le moteur calcule désormais. */
const sansDate = (cle) => String(cle).replace(/__\d{4}-\d{2}-\d{2}$/, '');

const decomptes = await tout('analysis_usage', 'id,user_id,match_key,created_at,period_start');
console.log(`${decomptes.length} décomptes examinés.\n`);

// ── REGROUPEMENT : un client, une période, une rencontre ────────────────────
const groupes = new Map();
for (const d of decomptes) {
  const cle = `${d.user_id}|${String(d.period_start).slice(0, 10)}|${sansDate(d.match_key)}`;
  groupes.set(cle, [...(groupes.get(cle) ?? []), d]);
}

const aSupprimer = [];
const aReecrire = [];
for (const lignes of groupes.values()) {
  lignes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const [garde, ...suivants] = lignes;
  aSupprimer.push(...suivants);
  if (garde.match_key !== sansDate(garde.match_key)) {
    aReecrire.push({ id: garde.id, cle: sansDate(garde.match_key) });
  }
}

const clients = new Set(aSupprimer.map((d) => d.user_id));
console.log(`ANALYSES À RENDRE ......... ${aSupprimer.length}`);
console.log(`CLIENTS CONCERNÉS ......... ${clients.size}`);
console.log(`CLÉS À NORMALISER ......... ${aReecrire.length}\n`);

if (!ECRIRE) {
  console.log('(simulation — rien n’a été écrit. Relancer avec --ecrire.)');
} else {
  // ── 1. LE REMBOURSEMENT ────────────────────────────────────────────────
  let rendues = 0;
  for (let i = 0; i < aSupprimer.length; i += 100) {
    const lot = aSupprimer.slice(i, i + 100).map((d) => d.id);
    const { error } = await sb.from('analysis_usage').delete().in('id', lot);
    if (error) console.log(`  ÉCHEC suppression : ${error.message}`);
    else rendues += lot.length;
  }
  console.log(`${rendues} analyse(s) rendue(s) à ${clients.size} client(s).`);

  // ── 2. LA NORMALISATION ────────────────────────────────────────────────
  let reecrites = 0;
  let echecs = 0;
  for (const r of aReecrire) {
    const { error } = await sb.from('analysis_usage').update({ match_key: r.cle }).eq('id', r.id);
    if (error) echecs++;
    else reecrites++;
  }
  console.log(`${reecrites} clé(s) normalisée(s), ${echecs} échec(s).`);
}
