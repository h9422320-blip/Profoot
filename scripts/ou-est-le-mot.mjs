import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(),'src') } });
const { motsInterdits } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const { data } = await sb.from('analysis_history').select('id, created_at, analysis_data').order('created_at',{ascending:false}).limit(400);

// On parcourt la structure : on veut savoir si le mot est dans une VALEUR
// affichee, ou seulement dans un NOM DE CHAMP interne.
const trouvailles = new Map();   // mot -> [{chemin, extrait}]
const parcourir = (n, chemin, sortie) => {
  if (typeof n === 'string') {
    for (const m of motsInterdits(n)) {
      if (!sortie.has(m)) sortie.set(m, []);
      const i = n.toLowerCase().indexOf(String(m).toLowerCase().split(/\s+/)[0]);
      sortie.get(m).push({ chemin, extrait: n.slice(Math.max(0,i-60), i+90).replace(/\s+/g,' ') });
    }
  } else if (Array.isArray(n)) n.forEach((v,i)=>parcourir(v, `${chemin}[]`, sortie));
  else if (n && typeof n === 'object') for (const [k,v] of Object.entries(n)) parcourir(v, chemin?`${chemin}.${k}`:k, sortie);
};

let analysesTouchees = 0;
for (const a of data ?? []) {
  const sortie = new Map();
  parcourir(a.analysis_data, '', sortie);
  if (!sortie.size) continue;
  analysesTouchees++;
  for (const [mot, occ] of sortie) {
    if (!trouvailles.has(mot)) trouvailles.set(mot, []);
    trouvailles.get(mot).push(...occ.map(o=>({...o, date:String(a.created_at).slice(0,16).replace('T',' ')})));
  }
}

console.log(`\n  ${analysesTouchees} / ${data.length} analyses touchees (mot present dans une VALEUR texte).\n`);
for (const [mot, occ] of [...trouvailles.entries()].sort((a,b)=>b[1].length-a[1].length)) {
  console.log(`  ── « ${mot} » — ${occ.length} occurrence(s)`);
  const chemins = new Map();
  for (const o of occ) chemins.set(o.chemin, (chemins.get(o.chemin)??0)+1);
  for (const [c,n] of [...chemins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4)) console.log(`       champ : ${c}   (${n}×)`);
  for (const o of occ.slice(0,2)) console.log(`       « …${o.extrait}… »   ${o.date}`);
  console.log('');
}
