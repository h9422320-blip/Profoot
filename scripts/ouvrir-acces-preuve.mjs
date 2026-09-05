/**
 * OUVRIR UN ACCÈS SUR PREUVE DE PAIEMENT, QUAND LA BOUTIQUE N'A RIEN TRANSMIS.
 *
 * ── LE CAS QUI A PRODUIT CE SCRIPT ────────────────────────────────────────
 *
 * 5 septembre 2026, 06 h 13. Un client règle 15 300 FCFA par Mixx Togo. Deux
 * confirmations lui parviennent : celle de son opérateur (« Vous avez payé
 * 15 300 FCFA au marchand 01531 [...] Ref: 19305059900 ») et celle de la
 * passerelle (« Votre paiement chez paydunya a été effectué avec succès »).
 * Son solde tombe à 322 francs.
 *
 * Chez nous : rien. Ni intention de paiement, ni message de la boutique, ni
 * ligne dans le journal du pulse — pourtant vingt et une autres ventes sont
 * arrivées et ont été servies dans les mêmes heures. La vente s'est perdue
 * entre la passerelle et la boutique.
 *
 * Le montant ne laisse aucun doute sur le produit : la boutique ajoute 2 % au
 * prix affiché — l'Essentiel à 2 000 arrive à 2 040, le Pro à 5 000 arrive à
 * 5 100. 15 300 est donc l'Accès VIP (1 an) à 15 000, et une autre vente VIP
 * du 3 septembre porte exactement ce montant.
 *
 * ── POURQUOI L'ACCÈS PART D'AUJOURD'HUI ET NON DE SON ÉCHÉANCE ────────────
 *
 * Le crédit habituel PROLONGE : il reporte la nouvelle échéance à la fin de
 * l'accès en cours, pour ne pas perdre de temps payé. Ici ce serait absurde —
 * ce client a épuisé ses cinquante analyses ce matin, c'est précisément
 * pourquoi il a payé, et le faire attendre le 27 septembre lui reprendrait ce
 * qu'il vient d'acheter. Le VIP étant illimité, il ne perd rien de son Pro.
 *
 *   node scripts/ouvrir-acces-preuve.mjs            (simulation)
 *   node scripts/ouvrir-acces-preuve.mjs --ecrire   (applique)
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const ECRIRE = process.argv.includes('--ecrire');
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CAS = {
  email: 'tchalaouarafate@gmail.com',
  plan: 'vip_yearly',
  montant: 15000,
  jours: 365,
  reference: 'paydunya-19305059900',
  preuve: 'Mixx Togo 15 300 FCFA le 05-09-2026 06:13, Ref 19305059900, PayDunya n7eQzmMdtzEhmCQ2hgAM',
};

let uid = null;
for (let p = 1; p <= 40; p++) {
  const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 1000 });
  const u = data.users.find((x) => String(x.email).toLowerCase() === CAS.email);
  if (u) { uid = u.id; break; }
  if (data.users.length < 1000) break;
}
if (!uid) throw new Error('compte introuvable — on n’ouvre jamais un accès sans compte.');
console.log(`compte : ${uid}`);

// Garde-fou : ne jamais ouvrir deux fois le même paiement.
const { data: deja } = await sb.from('subscriptions').select('*').eq('chariow_sale_id', CAS.reference);
if (deja?.length) { console.log('DÉJÀ OUVERT pour cette référence — rien à faire.'); process.exit(0); }

const { data: avant } = await sb.from('subscriptions').select('plan,expires_at').eq('user_id', uid);
console.log('accès actuels :');
for (const s of avant ?? []) console.log(`   ${s.plan} jusqu’au ${String(s.expires_at).slice(0, 10)}`);

const expireLe = new Date(Date.now() + CAS.jours * 86_400_000).toISOString();
console.log(`\nÀ OUVRIR : ${CAS.plan}, ${CAS.montant} F, jusqu’au ${expireLe.slice(0, 10)}`);
console.log(`référence : ${CAS.reference}`);

if (!ECRIRE) { console.log('\n(simulation — rien écrit. Relancer avec --ecrire.)'); process.exit(0); }

const { error } = await sb.from('subscriptions').upsert({
  user_id: uid, plan: CAS.plan, status: 'active', provider: 'maketou',
  chariow_sale_id: CAS.reference, amount: CAS.montant, currency: 'XOF', expires_at: expireLe,
}, { onConflict: 'chariow_sale_id', ignoreDuplicates: true });
if (error) throw new Error(error.message);

// La trace, pour que ce crédit manuel ne ressemble jamais à un accès offert.
await sb.from('webhook_events').insert({
  provider: 'reparation', delivery_id: CAS.reference,
  event: 'acces_ouvert_sur_preuve_de_paiement',
  payload: { email: CAS.email, plan: CAS.plan, montant: CAS.montant, expire_le: expireLe, preuve: CAS.preuve },
});

const { data: apres } = await sb.from('subscriptions').select('plan,expires_at').eq('user_id', uid);
console.log('\nACCÈS APRÈS OUVERTURE :');
for (const s of apres ?? []) console.log(`   ${s.plan} jusqu’au ${String(s.expires_at).slice(0, 10)}`);
