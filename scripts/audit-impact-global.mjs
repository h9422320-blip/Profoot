import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CATALOGUE = { essential_monthly: 2000, pro_monthly: 5000, vip_yearly: 15000 };
const TAUX = { XOF: 1, EUR: 655.957, USD: 600 };

const tout = [];
for (let de = 0; de < 20000; de += 1000) {
  const { data } = await sb.from('subscriptions').select('*').order('created_at').range(de, de + 999);
  if (!data?.length) break;
  tout.push(...data);
  if (data.length < 1000) break;
}
console.log(`\n  ${tout.length} abonnement(s) au total.\n`);

const compter = (cle, f) => {
  const m = new Map();
  for (const a of tout) { const k = String(f(a) ?? 'null'); m.set(k, (m.get(k) ?? 0) + 1); }
  console.log(`  ${cle} : ${[...m].map(([k, v]) => `${k}=${v}`).join('  ')}`);
};
compter('statut', (a) => a.status);
compter('fournisseur', (a) => a.provider);
compter('devise', (a) => a.currency);
console.log(`  sans vente Chariow ET sans Moneroo : ${tout.filter((a) => !a.chariow_sale_id && !a.moneroo_payment_id).length}`);
console.log(`  montant nul ou absent             : ${tout.filter((a) => !Number(a.amount)).length}`);
const sales = tout.map((a) => a.chariow_sale_id).filter(Boolean);
console.log(`  ventes Chariow en double          : ${sales.length - new Set(sales).size}`);

console.log(`\n  ══ MOIS PAR MOIS : CATALOGUE (aujourd'hui) vs RÉEL ══\n`);
const parMois = new Map();
for (const a of tout) {
  const mois = String(a.created_at).slice(0, 7);
  const p = parMois.get(mois) ?? { cat: 0, reel: 0, n: 0, offerts: 0 };
  p.cat += CATALOGUE[a.plan] ?? 0;
  p.n++;
  const paye = a.chariow_sale_id || a.moneroo_payment_id;
  if (paye) p.reel += Math.round(Number(a.amount ?? 0) * (TAUX[a.currency ?? 'XOF'] ?? 0));
  else p.offerts++;
  parMois.set(mois, p);
}
console.log(`  mois      abos  offerts   CATALOGUE       RÉEL      écart`);
for (const [m, p] of [...parMois].sort())
  console.log(`  ${m}  ${String(p.n).padStart(5)}  ${String(p.offerts).padStart(6)}  ${String(p.cat).padStart(10)} ${String(p.reel).padStart(10)} ${String(p.reel - p.cat).padStart(10)}`);
console.log('');
