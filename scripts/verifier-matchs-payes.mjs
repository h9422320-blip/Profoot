import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: debloques, error } = await sb.from('matchs_debloques').select('*');
if (error) { console.log('table matchs_debloques :', error.message); process.exit(0); }
console.log(`\n  ${debloques.length} match(s) débloqué(s) en base.\n`);
for (const d of debloques)
  console.log(`  ${String(d.cree_le ?? d.created_at ?? '').slice(0,16)}  vente=${d.sale_id ?? d.chariow_sale_id ?? '—'}  ${d.equipe1_nom ?? ''} — ${d.equipe2_nom ?? ''}`);

const { data: pi } = await sb.from('payment_intents').select('*').in('sale_id',
  ['SALE' , ''].length ? [] : []);
console.log('');
// Les deux ventes de match orphelines
for (const id of process.argv.slice(2)) {
  const { data } = await sb.from('matchs_debloques').select('*').eq('sale_id', id);
  console.log(`  vente ${id} : ${data?.length ? 'DÉBLOQUÉ' : 'RIEN EN BASE'}`);
}
