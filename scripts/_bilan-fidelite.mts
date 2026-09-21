// LECTURE SEULE : est-ce que ceux qui paient reviennent ?
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
async function toutes(table: string, colonnes: string, ordre = 'created_at') {
  const out: any[] = [];
  for (let de = 0; de < 400_000; de += 1000) {
    const { data, error } = await sb.from(table).select(colonnes).order(ordre).range(de, de + 999);
    if (error) throw new Error(`${table} : ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '—');
const ventes = (await toutes('payment_intents', 'sale_id, email, amount, plan, created_at, statut_boutique'))
  .filter((v) => ['completed', 'settled'].includes(String(v.statut_boutique)) && !/test|verif|diagnostic|e2e/i.test(String(v.sale_id)));
const abos = await toutes('subscriptions', 'user_id, plan, status, created_at, expires_at, provider');
const histo = await toutes('analysis_history', 'user_id, created_at');
const MAINTENANT = Date.now();
const J = 86400000;

// 1. Les ventes, jour par jour, sur 21 jours
console.log('── VENTES ENCAISSÉES, 1er → 21 septembre');
let totalSept = 0, caSept = 0;
const parJour = new Map<string, { n: number; ca: number }>();
for (const v of ventes) {
  const j = String(v.created_at).slice(0, 10);
  if (j < '2026-09-01') continue;
  const c = parJour.get(j) ?? { n: 0, ca: 0 };
  c.n++; c.ca += Number(v.amount ?? 0);
  parJour.set(j, c);
  totalSept++; caSept += Number(v.amount ?? 0);
}
console.log('   ' + [...parJour].sort().map(([j, c]) => `${j.slice(8)}:${c.n}`).join(' '));
console.log(`   total : ${totalSept} ventes · ${caSept.toLocaleString('fr-FR')} F · ${(totalSept / parJour.size).toFixed(1)} par jour`);

// 2. Le réachat : par adresse
const parMail = new Map<string, any[]>();
for (const v of ventes) {
  const m = String(v.email ?? '').toLowerCase().trim();
  if (!m) continue;
  parMail.set(m, [...(parMail.get(m) ?? []), v]);
}
const acheteurs = [...parMail.values()];
const deuxFois = acheteurs.filter((l) => l.length >= 2);
console.log(`\n── RÉACHAT : ${acheteurs.length} acheteurs distincts (${ventes.length} ventes)`);
console.log(`   ont acheté 2 fois ou plus : ${deuxFois.length} (${pc(deuxFois.length, acheteurs.length)})`);
// Ceux dont le premier achat mensuel a plus de 30 jours : ont-ils repris ?
const murs = acheteurs.filter((l) => MAINTENANT - Date.parse(l[0].created_at) > 32 * J);
const repris = murs.filter((l) => l.length >= 2);
console.log(`   parmi ceux dont le 1er achat a plus d'un mois : ${murs.length} · ont repris : ${repris.length} (${pc(repris.length, murs.length)})`);

// 3. L'usage pendant l'abonnement
const joursActifs = new Map<string, Set<string>>();
for (const h of histo) {
  const u = String(h.user_id);
  if (!joursActifs.has(u)) joursActifs.set(u, new Set());
  joursActifs.get(u)!.add(String(h.created_at).slice(0, 10));
}
const payants = abos.filter((a) => a.provider !== 'banc-essai' && a.plan !== 'lifetime');
const usage = payants.map((a) => {
  const debut = String(a.created_at).slice(0, 10);
  const fin = String(a.expires_at ?? '').slice(0, 10) || '9999';
  const jours = [...(joursActifs.get(String(a.user_id)) ?? [])].filter((j) => j >= debut && j <= fin).length;
  return { jours, fini: Date.parse(String(a.expires_at)) < MAINTENANT };
});
const finis = usage.filter((u) => u.fini);
const tranche = (l: any[], f: (u: any) => boolean) => pc(l.filter(f).length, l.length);
console.log(`\n── USAGE PENDANT L'ABONNEMENT (${finis.length} abonnements terminés)`);
console.log(`   jamais utilisé : ${tranche(finis, (u) => u.jours === 0)} · 1 seul jour : ${tranche(finis, (u) => u.jours === 1)} · 2 à 4 jours : ${tranche(finis, (u) => u.jours >= 2 && u.jours <= 4)} · 5 jours et + : ${tranche(finis, (u) => u.jours >= 5)}`);
const moy = finis.reduce((s, u) => s + u.jours, 0) / (finis.length || 1);
console.log(`   jours d'usage moyens sur un abonnement : ${moy.toFixed(1)}`);

// 4. L'usage prédit-il le réachat ?
const userParMail = new Map<string, string>();
const aboParUser = new Map<string, any[]>();
for (const a of payants) aboParUser.set(String(a.user_id), [...(aboParUser.get(String(a.user_id)) ?? []), a]);
const lots: Record<string, { n: number; repris: number }> = {};
for (const [u, liste] of aboParUser) {
  const tri = liste.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const premier = tri[0];
  if (Date.parse(String(premier.expires_at)) > MAINTENANT) continue; // pas encore fini
  const jours = [...(joursActifs.get(u) ?? [])].filter(
    (j) => j >= String(premier.created_at).slice(0, 10) && j <= String(premier.expires_at).slice(0, 10)
  ).length;
  const k = jours === 0 ? 'a. 0 jour' : jours <= 2 ? 'b. 1-2 jours' : jours <= 6 ? 'c. 3-6 jours' : 'd. 7 jours et +';
  lots[k] ??= { n: 0, repris: 0 };
  lots[k].n++;
  if (tri.length >= 2) lots[k].repris++;
}
console.log('\n── L\'USAGE DU PREMIER MOIS PRÉDIT-IL LE RÉACHAT ?');
for (const k of Object.keys(lots).sort()) console.log(`   ${k.padEnd(18)} ${String(lots[k].n).padStart(4)} abonnés · ont repris ${pc(lots[k].repris, lots[k].n)}`);
