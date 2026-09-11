/** Bloque l acces d un client rembourse : abonnement annule (rien n est efface), trace, verification. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { computeEntitlements } = await import('../src/lib/subscription.js');
const sb = createAdminClient();
const USER = '14be8cc1-38c5-4919-b98e-3b3b31e00282';
const ABO = 'b61a3a45-0809-400a-bb8d-7cbdca1e92bd';
const { data: avant } = await sb.from('subscriptions').select('id, user_id, status').eq('id', ABO).maybeSingle();
if (!avant || avant.user_id !== USER) { console.log('abonnement introuvable ou autre titulaire — rien fait'); process.exit(1); }
const { error } = await sb.from('subscriptions').update({ status: 'cancelled' }).eq('id', ABO);
console.log(`abonnement ${ABO} : ${error ? 'ECHEC ' + error.message : 'statut ' + avant.status + ' -> cancelled'}`);
await sb.from('webhook_events').insert({
  provider: 'manuel',
  delivery_id: `blocage-remboursement-${ABO}`,
  event: 'acces_bloque_remboursement',
  payload: { email: 'assiroger2007@gmail.com', user_id: USER, abonnement: ABO, vente: '01cdbf0f-32fc-41dc-8094-0bab303bfa36', analyses_utilisees: 16, sur: 30, motif: 'remboursement demande, acces bloque sur decision du proprietaire le 2026-09-11', reversible: 'remettre status=active' },
});
const { data } = await sb.auth.admin.getUserById(USER);
const droits = await computeEntitlements(sb as any, data.user as any);
console.log(`droits apres blocage : ${droits.plan}, premium=${droits.premium}, limite=${droits.analysisLimit}`);
