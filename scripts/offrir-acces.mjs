/**
 * OFFRIR UN ACCÈS ET LE DIRE À LA PERSONNE.
 *
 * POURQUOI CET OUTIL
 *
 * Le 18 août 2026, deux clients ont payé deux mille francs et n'ont rien reçu.
 * Réparer leur accès ne suffit pas : quelqu'un qui a payé, attendu, et écrit
 * pour se plaindre doit APPRENDRE qu'on s'en est aperçu et ce qu'on lui offre.
 * Un abonnement qui se prolonge en silence ne répare rien — le client garde le
 * souvenir d'avoir payé pour rien.
 *
 * Cet outil fait donc les deux d'un coup : il ouvre l'accès ET dépose le mot
 * qui l'accompagne, visible au-dessus du compteur d'analyses.
 *
 * IL EST RÉUTILISABLE
 *
 * Rien n'y est propre à ces deux clients. Le prochain geste commercial se fera
 * avec la même commande.
 *
 * Usage :
 *   node scripts/offrir-acces.mjs --mois 2 --plan vip_yearly \
 *        --titre "Nos excuses" --texte "..." \
 *        adresse1@exemple.com adresse2@exemple.com
 *
 *   --verifier   n'écrit rien, montre seulement ce qui serait fait
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Lecture des arguments ───────────────────────────────────────────────────
const args = process.argv.slice(2);
const lire = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};
const verifierSeulement = args.includes('--verifier');
const mois = Number(lire('mois', 2));
const plan = lire('plan', 'vip_yearly');
const titre = lire('titre', '');
const texte = lire('texte', '');
const cleMessage = lire('cle', `geste-${new Date().toISOString().slice(0, 10)}`);
const adresses = args.filter((a) => a.includes('@'));

if (!adresses.length) {
  console.error('\n  Aucune adresse e-mail fournie.\n');
  process.exit(1);
}

console.log(`\n${verifierSeulement ? 'VÉRIFICATION (rien ne sera écrit)' : 'APPLICATION'}`);
console.log(`  Offre        : ${mois} mois de plan « ${plan} »`);
console.log(`  Destinataires: ${adresses.join(', ')}\n`);

// ── Retrouver les comptes ───────────────────────────────────────────────────
// ── ON LIT JUSQU'AU BOUT, ET C'EST TOUT LE SUJET ──────────────────────────
//
// Ce parcours s'arrêtait à trente pages de deux cents, soit six mille
// comptes. Il y en a plus de dix mille : tout client inscrit récemment se
// voyait répondre « AUCUN COMPTE avec cette adresse — rien fait », et le
// geste commercial n'avait tout simplement pas lieu.
//
// Constaté le 10 septembre 2026 sur diarrasouleyman220@gmail.com, dont le
// compte existe bel et bien depuis le 23 août. Rien ne le signalait : la
// phrase du script ressemble à un diagnostic, pas à une panne.
//
// On boucle donc jusqu'à ce qu'une page revienne incomplète — c'est le seul
// signal de fin fiable — avec un plafond assez large pour ne plus jamais
// couper, et un avertissement s'il devait être atteint.
const comptes = new Map();
const PAR_PAGE = 1000;
const PAGES_MAX = 200; // deux cent mille comptes : de la marge pour des années.
let page = 1;
for (; page <= PAGES_MAX; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PAR_PAGE });
  if (error) {
    console.error(`\n  Lecture des comptes interrompue page ${page} : ${error.message}\n`);
    break;
  }
  const lot = data?.users ?? [];
  for (const u of lot) comptes.set(String(u.email).toLowerCase(), u);
  if (lot.length < PAR_PAGE) break;
}
if (page > PAGES_MAX) {
  console.error('\n  ATTENTION : plafond de lecture atteint, des comptes peuvent manquer.\n');
}
console.log(`  ${comptes.size} comptes lus.\n`);

for (const adresse of adresses) {
  const u = comptes.get(adresse.toLowerCase());
  console.log(`── ${adresse}`);
  if (!u) {
    console.log('   AUCUN COMPTE avec cette adresse — rien fait.\n');
    continue;
  }

  // Le cadeau PROLONGE ce qui existe : il ne le remplace pas. Quelqu'un dont
  // l'abonnement court jusqu'au 18 septembre reçoit deux mois EN PLUS, pas
  // deux mois à la place — sinon le geste lui reprendrait ce qu'il a payé.
  const { data: abos } = await sb
    .from('subscriptions')
    .select('id, plan, status, expires_at')
    .eq('user_id', u.id)
    .order('expires_at', { ascending: false });

  const actif = (abos ?? []).find(
    (a) => a.status === 'active' && a.expires_at && new Date(a.expires_at) > new Date()
  );
  const depart = actif?.expires_at ? new Date(actif.expires_at) : new Date();
  const fin = new Date(depart);
  fin.setMonth(fin.getMonth() + mois);

  console.log(`   abonnement actuel : ${actif ? `${actif.plan}, expire ${depart.toLocaleDateString('fr-FR')}` : 'aucun'}`);
  console.log(`   après le geste    : ${plan}, expire ${fin.toLocaleDateString('fr-FR')}`);
  console.log(`   message           : « ${titre} » ${texte.slice(0, 60)}${texte.length > 60 ? '…' : ''}`);

  if (verifierSeulement) { console.log(''); continue; }

  // 1) L'accès.
  if (actif) {
    const { error } = await sb
      .from('subscriptions')
      .update({ plan, expires_at: fin.toISOString() })
      .eq('id', actif.id);
    if (error) { console.log(`   !! abonnement non mis à jour : ${error.message}\n`); continue; }
  } else {
    const { error } = await sb.from('subscriptions').insert({
      user_id: u.id, plan, status: 'active', amount: 0, currency: 'XOF',
      created_at: new Date().toISOString(), expires_at: fin.toISOString(),
    });
    if (error) { console.log(`   !! abonnement non créé : ${error.message}\n`); continue; }
  }

  // 2) Le mot qui l'accompagne.
  if (texte) {
    const { error } = await sb.auth.admin.updateUserById(u.id, {
      user_metadata: {
        ...(u.user_metadata ?? {}),
        message_personnel: { titre: titre || undefined, texte, cle: cleMessage },
      },
    });
    if (error) console.log(`   !! message non déposé : ${error.message}`);
  }

  console.log('   FAIT.\n');
}
