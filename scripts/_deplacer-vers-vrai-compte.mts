/**
 * RENDRE UN ABONNEMENT PAYÉ À SON VRAI PROPRIÉTAIRE.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 11 SEPTEMBRE 2026 ─────────────────────────────
 *
 * Deux acheteurs ont payé en tapant mal leur adresse, et leur accès a été
 * posé sur un compte créé à cette adresse fautive — un compte où ils
 * n'entreront jamais :
 *
 *   babaoulare@4gmail.com  → accès posé sur babaoulare@gmail.com (créé le
 *     10 septembre sur une correction de domaine qui a enlevé le « 4 »).
 *     Son vrai compte : babaoulare4@gmail.com, créé le soir de son premier
 *     paiement. Il a même essayé babaoulare4@icloud.com et
 *     babaoulare4@glail.com. Quatre mille francs, six jours dehors.
 *
 *   mbayesaliou2024@icloud.com → compte créé le 29 août après son paiement,
 *     jamais ouvert. Son vrai compte : mbayesaliou2004@icloud.com, utilisé
 *     du 17 au 25 août.
 *
 * ── LES REFUS ────────────────────────────────────────────────────────────
 *
 * Rien ne bouge si : le compte fautif s'est déjà connecté, a déjà servi une
 * analyse, ou si le vrai compte a déjà un accès actif. Dans ces cas il ne
 * s'agit plus de réparer une erreur, et il faut décider à la main.
 *
 * Sans argument : ce qui serait fait. Avec --ecrire : appliqué.
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

const DEPLACEMENTS = [
  // Le compte fautif a été créé par l'ouverture manuelle du 10 septembre, sur
  // une adresse devinée : il est retiré une fois vide.
  { de: 'babaoulare@gmail.com', vers: 'babaoulare4@gmail.com', retirerSource: true, trenteJours: false },
  // Payé le 29 août, jamais utilisable par notre faute : ses trente jours
  // repartent d'aujourd'hui.
  { de: 'mbayesaliou2024@icloud.com', vers: 'mbayesaliou2004@icloud.com', retirerSource: false, trenteJours: true },
];

const comptes = new Map<string, any>();
for (let page = 1; page <= 200; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('LECTURE DES COMPTES IMPOSSIBLE : ' + error.message); process.exit(1); }
  for (const u of data?.users ?? []) comptes.set(String(u.email ?? '').toLowerCase(), u);
  if ((data?.users ?? []).length < 1000) break;
}

const actif = (s: any) => s.status === 'active' && Date.parse(s.expires_at) > Date.now();
let refus = 0;
console.log(ECRIRE ? '\nAPPLICATION\n' : '\nSIMULATION — rien ne sera écrit\n');

for (const d of DEPLACEMENTS) {
  console.log(`── ${d.de}  →  ${d.vers}`);
  const src = comptes.get(d.de);
  const dst = comptes.get(d.vers);
  if (!src || !dst) { console.log(`   REFUS : compte ${!src ? 'fautif' : 'véritable'} introuvable\n`); refus++; continue; }
  if (src.last_sign_in_at) { console.log('   REFUS : le compte fautif s’est déjà connecté\n'); refus++; continue; }

  const [{ count: usages }, { count: historique }] = await Promise.all([
    sb.from('analysis_usage').select('*', { count: 'exact', head: true }).eq('user_id', src.id),
    sb.from('analysis_history').select('*', { count: 'exact', head: true }).eq('user_id', src.id),
  ]);
  if ((usages ?? 0) + (historique ?? 0) > 0) { console.log('   REFUS : le compte fautif a déjà servi\n'); refus++; continue; }

  const { data: subsDst } = await sb.from('subscriptions').select('*').eq('user_id', dst.id);
  if ((subsDst ?? []).some(actif)) { console.log('   REFUS : le vrai compte a déjà un accès actif\n'); refus++; continue; }

  const { data: subsSrc } = await sb.from('subscriptions').select('*').eq('user_id', src.id);
  const aDeplacer = (subsSrc ?? []).filter(actif);
  if (!aDeplacer.length) { console.log('   rien à déplacer : aucun accès actif sur le compte fautif\n'); continue; }
  const echeance = new Date(Date.now() + 30 * 86_400_000).toISOString();
  for (const s of aDeplacer)
    console.log(
      `   ${s.plan}  vente ${String(s.chariow_sale_id).slice(0, 8)}  échéance ${String(s.expires_at).slice(0, 10)}` +
        (d.trenteJours ? ` → ${echeance.slice(0, 10)}` : '')
    );
  if (!ECRIRE) { console.log(''); continue; }

  for (const s of aDeplacer) {
    const maj: Record<string, unknown> = { user_id: dst.id };
    if (d.trenteJours) maj.expires_at = echeance;
    const { error } = await sb.from('subscriptions').update(maj).eq('id', s.id);
    console.log(`   abonnement ${s.plan} : ${error ? 'ÉCHEC ' + error.message : 'rendu au vrai compte'}`);
    if (s.chariow_sale_id)
      await sb.from('payment_intents').update({ user_id: dst.id }).eq('sale_id', String(s.chariow_sale_id));
  }
  await sb.from('webhook_events').insert({
    provider: 'reparation',
    delivery_id: `vrai-compte-${src.id}-${Date.now()}`,
    event: 'acces_rendu_au_vrai_compte',
    payload: {
      de: d.de,
      vers: d.vers,
      abonnements: aDeplacer.map((s: any) => s.id),
      trente_jours_offerts: d.trenteJours,
      motif: 'adresse mal tapée au paiement, accès posé sur un compte jamais utilisé — 2026-09-11',
    },
  });

  if (d.retirerSource) {
    const { data: reste } = await sb.from('subscriptions').select('id').eq('user_id', src.id);
    if (src.user_metadata?.cree_par !== 'ouverture-acces-non-servis-2026-09-10') console.log('   compte fautif conservé : il n’a pas été créé par l’ouverture du 10 septembre');
    else if (reste?.length) console.log('   compte fautif conservé : il porte encore des abonnements');
    else {
      const { error } = await sb.auth.admin.deleteUser(src.id);
      console.log(`   compte fautif ${d.de} : ${error ? 'ÉCHEC ' + error.message : 'retiré'}`);
    }
  }
  console.log('');
}
process.exit(refus ? 2 : 0);
