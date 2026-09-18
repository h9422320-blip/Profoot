/**
 * Ouvre l'accès d'une vente payée sur le VRAI compte de l'acheteur, quand
 * l'adresse tapée à la boutique diffère trop de la sienne pour être reconnue
 * comme une faute de frappe (ex. chiffres dans le désordre).
 *
 * Passe par la fonction officielle `ouvrirAccesAlInscription` : même abonnement,
 * même provenance, même vente — rien n'est créé d'autre, aucun compte n'est créé.
 *
 *   npx tsx scripts/_livrer-vente-sur-compte.mts <adresse de la vente> <adresse du compte>
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const [adresseVente, adresseCompte] = process.argv.slice(2).map((x) => String(x).trim().toLowerCase());
if (!adresseVente || !adresseCompte) { console.log('usage : <adresse de la vente> <adresse du compte>'); process.exit(1); }
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { ouvrirAccesAlInscription } = await import('../src/lib/acces-a-l-inscription.js');
const sb = createAdminClient();
let uid: string | null = null;
for (let page = 1; page < 40 && !uid; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  const u = data?.users.find((x) => String(x.email).toLowerCase() === adresseCompte);
  if (u) uid = u.id;
  if (!data || data.users.length < 1000) break;
}
if (!uid) { console.log(`aucun compte à ${adresseCompte} : rien n'est fait.`); process.exit(1); }
const r = await ouvrirAccesAlInscription(uid, adresseVente);
console.log(JSON.stringify(r));
const { data: abo } = await sb.from('subscriptions').select('plan, status, expires_at, chariow_sale_id, provider').eq('user_id', uid);
console.log('abonnements du compte :', JSON.stringify(abo));
