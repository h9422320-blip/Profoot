/**
 * TOUS LES ABONNÉS ACTIFS, PASSÉS AU CRIBLE — lecture seule.
 *
 * Pour chacun, on demande à l'APPLICATION elle-même ce qu'elle lui accorde :
 * `computeEntitlements` puis `getQuotaState`, exactement les fonctions que
 * traverse un abonné qui ouvre une analyse. Réimplémenter le calcul ici
 * mesurerait autre chose que la production — ce projet en a déjà fait les
 * frais avec un banc d'essai qui divergeait sans que rien ne le signale.
 *
 * On cherche les situations où quelqu'un a payé et ne reçoit pas :
 *
 *   PAYE_SANS_COMPTE   une vente sans compte associé
 *   PAYE_SANS_DROITS   un abonnement actif mais l'application rend FREE
 *   QUOTA_NUL          premium, mais zéro analyse autorisée
 *   PERIODE_ABSENTE    premium sans période : le décompte ne peut pas partir
 *   QUOTA_EPUISE       plus rien à consommer alors que l'abonnement court
 *   EXPIRE_BIENTOT     moins de trois jours avant l'échéance
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { computeEntitlements } = await import('../src/lib/subscription.js');
const { getQuotaState } = await import('../src/lib/analysis-quota.js');

const sb = createAdminClient();
const MAINTENANT = Date.now();

// ── TOUS LES COMPTES ────────────────────────────────────────────────────────
const comptes = new Map<string, any>();
for (let page = 1; page <= 200; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('ERREUR comptes : ' + error.message); break; }
  const lot = data?.users ?? [];
  for (const u of lot) comptes.set(u.id, u);
  if (lot.length < 1000) break;
}
console.log(`${comptes.size} comptes lus.`);

// ── TOUS LES ABONNEMENTS ────────────────────────────────────────────────────
const abos: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('*').range(de, de + 999);
  abos.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`${abos.length} abonnements lus.`);

// ── LE MÊME FILTRE QUE L'APPLICATION, AU CARACTÈRE PRÈS ────────────────────
//
// `computeEntitlements` interroge la base avec `.eq('status', 'active')`.
// Sans cette condition ici, l'audit comptait comme abonnés des comptes dont
// l'abonnement est ANNULÉ, puis s'étonnait que l'application leur rende
// « gratuit » — et signalait deux anomalies qui n'en étaient pas.
//
// Un audit qui mesure autre chose que la production rassure sur un produit
// qu'il n'a pas regardé.
const encoreValable = (s: any) =>
  s.expires_at ? new Date(s.expires_at).getTime() > MAINTENANT : s.plan === 'lifetime';

const actifs = abos.filter((s) => s.status === 'active' && encoreValable(s));

// ── ET CEUX QUE LE FILTRE ÉCARTE ALORS QU'ILS ONT PAYÉ ────────────────────
//
// Un abonnement dont l'échéance est encore devant mais dont le statut n'est
// pas « active » ne donne plus aucun droit. Si la personne a réellement payé,
// c'est exactement le cas « il a payé et il n'a rien » — il doit remonter.
const ecartesMalgreEcheance = abos.filter((s) => s.status !== 'active' && encoreValable(s));
const parUtilisateur = new Map<string, any[]>();
for (const s of actifs) {
  if (!parUtilisateur.has(s.user_id)) parUtilisateur.set(s.user_id, []);
  parUtilisateur.get(s.user_id)!.push(s);
}
console.log(`${actifs.length} abonnements ACTIFS, portés par ${parUtilisateur.size} personnes.\n`);

// ── CHACUN, TEL QUE L'APPLICATION LE VOIT ───────────────────────────────────
const anomalies: { cle: string; email: string; detail: string }[] = [];
const signaler = (cle: string, email: string, detail: string) =>
  anomalies.push({ cle, email, detail });

let examines = 0;
let sains = 0;
const repartition = new Map<string, number>();

for (const [userId, leurs] of parUtilisateur) {
  const compte = comptes.get(userId);
  const email = String(compte?.email ?? `(compte absent ${userId.slice(0, 8)})`);

  if (!compte) {
    signaler('PAYE_SANS_COMPTE', email, `${leurs.length} abonnement(s) actif(s) sans compte`);
    continue;
  }

  let droits: any;
  let quota: any;
  try {
    droits = await computeEntitlements(sb as any, compte as any);
    quota = await getQuotaState(userId, droits);
  } catch (e: any) {
    signaler('CALCUL_IMPOSSIBLE', email, e?.message ?? String(e));
    continue;
  }
  examines++;
  repartition.set(droits.plan, (repartition.get(droits.plan) ?? 0) + 1);

  const restant = quota.unlimited ? Infinity : quota.remaining;
  const joursRestants = droits.expiresAt
    ? (new Date(droits.expiresAt).getTime() - MAINTENANT) / 86400000
    : Infinity;

  let sain = true;
  if (!droits.premium) {
    signaler('PAYE_SANS_DROITS', email, `${leurs.length} abonnement(s) actif(s) : ${leurs.map((s) => s.plan).join(', ')} — l'application rend ${droits.plan}`);
    sain = false;
  } else {
    if (!quota.unlimited && droits.analysisLimit <= 0) {
      signaler('QUOTA_NUL', email, `plan ${droits.plan}, limite ${droits.analysisLimit}`);
      sain = false;
    }
    if (!quota.unlimited && !quota.periodStart) {
      signaler('PERIODE_ABSENTE', email, `plan ${droits.plan} : le décompte ne peut pas partir`);
      sain = false;
    }
    if (!quota.unlimited && droits.analysisLimit > 0 && restant <= 0) {
      signaler('QUOTA_EPUISE', email, `${quota.used}/${quota.limit} consommées, échéance dans ${joursRestants.toFixed(0)} j`);
      sain = false;
    }
    if (joursRestants < 3) {
      signaler('EXPIRE_BIENTOT', email, `${joursRestants.toFixed(1)} jour(s)`);
      sain = false;
    }
  }
  if (sain) sains++;
}

// ── LES ABONNEMENTS ÉCARTÉS DONT L'ÉCHÉANCE COURT ENCORE ───────────────────
for (const s of ecartesMalgreEcheance) {
  const compte = comptes.get(s.user_id);
  const email = String(compte?.email ?? `(compte absent ${String(s.user_id).slice(0, 8)})`);
  // Les comptes internes de vérification ne sont pas des clients.
  if (email.endsWith('@profoot-test.com') || email.endsWith('@profootai.com')) continue;
  signaler(
    'ECARTE_MALGRE_ECHEANCE',
    email,
    `${s.plan} statut « ${s.status} » mais expire le ${String(s.expires_at).slice(0, 10)} — aucun droit accordé`
  );
}

// ── LES VENTES SANS COMPTE ──────────────────────────────────────────────────
const intentions: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('*').range(de, de + 999);
  intentions.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const payeesRecentes = intentions.filter(
  (p) => p.statut_boutique === 'completed' && Date.parse(p.created_at) > MAINTENANT - 14 * 86400000
);
for (const p of payeesRecentes) {
  const compte = p.user_id ? comptes.get(p.user_id) : null;
  if (!compte) {
    signaler('VENTE_SANS_COMPTE', String(p.email ?? '?'), `${p.amount} F le ${String(p.created_at).slice(0, 10)} (${p.plan})`);
    continue;
  }
  if (!parUtilisateur.has(compte.id)) {
    signaler('VENTE_SANS_ABONNEMENT', String(compte.email), `${p.amount} F le ${String(p.created_at).slice(0, 10)} (${p.plan}) — aucun abonnement actif`);
  }
}

// ── LE VERDICT ──────────────────────────────────────────────────────────────
console.log('=== RÉPARTITION DES ABONNÉS ACTIFS ===');
for (const [plan, n] of [...repartition.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${plan}`);
console.log(`\n${sains}/${examines} abonnés sans aucune anomalie.`);

const parCle = new Map<string, typeof anomalies>();
for (const a of anomalies) {
  if (!parCle.has(a.cle)) parCle.set(a.cle, []);
  parCle.get(a.cle)!.push(a);
}
console.log(`\n=== ${anomalies.length} ANOMALIE(S) ===`);
for (const [cle, liste] of [...parCle.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n── ${cle} : ${liste.length}`);
  for (const a of liste.slice(0, 25)) console.log(`   ${a.email.padEnd(38)} ${a.detail}`);
  if (liste.length > 25) console.log(`   … et ${liste.length - 25} autre(s)`);
}
if (!anomalies.length) console.log('  aucune.');
