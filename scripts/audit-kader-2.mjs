/** DIAGNOSTIC — d ou viennent les recettes affichees. LECTURE SEULE. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: tout, error, count } = await sb
  .from('subscriptions')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(400);

if (error) { console.log('subscriptions illisible :', error.message); }
else {
  console.log(`\n  subscriptions : ${count} ligne(s) au total\n`);
  if (tout?.length) {
    console.log('  Colonnes :', Object.keys(tout[0]).join(', '));
    console.log('\n  10 plus recentes :');
    for (const s of tout.slice(0, 10))
      console.log(`     ${String(s.created_at).slice(0, 19)}  plan=${s.plan}  ${s.email ?? ''}`);

    // Repartition par mois
    const parMois = new Map();
    for (const s of tout) {
      const m = String(s.created_at).slice(0, 7);
      parMois.set(m, (parMois.get(m) ?? 0) + 1);
    }
    console.log('\n  Par mois :');
    for (const [m, n] of [...parMois].sort().reverse()) console.log(`     ${m} : ${n}`);

    // Les plans distincts, pour verifier la correspondance avec PLANS
    const plans = new Map();
    for (const s of tout) plans.set(s.plan, (plans.get(s.plan) ?? 0) + 1);
    console.log('\n  Valeurs de "plan" rencontrees :');
    for (const [p, n] of plans) console.log(`     "${p}" : ${n}`);
  }
}

// Comparaison avec payment_intents, la source des paiements reels
const { data: intents, count: nbIntents } = await sb
  .from('payment_intents')
  .select('amount, created_at, consumed_at, plan', { count: 'exact' })
  .gte('created_at', '2026-08-01')
  .order('created_at', { ascending: false });

const payes = (intents ?? []).filter((i) => i.consumed_at);
const total = payes.reduce((t, i) => t + Number(i.amount ?? 0), 0);
console.log(`\n  payment_intents depuis le 1er aout : ${nbIntents} ligne(s), dont ${payes.length} payee(s)`);
console.log(`  Montant encaisse (brut catalogue)  : ${total.toLocaleString('fr-FR')} FCFA`);

const depuis16 = payes.filter((i) => new Date(i.created_at) >= new Date('2026-08-16T00:00:00Z'));
const total16 = depuis16.reduce((t, i) => t + Number(i.amount ?? 0), 0);
console.log(`  Dont a partir du 16 aout           : ${depuis16.length} vente(s) = ${total16.toLocaleString('fr-FR')} FCFA`);
console.log(`  35 % de ce montant                 : ${Math.round(total16 * 0.35).toLocaleString('fr-FR')} FCFA\n`);
