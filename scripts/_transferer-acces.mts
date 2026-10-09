/**
 * DÉPLACER UN ACCÈS PAYÉ VERS LE COMPTE QUE LA PERSONNE UTILISE VRAIMENT.
 *
 * ── POURQUOI CET OUTIL EXISTE ─────────────────────────────────────────────
 *
 * L'accès est attaché à l'ADRESSE saisie à la boutique. Quand l'acheteur tape
 * une adresse qu'il n'utilise pas — une seconde boîte, une faute de frappe —
 * il paie, l'accès s'ouvre, et il ne le voit jamais : il se connecte ailleurs
 * et tombe sur le mur de paiement.
 *
 * Du dehors, c'est indiscernable d'une escroquerie. Le 9 octobre 2026, un
 * abonné VIP a payé 15 000 FCFA avec `…59@gmail.com`, s'est connecté avec
 * `…392@gmail.com`, n'a vu que 15 % de son analyse, et a porté plainte à la
 * boutique en demandant un remboursement. Son accès existait depuis la veille,
 * sur l'autre adresse, et personne ne pouvait le deviner.
 *
 * ── CE QUE CE SCRIPT FAIT, ET CE QU'IL NE FAIT PAS ────────────────────────
 *
 * Il DÉPLACE : l'abonnement change de compte, il ne se duplique pas. Un
 * paiement, un accès. Le compte d'origine n'en garde aucun — sans quoi deux
 * personnes pourraient se partager une seule facture.
 *
 * Il ne crée JAMAIS de compte : les deux doivent déjà exister. Créer un compte
 * à la place de quelqu'un, c'est deviner son mot de passe et son adresse, et
 * c'est une règle que le propriétaire a posée.
 *
 * Il relie aussi la VENTE au nouveau compte : sans ça, la prochaine relecture
 * des paiements rouvrirait l'accès sur l'ancien.
 *
 *   npx tsx scripts/_transferer-acces.mts de@adresse vers@adresse
 *   npx tsx scripts/_transferer-acces.mts de@adresse vers@adresse --ecrire
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ecrire = process.argv.includes('--ecrire');
const [deAdr, versAdr] = args.map((a) => String(a ?? '').trim().toLowerCase());

function arreter(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

if (!deAdr || !versAdr) arreter('Il faut deux adresses : celle qui a payé, puis celle qui se connecte.');
if (deAdr === versAdr) arreter('Les deux adresses sont la même.');

const comptes: any[] = [];
for (let page = 1; page <= 80; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  const l = data?.users ?? [];
  comptes.push(...l);
  if (l.length < 200) break;
}
const trouver = (adr: string) => comptes.find((u: any) => String(u.email ?? '').toLowerCase() === adr);
const de = trouver(deAdr);
const vers = trouver(versAdr);
if (!de) arreter(`Aucun compte pour « ${deAdr} ». Ce script ne crée jamais de compte.`);
if (!vers) arreter(`Aucun compte pour « ${versAdr} ». Ce script ne crée jamais de compte.`);

const etat = async (u: any, titre: string) => {
  const { data: ab } = await sb.from('subscriptions').select('*').eq('user_id', u.id).order('created_at', { ascending: false });
  const { count } = await sb.from('analysis_history').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
  console.log(`${titre} ${u.email}`);
  console.log(`   compte ${u.id} | dernière connexion ${String(u.last_sign_in_at ?? 'JAMAIS').slice(0, 16)} | ${count} analyse(s)`);
  for (const a of ab ?? [])
    console.log(`   · ${a.plan} ${a.status} ${a.amount} ${a.currency} | du ${String(a.created_at).slice(0, 10)} au ${String(a.expires_at ?? '—').slice(0, 10)} | vente ${a.chariow_sale_id ?? '—'}`);
  if (!(ab ?? []).length) console.log('   · aucun abonnement');
  return ab ?? [];
};

console.log('');
const abDe = await etat(de, 'A PAYÉ   :');
console.log('');
await etat(vers, 'UTILISE  :');

const actifs = abDe.filter((a: any) => a.status === 'active');
if (!actifs.length) arreter(`« ${deAdr} » n'a aucun abonnement actif à déplacer.`);

console.log(`\n→ ${actifs.length} abonnement(s) actif(s) à déplacer vers ${versAdr}.`);
if (!ecrire) {
  console.log('\n(RIEN ÉCRIT — ajouter --ecrire)');
} else {
  for (const a of actifs) {
    const { error } = await sb.from('subscriptions').update({ user_id: vers.id }).eq('id', a.id);
    if (error) arreter(`déplacement de l'abonnement ${a.id} impossible : ${error.message}`);
    // La vente suit l'abonnement : sinon la prochaine relecture des paiements
    // rouvrirait l'accès sur l'ancien compte.
    if (a.chariow_sale_id) {
      const { error: e2 } = await sb.from('payment_intents').update({ user_id: vers.id }).eq('sale_id', a.chariow_sale_id);
      if (e2) console.warn(`   ⚠ vente ${a.chariow_sale_id} non reliée : ${e2.message}`);
    }
    console.log(`   ✔ ${a.plan} déplacé`);
  }

  // La relecture : sans elle, on ne sait pas.
  console.log('');
  const resteDe = await etat(de, 'APRÈS — a payé  :');
  console.log('');
  const aVers = await etat(vers, 'APRÈS — utilise :');
  const ok = !resteDe.some((a: any) => a.status === 'active') && aVers.some((a: any) => a.status === 'active');
  console.log(ok ? "\n✔ Transfert vérifié : un seul accès, sur le compte utilisé." : "\n✖ État inattendu après transfert — à regarder à la main.");
  if (!ok) process.exitCode = 1;
}
