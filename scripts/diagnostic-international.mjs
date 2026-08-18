/**
 * QUI ARRIVE À ENTRER, ET DEPUIS OÙ ?
 *
 * Avant de chercher un blocage dans le code, on regarde ce que les données
 * disent : des visiteurs du Maroc, d'Algérie ou de France ont-ils déjà créé un
 * compte, lancé une analyse, atteint le paiement ? Un pays présent à une étape
 * et absent de la suivante désigne l'endroit exact où ça casse.
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

// ── 1. Les tentatives de paiement, par pays ─────────────────────────────────
const { data: intents } = await sb
  .from('payment_intents')
  .select('pays, pays_source, email, user_id, amount, created_at, consumed_at')
  .order('created_at', { ascending: false })
  .limit(2000);

const parPays = new Map();
for (const i of intents ?? []) {
  const p = i.pays || '??';
  const e = parPays.get(p) ?? { tentatives: 0, aboutis: 0, comptes: new Set() };
  e.tentatives++;
  if (i.consumed_at) e.aboutis++;
  e.comptes.add(i.user_id);
  parPays.set(p, e);
}

console.log('=============== TENTATIVES DE PAIEMENT PAR PAYS ===============');
console.log('  pays | tentatives | abouties | comptes distincts');
for (const [p, e] of [...parPays].sort((a, b) => b[1].tentatives - a[1].tentatives)) {
  console.log(`   ${p.padEnd(4)} | ${String(e.tentatives).padStart(10)} | ${String(e.aboutis).padStart(8)} | ${e.comptes.size}`);
}

// ── 2. Les comptes créés, et ce qu'ils ont fait ─────────────────────────────
const comptes = [];
for (let page = 1; page <= 30; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  const lot = data?.users ?? [];
  comptes.push(...lot);
  if (lot.length < 200) break;
}

console.log(`\n=============== COMPTES : ${comptes.length} ===============`);
const confirmes = comptes.filter((u) => u.email_confirmed_at || u.confirmed_at);
const jamaisConnectes = comptes.filter((u) => !u.last_sign_in_at);
console.log(`  Adresse confirmée      : ${confirmes.length} / ${comptes.length}`);
console.log(`  Jamais connectés       : ${jamaisConnectes.length}`);

// Un compte créé mais jamais confirmé = l'e-mail de validation n'est pas arrivé
// ou n'a pas été ouvert. C'est le blocage le plus courant hors d'Afrique de
// l'Ouest, où les fournisseurs de messagerie filtrent différemment.
const nonConfirmes = comptes.filter((u) => !(u.email_confirmed_at || u.confirmed_at));
console.log(`  Adresse NON confirmée  : ${nonConfirmes.length}`);
for (const u of nonConfirmes.slice(0, 12)) {
  console.log(`     ${new Date(u.created_at).toLocaleString('fr-FR')}  ${u.email}`);
}

// ── 3. Les analyses, par utilisateur : qui se sert vraiment de l'app ────────
const { data: analyses } = await sb
  .from('analysis_history')
  .select('user_id, created_at')
  .order('created_at', { ascending: false })
  .limit(3000);
const actifs = new Set((analyses ?? []).map((a) => a.user_id));
console.log(`\n  Comptes ayant lancé au moins une analyse : ${actifs.size} / ${comptes.length}`);

// ── 4. Extensions des adresses : un indice de pays ──────────────────────────
console.log('\n=============== EXTENSIONS DES ADRESSES E-MAIL ===============');
const parDomaine = new Map();
for (const u of comptes) {
  const d = String(u.email).split('@')[1] ?? '?';
  parDomaine.set(d, (parDomaine.get(d) ?? 0) + 1);
}
for (const [d, n] of [...parDomaine].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`   ${d.padEnd(24)} ${n}`);
}

// ── 5. Les échecs enregistrés ───────────────────────────────────────────────
for (const t of ['echecs_analyse', 'analysis_failures', 'logs', 'erreurs']) {
  const { data, error } = await sb.from(t).select('*').order('created_at', { ascending: false }).limit(15);
  if (error) continue;
  console.log(`\n=============== TABLE « ${t} » : ${data?.length ?? 0} dernières ===============`);
  for (const l of data ?? []) console.log(`   ${JSON.stringify(l).slice(0, 240)}`);
}
