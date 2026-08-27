import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const dernier = async (table, colonne) => {
  const { data } = await sb.from(table).select(colonne).order(colonne, { ascending: false }).limit(1);
  return data?.[0]?.[colonne] ?? null;
};

const maintenant = Date.now();
const ilYA = (d) => {
  if (!d) return '—';
  const h = (maintenant - Date.parse(d)) / 3600000;
  return h < 1 ? Math.round(h * 60) + ' min' : Math.round(h * 10) / 10 + ' h';
};

console.log('\n  ══ DERNIER SIGNE DE VIE, PAR SOURCE ══\n');
const v = await dernier('visites_pages', 'entre_le');
const a = await dernier('analysis_history', 'created_at');
const s = await dernier('subscriptions', 'created_at');
console.log(`  Derniere visite enregistree ....... ${String(v).slice(0, 16).replace('T', ' a ')}   il y a ${ilYA(v)}`);
console.log(`  Derniere analyse lancee ........... ${String(a).slice(0, 16).replace('T', ' a ')}   il y a ${ilYA(a)}`);
console.log(`  Dernier abonnement enregistre ..... ${String(s).slice(0, 16).replace('T', ' a ')}   il y a ${ilYA(s)}`);

// Le trafic heure par heure, pour voir l heure exacte de la coupure.
const depuis = new Date(maintenant - 48 * 3600000).toISOString();
const tout = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('visites_pages').select('entre_le').gte('entre_le', depuis).range(de, de + 999);
  if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
}
const parHeure = new Map();
for (const x of tout) {
  const h = String(x.entre_le).slice(0, 13);
  parHeure.set(h, (parHeure.get(h) ?? 0) + 1);
}
console.log('\n  ══ TRAFIC HEURE PAR HEURE (48 h) ══\n');
const heures = [...parHeure].sort();
for (const [h, n] of heures.slice(-24)) {
  console.log(`  ${h.replace('T', ' a ')} h   ${String(n).padStart(4)}  ${'█'.repeat(Math.min(50, Math.round(n / 8)))}`);
}
console.log('');
