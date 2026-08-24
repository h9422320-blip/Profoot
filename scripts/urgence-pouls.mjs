import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const lire = async (table, colonne, heures) => {
  const tout = [];
  for (let de = 0; de < 40000; de += 1000) {
    const { data } = await sb.from(table).select(colonne)
      .gte(colonne, new Date(Date.now() - heures * 3600000).toISOString()).range(de, de + 999);
    if (!data?.length) break; tout.push(...data); if (data.length < 1000) break;
  }
  return tout;
};

const analyses = await lire('analysis_history', 'created_at', 12);
const visites = await lire('visites_pages', 'entre_le', 12);

const parHeure = new Map();
for (const a of analyses) {
  const h = String(a.created_at).slice(11, 13);
  if (!parHeure.has(h)) parHeure.set(h, { analyses: 0, visites: 0 });
  parHeure.get(h).analyses++;
}
for (const v of visites) {
  const h = String(v.entre_le).slice(11, 13);
  if (!parHeure.has(h)) parHeure.set(h, { analyses: 0, visites: 0 });
  parHeure.get(h).visites++;
}

const maintenant = new Date().toISOString();
console.log(`\n  ══ LES 12 DERNIERES HEURES (il est ${maintenant.slice(11, 16)} UTC) ══\n`);
console.log('  heure   analyses   pages vues');
console.log('  ' + '─'.repeat(40));
for (const [h, e] of [...parHeure].sort()) {
  console.log(`   ${h} h   ${String(e.analyses).padStart(8)} ${String(e.visites).padStart(12)}  ${'█'.repeat(Math.min(30, Math.round(e.analyses / 5)))}`);
}
console.log(`\n  Total : ${analyses.length} analyses, ${visites.length} pages vues sur 12 h.`);
