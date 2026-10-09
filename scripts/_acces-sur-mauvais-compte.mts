/**
 * QUI A PAYÉ SANS JAMAIS VOIR SON ACCÈS ?
 *
 * Signature du défaut : un abonnement ACTIF sur un compte qui ne s'est pas
 * connecté depuis l'achat. Soit la personne est partie, soit — et c'est le cas
 * grave — elle se connecte sur une AUTRE adresse et tombe sur le mur de
 * paiement en ayant payé.
 *
 * Le second cas se reconnaît : une autre adresse, proche, qui elle est
 * vivante. C'est exactement ce qui a produit la plainte du 9 octobre 2026.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

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
console.log(`${abos.length} abonnement(s) actif(s).`);

// Le noyau d'une adresse : ce qui reste une fois les chiffres de fin retirés.
const noyau = (adr: string) => String(adr ?? '').toLowerCase().split('@')[0].replace(/[0-9._-]+$/g, '');
const vivants = new Map<string, any[]>();
for (const u of comptes) {
  if (!u.last_sign_in_at) continue;
  const n = noyau(u.email);
  if (n.length < 5) continue;
  vivants.set(n, [...(vivants.get(n) ?? []), u]);
}

const suspects: any[] = [];
for (const a of abos) {
  const u: any = parId.get(a.user_id);
  if (!u) continue;
  const vu = u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0;
  // Pas revenu depuis l'achat : l'accès n'a jamais servi.
  if (vu >= Date.parse(a.created_at)) continue;
  const freres = (vivants.get(noyau(u.email)) ?? []).filter((x: any) => x.id !== u.id);
  if (!freres.length) continue;
  const actif = freres.find((f: any) => Date.parse(f.last_sign_in_at) > Date.parse(a.created_at));
  if (!actif) continue;
  const { count } = await sb.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', actif.id).eq('status', 'active');
  if (count) continue; // l'autre compte a déjà un accès : rien à faire
  suspects.push({ a, paye: u, utilise: actif });
}

console.log(`\n${suspects.length} cas où l'accès dort sur un compte abandonné pendant qu'un compte voisin est vivant :\n`);
for (const s of suspects) {
  console.log(`  ${s.a.plan} ${s.a.amount} F du ${String(s.a.created_at).slice(0, 10)}`);
  console.log(`     a payé  : ${String(s.paye.email).padEnd(34)} vu ${String(s.paye.last_sign_in_at ?? 'JAMAIS').slice(0, 16)}`);
  console.log(`     utilise : ${String(s.utilise.email).padEnd(34)} vu ${String(s.utilise.last_sign_in_at).slice(0, 16)}`);
}
if (!suspects.length) console.log('  (aucun — le cas du 9 octobre était isolé)');
