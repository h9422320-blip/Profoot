/**
 * QUI A PAYÉ SANS JAMAIS VOIR SON ACCÈS ?
 *
 * ── LE CAS À TROUVER ──────────────────────────────────────────────────────
 *
 * L'accès est attaché à l'ADRESSE saisie à la boutique. Quand l'acheteur se
 * connecte avec une AUTRE adresse — seconde boîte, faute de frappe — il paie,
 * l'accès s'ouvre, et il tombe quand même sur le mur de paiement. Du dehors,
 * c'est indiscernable d'une escroquerie : le 9 octobre 2026, un abonné VIP a
 * porté plainte à la boutique pour cette raison.
 *
 * ── LE SIGNAL QUI MARCHE, ET CELUI QUI TROMPE ─────────────────────────────
 *
 * Première version de ce script : « compte qui ne s'est pas reconnecté depuis
 * l'achat ». Elle a rendu huit cas, dont SEPT faux. La raison : une session
 * reste ouverte des semaines, et `last_sign_in_at` ne bouge alors jamais. Deux
 * de ces « abandonnés » avaient 40 et 42 analyses — ils utilisaient
 * parfaitement le compte qui avait payé.
 *
 * Le seul signal qui dise où quelqu'un vit, c'est ce qu'il FAIT. On cherche
 * donc : un accès encore valable sur un compte qui n'analyse presque pas,
 * pendant qu'une adresse voisine analyse beaucoup sans aucun accès.
 *
 * ── CE QUE CE SCRIPT NE TRANCHE PAS ───────────────────────────────────────
 *
 * Deux comptes « konejoseph740 » et « konejoseph40 » peuvent être la même
 * personne… ou deux homonymes. Le script sépare donc ce qui est SÛR — même
 * identifiant, domaine mal tapé, personne ne tape « @gm » volontairement — de
 * ce qui demande une question à l'intéressé. Déplacer l'accès d'un client vers
 * le compte d'un autre serait pire que le défaut qu'on corrige.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

/** En dessous, le compte ne sert manifestement pas. */
const ANALYSES_DORMANT = 3;
/** Au-dessus, le compte voisin sert manifestement. */
const ANALYSES_VIVANT = 5;

const comptes: any[] = [];
for (let page = 1; page <= 80; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
  const l = data?.users ?? [];
  comptes.push(...l);
  if (l.length < 200) break;
}
const parId = new Map(comptes.map((u: any) => [u.id, u]));

const abos: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data } = await sb.from('subscriptions').select('user_id, plan, amount, status, created_at, expires_at')
    .eq('status', 'active').order('created_at', { ascending: false }).range(de, de + 999);
  abos.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
// Un accès expiré ne se déplace pas : il n'y a plus rien à donner.
const valables = abos.filter((a) => !a.expires_at || Date.parse(a.expires_at) > Date.now());
console.log(`${abos.length} abonnement(s) marqués actifs, dont ${valables.length} encore valables.`);

const analyses = async (id: string) =>
  (await sb.from('analysis_history').select('id', { count: 'exact', head: true }).eq('user_id', id)).count ?? 0;

/** Le nom devant l'arobase, sans les chiffres de fin. */
const noyau = (adr: string) => String(adr ?? '').toLowerCase().split('@')[0].replace(/[0-9._-]+$/g, '');
const voisins = new Map<string, any[]>();
for (const u of comptes) {
  const n = noyau(u.email);
  if (n.length < 5) continue;
  voisins.set(n, [...(voisins.get(n) ?? []), u]);
}
const avecAcces = new Set(valables.map((a) => a.user_id));

const surs: any[] = [];
const aDemander: any[] = [];
for (const a of valables) {
  const paye: any = parId.get(a.user_id);
  if (!paye) continue;
  const nPaye = await analyses(paye.id);
  if (nPaye > ANALYSES_DORMANT) continue; // ce compte sert : rien à voir

  for (const v of (voisins.get(noyau(paye.email)) ?? []).filter((x: any) => x.id !== paye.id)) {
    if (avecAcces.has(v.id)) continue;
    const nV = await analyses(v.id);
    if (nV < ANALYSES_VIVANT || nV <= nPaye) continue;
    // Même identifiant, domaine mal tapé : aucun doute possible.
    const memeIdentifiant = String(paye.email).split('@')[0] === String(v.email).split('@')[0];
    (memeIdentifiant ? surs : aDemander).push({ a, paye, v, nPaye, nV });
  }
}

const montrer = (titre: string, liste: any[]) => {
  console.log(`\n${titre} : ${liste.length}`);
  for (const s of liste) {
    console.log(`  ${s.a.plan} ${s.a.amount} F · jusqu'au ${String(s.a.expires_at).slice(0, 10)}`);
    console.log(`     a payé  ${String(s.paye.email).padEnd(34)} ${String(s.nPaye).padStart(3)} analyses`);
    console.log(`     utilise ${String(s.v.email).padEnd(34)} ${String(s.nV).padStart(3)} analyses`);
    console.log(`     → npx tsx scripts/_transferer-acces.mts ${s.paye.email} ${s.v.email} --ecrire`);
  }
};
montrer('À DÉPLACER — même identifiant, domaine mal tapé', surs);
montrer('À DEMANDER À L’INTÉRESSÉ — identifiants différents, ce peut être deux personnes', aDemander);
if (!surs.length && !aDemander.length) console.log('\nAucun accès valable ne dort sur un compte inutilisé.');
