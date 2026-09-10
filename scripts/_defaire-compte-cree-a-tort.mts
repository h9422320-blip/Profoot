/**
 * DÉFAIRE UN COMPTE QUE JE N'AURAIS JAMAIS DÛ CRÉER.
 *
 * ── CE QUI S'EST PASSÉ LE 10 SEPTEMBRE 2026 ─────────────────────────────
 *
 * La règle du projet, posée par le propriétaire le 1er septembre : **on ne
 * crée JAMAIS un compte à la place de quelqu'un.** L'acheteur est invité, et
 * l'abonnement se rattache tout seul à la seconde où il crée son compte —
 * voir `acces-a-l-inscription.ts`.
 *
 * J'ai créé le compte quand même. Résultat exactement inverse de celui
 * cherché : le compte a été créé SANS mot de passe, donc
 *
 *   - se connecter échoue : il n'y a pas de mot de passe à saisir ;
 *   - s'inscrire échoue aussi : l'adresse est déjà prise.
 *
 * L'acheteur est enfermé dehors par le geste censé le faire entrer.
 *
 * ── CE QUE CET OUTIL REMET EN PLACE ─────────────────────────────────────
 *
 * Il retire UNIQUEMENT ce que j'ai écrit aujourd'hui, dans l'ordre inverse :
 *
 *   1. l'abonnement porté par cette vente ;
 *   2. la marque « vente servie » sur le paiement ;
 *   3. la trace de livraison ;
 *   4. le compte lui-même — s'il n'a jamais servi.
 *
 * Le paiement, lui, n'est PAS touché : il reste « completed », et c'est ce
 * qui permettra à l'abonnement de se rattacher tout seul dès que la personne
 * créera son compte elle-même.
 *
 * ── DEUX REFUS DE SÉCURITÉ ──────────────────────────────────────────────
 *
 * L'outil s'arrête net si le compte a été utilisé — une connexion après sa
 * création, une analyse consommée, un historique. Dans ce cas il ne
 * s'agirait plus de défaire une erreur mais d'effacer le travail de
 * quelqu'un, et il faut décider à la main.
 *
 * Sans argument : simulation. Avec --ecrire : appliqué.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const ECRIRE = process.argv.includes('--ecrire');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const cible = process.argv.slice(2).find((a) => a.includes('@'))?.trim().toLowerCase();
if (!cible) {
  console.log('\n  npx tsx scripts/_defaire-compte-cree-a-tort.mts adresse@exemple.com [--ecrire]\n');
  process.exit(1);
}

console.log(ECRIRE ? '\nAPPLICATION\n' : '\nSIMULATION — rien ne sera écrit\n');

// ── LE COMPTE ───────────────────────────────────────────────────────────────
let compte: any = null;
for (let page = 1; page <= 200; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('ERREUR : ' + error.message); process.exit(1); }
  const lot = data?.users ?? [];
  compte = lot.find((u: any) => String(u.email ?? '').toLowerCase() === cible) ?? compte;
  if (lot.length < 1000) break;
}
if (!compte) { console.log(`  Aucun compte à ${cible} — rien à défaire.\n`); process.exit(0); }

console.log(`  compte      : ${compte.id}`);
console.log(`  créé le     : ${String(compte.created_at).slice(0, 19)}`);
console.log(`  créé par    : ${compte.user_metadata?.cree_par ?? '(inconnu)'}`);
console.log(`  connexion   : ${compte.last_sign_in_at ?? 'JAMAIS'}`);

// ── LES DEUX REFUS DE SÉCURITÉ ──────────────────────────────────────────────
if (compte.user_metadata?.cree_par !== 'ouverture-acces-non-servis-2026-09-10') {
  console.log('\n  REFUS : ce compte n’a pas été créé par l’ouverture du 10 septembre.');
  console.log('  On ne défait que sa propre erreur.\n');
  process.exit(1);
}
if (compte.last_sign_in_at) {
  console.log('\n  REFUS : ce compte s’est déjà connecté. À décider à la main.\n');
  process.exit(1);
}

const { count: analyses } = await sb
  .from('analysis_usage')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', compte.id);
const { count: historique } = await sb
  .from('analysis_history')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', compte.id);
console.log(`  analyses    : ${analyses ?? 0} décomptée(s), ${historique ?? 0} dans l’historique`);
if ((analyses ?? 0) > 0 || (historique ?? 0) > 0) {
  console.log('\n  REFUS : ce compte a servi. À décider à la main.\n');
  process.exit(1);
}

// ── CE QU'ON RETIRE ─────────────────────────────────────────────────────────
const { data: abos } = await sb.from('subscriptions').select('*').eq('user_id', compte.id);
console.log(`\n  ${abos?.length ?? 0} abonnement(s) à retirer :`);
for (const a of abos ?? []) console.log(`    ${a.plan}  vente ${a.chariow_sale_id}`);

const ventes = (abos ?? []).map((a: any) => String(a.chariow_sale_id)).filter(Boolean);

if (!ECRIRE) {
  console.log('\n  SERAIENT RETIRÉS : les abonnements, la marque « servie » sur le(s) paiement(s),');
  console.log('  la trace de livraison, puis le compte.');
  console.log('\n  Le PAIEMENT reste « completed » : l’abonnement se rattachera tout seul');
  console.log('  à la seconde où la personne créera son compte elle-même.\n');
  process.exit(0);
}

for (const a of abos ?? []) {
  const { error } = await sb.from('subscriptions').delete().eq('id', a.id);
  console.log(`    abonnement ${a.plan} : ${error ? 'ÉCHEC ' + error.message : 'retiré'}`);
}

for (const v of ventes) {
  const { error } = await sb
    .from('payment_intents')
    .update({ user_id: null, consumed_at: null })
    .eq('sale_id', v);
  console.log(`    paiement ${v.slice(0, 8)} : ${error ? 'ÉCHEC ' + error.message : 'rendu disponible'}`);

  const { error: e2 } = await sb.from('webhook_events').delete().eq('delivery_id', `livraison-${v}`);
  console.log(`    trace ${v.slice(0, 8)}    : ${e2 ? 'ÉCHEC ' + e2.message : 'retirée'}`);
}

const { error: e3 } = await sb.auth.admin.deleteUser(compte.id);
console.log(`    compte              : ${e3 ? 'ÉCHEC ' + e3.message : 'supprimé'}`);

console.log('\n  L’adresse est de nouveau libre. La personne peut créer son compte,');
console.log('  et son abonnement s’ouvrira dans la seconde.\n');
