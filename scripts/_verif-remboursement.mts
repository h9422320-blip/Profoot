/** Avant un remboursement : compte, abonnements, paiement, consommation exacte. Lecture seule. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { computeEntitlements } = await import('../src/lib/subscription.js');
const { getQuotaState } = await import('../src/lib/analysis-quota.js');
const sb = createAdminClient();
const email = String(process.argv[2] ?? '').trim().toLowerCase();
let u: any = null;
for (let page = 1; page <= 200 && !u; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('ERREUR ' + error.message); process.exit(1); }
  u = (data?.users ?? []).find((x: any) => String(x.email ?? '').toLowerCase() === email) ?? null;
  if ((data?.users ?? []).length < 1000) break;
}
const { data: pis } = await sb.from('payment_intents').select('sale_id, amount, plan, statut_boutique, created_at, consumed_at, moyen_paiement').eq('email', email);
console.log(`=== ${email}`);
console.log(`paiements : ${JSON.stringify(pis ?? [])}`);
if (!u) { console.log('AUCUN COMPTE'); process.exit(0); }
console.log(`compte ${u.id} — inscrit ${String(u.created_at).slice(0, 16)}, derniere connexion ${String(u.last_sign_in_at ?? 'jamais').slice(0, 16)}`);
const { data: subs } = await sb.from('subscriptions').select('*').eq('user_id', u.id).order('created_at');
for (const s of subs ?? [])
  console.log(`abonnement ${s.id} : ${s.plan} ${s.amount ?? '?'} F, statut=${s.status}, cree ${String(s.created_at).slice(0, 16)}, expire ${String(s.expires_at).slice(0, 10)}, vente ${s.chariow_sale_id ?? '—'}`);
const droits = await computeEntitlements(sb as any, u as any);
const q = await getQuotaState(u.id, droits);
console.log(`droits : ${droits.plan}, premium=${droits.premium}, limite=${droits.analysisLimit}`);
console.log(`QUOTA (calcul de l application) : ${q.used} utilisee(s) sur ${q.limit} — reste ${q.remaining}`);
const { data: us } = await sb.from('analysis_usage').select('created_at, match_key, period_start').eq('user_id', u.id).order('created_at');
console.log(`${us?.length ?? 0} analyse(s) decomptee(s) en tout :`);
for (const x of us ?? []) console.log(`  ${String(x.created_at).slice(0, 16)}  ${x.match_key}`);
