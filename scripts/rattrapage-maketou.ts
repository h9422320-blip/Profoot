/**
 * ROUVRIR LES ACCÈS DES CLIENTS QUE LE PULSE A REFUSÉS.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Le 28 août 2026 au matin, neuf personnes avaient payé sur MakeTou et aucune
 * n'avait reçu son accès. Le pulse arrivait pourtant, authentifié, le produit
 * reconnu — puis repartait sur « Montant null incompatible » : les vraies
 * ventes portent les sommes en TEXTE ("2000"), là où le message de test les
 * porte en nombre. Le défaut est corrigé ; restent les clients.
 *
 * ── POURQUOI CE SCRIPT PASSE PAR LA PORTE DE PRODUCTION ───────────────────
 *
 * Il appelle `ouvrirAccesMaketou`, exactement comme le ferait un pulse. Écrire
 * un chemin de réparation à part reviendrait à réparer avec un outil que
 * personne n'a testé, au moment précis où l'on ne peut pas se tromper. Et
 * comme l'ouverture est idempotente — la vente porte son identifiant —, le
 * relancer ne crédite jamais deux fois.
 *
 *   npx tsx scripts/rattrapage-maketou.ts            (rapport seul)
 *   npx tsx scripts/rattrapage-maketou.ts --ouvrir   (ouvre réellement)
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { ouvrirAccesMaketou, type VenteMaketou } from '../src/lib/maketou';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const ADMIN = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUVRIR = process.argv.includes('--ouvrir');

/** Les ventes relevées sur la boutique, référence exacte comprise. */
type Vente = { id: string; email: string; nom: string; produit: string; prix: string };

const VENTES: Vente[] = [
  ['62768f92-bc1a-43b0-ad69-d4daafca90fc', 'abdelciss132@gmail.com', 'Abdel Cisse'],
  ['dc3fd44f-09cd-4989-a182-010eb571d4d2', 'diarrasouley410@gmail.com', 'Diarra Souleymane'],
  ['f9a93254-d449-42d8-a479-f035ffa1a24c', 'okotched@gmail.com', 'Olatoundji Dieudonné Okotche'],
  ['a01b52b2-022b-46d9-b4b2-afafd32e945e', 'kiruagone905@gmail.com', 'Kirua Gone'],
  ['3d75eebc-e15e-42e5-b1b8-416f2d65f0c5', 'abalonesagittairefernando123@gmail.com', 'Fataou Abalo'],
  ['21620706-758d-4711-a68a-6229389fbb20', 'felixchantal042@gmail.com', 'Félix Banon'],
  ['9baf4aa1-47f4-41f6-a3c2-1da013e5de9f', 'tenereamachakoul@gmail.com', 'Abdoul Khayri Aboubacar'],
  ['3dc13223-4d49-4944-84a8-442b5d2605cd', 'tenereamachakoul@gmail.com', 'Abdoul Khayri Aboubacar'],
  ['fe5c929d-5c0d-4c39-a0d1-f476dff1bad5', 'wilsonbrayan551@gmail.com', 'Wilson Brayan'],
  // Encaissée après l'export de la boutique, relevée dans le journal du pulse.
  ['28a1adff-bcdb-4341-8df4-696e9e13f4ee', 'keitalassana660@gmail.com', 'Keita Lassana'],
].map(([id, email, nom]) => ({
  id,
  email,
  nom,
  produit: 'ProFoot AI — Accès Essentiel (30 jours)',
  prix: '2000',
}));

/** Le message tel que MakeTou l'aurait envoyé, format réel compris. */
const enMessage = (v: Vente): VenteMaketou => ({
  eventType: 'SUCCESSFUL_SALE',
  sale: { id: v.id, amount: '2040' as unknown as number, currency: 'XOF' },
  customer: { email: v.email, name: v.nom },
  products: [{ name: v.produit, price: v.prix as unknown as number, currency: 'XOF' }],
  paymentMethod: { name: 'MakeTou' },
});

async function principal() {
const ouverts: string[] = [];
const sansCompte: string[] = [];
const dejaCredites: string[] = [];
const echecs: string[] = [];

console.log(
  OUVRIR
    ? '── OUVERTURE DES ACCÈS ─────────────────────────────────\n'
    : '── SIMULATION (ajouter --ouvrir pour agir) ─────────────\n'
);

for (const v of VENTES) {
  if (!OUVRIR) {
    console.log(`  ${v.email.padEnd(42)} vente ${v.id.slice(0, 8)}…`);
    continue;
  }
  try {
    const r = await ouvrirAccesMaketou(ADMIN, enMessage(v));
    if (r.ouvert) {
      ouverts.push(`${v.email} → ${r.plan} jusqu'au ${r.expireLe.slice(0, 10)}`);
      console.log(`  ✅ ${v.email.padEnd(42)} accès ouvert jusqu'au ${r.expireLe.slice(0, 10)}`);
    } else if (/déjà créditée/i.test(r.motif)) {
      dejaCredites.push(v.email);
      console.log(`  ↩️  ${v.email.padEnd(42)} déjà créditée (rien à refaire)`);
    } else if (/Aucun compte/i.test(r.motif)) {
      sansCompte.push(v.email);
      console.log(`  ⚠️  ${v.email.padEnd(42)} AUCUN COMPTE ProFoot à cette adresse`);
    } else {
      echecs.push(`${v.email} — ${r.motif}`);
      console.log(`  ❌ ${v.email.padEnd(42)} ${r.motif}`);
    }
  } catch (e: any) {
    echecs.push(`${v.email} — ${e?.message}`);
    console.log(`  ❌ ${v.email.padEnd(42)} ${e?.message}`);
  }
}

if (OUVRIR) {
  console.log('\n── BILAN ───────────────────────────────────────────────');
  console.log(`  Accès ouverts        : ${ouverts.length}`);
  console.log(`  Déjà crédités        : ${dejaCredites.length}`);
  console.log(`  Sans compte ProFoot  : ${sansCompte.length}`);
  console.log(`  En échec             : ${echecs.length}`);
  if (sansCompte.length) {
    console.log('\n  Ont payé mais n\'ont pas encore de compte — à contacter :');
    for (const e of sansCompte) console.log(`    ${e}`);
  }
  if (echecs.length) {
    console.log('\n  Échecs à examiner :');
    for (const e of echecs) console.log(`    ${e}`);
  }
}
}

void principal();
