/**
 * DIAGNOSTIC — LE CONTRAT DE KADER, TEL QU'IL EST RÉELLEMENT EN BASE.
 *
 * LECTURE SEULE. Ce script n'écrit rien, ne corrige rien.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: partenaires, error } = await sb.from('partners').select('*');
if (error) { console.log('Table partners illisible :', error.message); process.exit(1); }

console.log(`\n  ${partenaires.length} partenaire(s) en base.\n`);

for (const p of partenaires) {
  console.log(`  ${p.name ?? '(sans nom)'}  <${p.email}>`);
  console.log(`     id                    : ${p.id}`);
  console.log(`     part_ca_pct           : ${p.part_ca_pct}`);
  console.log(`     remuneration_depuis   : ${p.remuneration_depuis ?? 'NON RENSEIGNE'}`);
  console.log(`     starts_on             : ${p.starts_on ?? '—'}`);
  console.log(`     ends_on               : ${p.ends_on ?? '—'}`);
  console.log(`     created_at            : ${p.created_at}`);
  console.log(`     status                : ${p.status}`);
  console.log(`     amount / currency     : ${p.amount} ${p.currency}`);
  console.log('');
}

// ── Les ventes autour de la date de depart, pour voir ce qui bascule ────────
const kader = partenaires.find((p) => String(p.email).toLowerCase().includes('traoreismaela'));
if (!kader) { console.log('  Kader introuvable.'); process.exit(0); }

const depart = kader.remuneration_depuis ? new Date(kader.remuneration_depuis) : null;
if (!depart) { console.log('  Aucune date de depart : aucune recette ne lui est comptee.'); process.exit(0); }

const moisDepart = depart.toISOString().slice(0, 7);
const debutDuMois = new Date(`${moisDepart}-01T00:00:00.000Z`);

const { data: abos } = await sb
  .from('subscriptions')
  .select('plan, created_at, email')
  .gte('created_at', debutDuMois.toISOString())
  .order('created_at', { ascending: true });

const avant = (abos ?? []).filter((a) => new Date(a.created_at) < depart);
const apres = (abos ?? []).filter((a) => new Date(a.created_at) >= depart);

console.log(`  ── Abonnements du mois ${moisDepart} ──`);
console.log(`     AVANT le ${depart.toISOString()} : ${avant.length}`);
console.log(`     A PARTIR de cette date          : ${apres.length}`);
console.log('');
if (avant.length) {
  console.log('     Les ventes AVANT la date de depart (a exclure des 35 %) :');
  for (const a of avant.slice(0, 20))
    console.log(`        ${String(a.created_at).slice(0, 19)}  ${a.plan}`);
  console.log('');
}
console.log(`  Total abonnements du mois : ${(abos ?? []).length}`);
