/**
 * NOS VENTES DU JOUR, À COMPARER À CELLES DE LA BOUTIQUE. LECTURE SEULE.
 *
 * Sert à répondre à une question précise : ce qu'un client dit avoir payé
 * est-il arrivé ? Le tableau de bord de la boutique donne ses propres
 * chiffres ; si les deux colonnes concordent à la vente près, la chaîne
 * boutique → application est saine et la perte est EN AMONT, entre la
 * passerelle de paiement et la boutique.
 *
 * Le 5 septembre 2026, ce recoupement a tranché un litige à 15 300 FCFA :
 * quatorze Essentiel et un Pro des deux côtés, aucune vente VIP nulle part,
 * alors que le client produisait deux SMS de paiement. L'argent n'avait
 * jamais atteint la boutique.
 *
 * Les ouvertures manuelles (référence préfixée) sont écartées du décompte :
 * elles ne viennent pas de la boutique et fausseraient la comparaison.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: s } = await sb.from('subscriptions').select('plan,amount,created_at,chariow_sale_id').gte('created_at', '2026-09-05T00:00').order('created_at');
const vrais = (s ?? []).filter((x) => !String(x.chariow_sale_id).startsWith('paydunya-'));
const parPlan = new Map();
for (const x of vrais) parPlan.set(x.plan, (parPlan.get(x.plan) ?? 0) + 1);

console.log('CE QUE NOUS AVONS REÇU AUJOURD’HUI (hors ouverture manuelle) :');
for (const [p, n] of parPlan) console.log(`   ${p.padEnd(20)} ${n} vente(s)   ${(100*n/vrais.length).toFixed(0)} %`);
console.log(`   TOTAL : ${vrais.length}`);
console.log('\nCE QUE LE PROPRIÉTAIRE LIT DANS MAKETOU :');
console.log('   Accès Essentiel (30 j)   14 ventes   93 %');
console.log('   Accès Pro (30 j)          1 vente     7 %');
console.log('   Accès VIP (1 an)          AUCUNE');
console.log(`\n   → ${vrais.length === 15 ? 'LES DEUX CONCORDENT' : 'ÉCART : ' + vrais.length + ' chez nous contre 15 chez eux'}`);

console.log('\nL’OUVERTURE MANUELLE QUE J’AI FAITE :');
const manuel = (s ?? []).filter((x) => String(x.chariow_sale_id).startsWith('paydunya-'));
for (const x of manuel) console.log(`   ${x.plan}  ${x.amount} F  réf ${x.chariow_sale_id}  posée à ${String(x.created_at).slice(11,16)}`);
