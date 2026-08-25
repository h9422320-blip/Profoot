import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const maintenant = Date.now();
const ilYA = (d) => { const m=(maintenant-Date.parse(d))/60000; return m<60?Math.round(m)+' min':Math.round(m/6)/10+' h'; };

const { data: analyses } = await sb.from('analysis_history').select('created_at, team1_name, team2_name, user_id').order('created_at',{ascending:false}).limit(12);
console.log('\n  ══ LES 12 DERNIERES ANALYSES LANCEES ══\n');
for (const a of analyses ?? []) {
  console.log('  il y a ' + String(ilYA(a.created_at)).padStart(7) + '   ' + String(a.team1_name).slice(0,20) + ' — ' + String(a.team2_name).slice(0,20));
}
const distincts = new Set((analyses??[]).map(a=>a.user_id)).size;
console.log('\n  ' + distincts + ' comptes differents parmi ces 12.');

// Le trafic de la derniere heure, minute par minute.
const depuis = new Date(maintenant - 90*60000).toISOString();
const { data: vues } = await sb.from('visites_pages').select('entre_le, chemin').gte('entre_le', depuis).order('entre_le',{ascending:true}).limit(4000);
const parQuart = new Map();
for (const v of vues ?? []) {
  const d = new Date(v.entre_le);
  const cle = d.toISOString().slice(11,14) + String(Math.floor(d.getUTCMinutes()/10)*10).padStart(2,'0');
  parQuart.set(cle, (parQuart.get(cle)??0)+1);
}
console.log('\n  ══ PAGES VUES, PAR TRANCHE DE 10 MIN (90 dernieres min) ══\n');
for (const [c,n] of [...parQuart].sort()) console.log('  ' + c.replace(':','h') + '   ' + String(n).padStart(4) + '  ' + '█'.repeat(Math.min(46, Math.round(n/3))));
console.log('\n  Total sur 90 min : ' + (vues?.length ?? 0) + ' pages vues.');
console.log('');
