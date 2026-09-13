/**
 * LA VÉRIFICATION DE FOND DU CHIFFRE D'AFFAIRES.
 *
 * Un total juste peut cacher des lignes fausses. On cherche ici tout ce qui
 * ferait douter du chiffre : accès accordés sans paiement, doublons, ventes
 * sans intention, intentions sans vente, et le net après frais de boutique.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const DEBUT = '2026-09-08T00:00:00Z';
const FIN = '2026-09-13T00:00:00Z';

const { data: abos } = await sb
  .from('subscriptions')
  .select('id, user_id, plan, status, amount, created_at, provider, chariow_sale_id')
  .gte('created_at', DEBUT).lt('created_at', FIN).order('created_at');
const { data: intentions } = await sb
  .from('payment_intents')
  .select('sale_id, user_id, plan, email, amount, created_at, consumed_at, pays, moyen_paiement')
  .gte('created_at', DEBUT).lt('created_at', FIN);

const A = (abos ?? []) as any[];
const I = (intentions ?? []) as any[];

// ── 1. LES ACCÈS ACCORDÉS SANS ARGENT ──────────────────────────────────────
const gratuits = A.filter((a) => Number(a.amount ?? 0) === 0);
console.log(`── 1. ACCÈS ACCORDÉS À ZÉRO FRANC : ${gratuits.length}`);
for (const g of gratuits)
  console.log(`   ${String(g.created_at).slice(0, 16).replace('T', ' ')}  ${g.plan}  via ${g.provider}  ${g.chariow_sale_id ?? '—'}`);
console.log(`   → ils ne pèsent rien sur le chiffre d'affaires, mais ce sont ${gratuits.length} abonné(s) non payants.\n`);

// ── 2. UN MÊME COMPTE PAYE-T-IL DEUX FOIS ? ────────────────────────────────
const parUtilisateur = new Map<string, any[]>();
for (const a of A.filter((x) => Number(x.amount ?? 0) > 0)) {
  const l = parUtilisateur.get(a.user_id) ?? [];
  l.push(a); parUtilisateur.set(a.user_id, l);
}
const doubles = [...parUtilisateur].filter(([, l]) => l.length > 1);
console.log(`── 2. COMPTES AYANT PAYÉ PLUSIEURS FOIS EN CINQ JOURS : ${doubles.length}`);
for (const [u, l] of doubles)
  console.log(`   ${u.slice(0, 8)}…  ${l.length} paiements : ` +
    l.map((x) => `${String(x.created_at).slice(5, 16).replace('T', ' ')} ${x.amount}F ${x.plan}`).join('  |  '));
console.log(`   → ${doubles.length ? 'à regarder : renouvellement légitime ou double débit ?' : 'aucun double débit.'}\n`);

// ── 3. VENTES SANS INTENTION, ET INTENTIONS SANS VENTE ─────────────────────
const idsIntentions = new Set(I.map((i) => String(i.sale_id)));
const sansIntention = A.filter((a) => Number(a.amount ?? 0) > 0 && a.chariow_sale_id && !idsIntentions.has(String(a.chariow_sale_id)));
console.log(`── 3a. VENTES PAYANTES SANS INTENTION CORRESPONDANTE : ${sansIntention.length} sur ${A.filter((a) => Number(a.amount ?? 0) > 0).length}`);
for (const s of sansIntention.slice(0, 15))
  console.log(`   ${String(s.created_at).slice(0, 16).replace('T', ' ')}  ${s.amount}F  ${s.plan}  ${s.chariow_sale_id}`);
console.log('   → une intention créée la veille et payée le lendemain explique une partie de l’écart.\n');

const sansVente = I.filter((i) => !i.consumed_at);
console.log(`── 3b. INTENTIONS JAMAIS ABOUTIES : ${sansVente.length} sur ${I.length}`);
console.log(`   → ${sansVente.length ? 'autant d’acheteurs partis en route.' : 'chaque personne qui a cliqué pour payer a bien reçu son accès.'}\n`);

// ── 4. LE NET APRÈS FRAIS DE BOUTIQUE ──────────────────────────────────────
const brut = A.reduce((s, a) => s + Number(a.amount ?? 0), 0);
const fraisVendeur = Math.round(brut * 0.05);
console.log('── 4. CE QUI RESTE APRÈS LA BOUTIQUE');
console.log(`   Brut (prix catalogue)            ${brut.toLocaleString('fr-FR')} F`);
console.log(`   Retenue MakeTou, 5 % vendeur    -${fraisVendeur.toLocaleString('fr-FR')} F`);
console.log(`   Net acquis chez MakeTou          ${(brut - fraisVendeur).toLocaleString('fr-FR')} F`);
console.log('   → acquis n’est pas encaissé : MakeTou garde l’argent jusqu’au retrait.\n');

// ── 5. NOUVEAUX PAYEURS CONTRE RENOUVELLEMENTS ─────────────────────────────
const payeurs = [...parUtilisateur.keys()];
const { data: avant } = await sb
  .from('subscriptions')
  .select('user_id')
  .lt('created_at', DEBUT)
  .in('user_id', payeurs.slice(0, 300));
const dejaVus = new Set(((avant ?? []) as any[]).map((x) => x.user_id));
const nouveaux = payeurs.filter((u) => !dejaVus.has(u));
console.log('── 5. NOUVEAUX CLIENTS CONTRE RENOUVELLEMENTS');
console.log(`   ${payeurs.length} compte(s) payeur(s) distinct(s) sur les cinq jours`);
console.log(`      dont ${nouveaux.length} nouveaux — jamais d’abonnement avant le 8 septembre`);
console.log(`      dont ${payeurs.length - nouveaux.length} qui revenaient`);
