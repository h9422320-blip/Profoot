import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('analysis_history').select('analysis_data').order('created_at',{ascending:false}).limit(120);
// Tout chemin menant a une chaine LONGUE (de la prose, pas un identifiant).
const chemins = new Map();
const voir = (n, c) => {
  if (typeof n === 'string') {
    const k = c || '(racine)';
    const a = chemins.get(k) ?? { n: 0, max: 0, exemple: '' };
    a.n++; if (n.length > a.max) { a.max = n.length; a.exemple = n.slice(0, 70); }
    chemins.set(k, a);
  } else if (Array.isArray(n)) n.forEach(v => voir(v, `${c}[]`));
  else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) voir(v, c ? `${c}.${k}` : k);
};
for (const d of data ?? []) voir(d.analysis_data, '');
console.log('\n  CHAMPS TEXTE, tries par longueur maximale :\n');
for (const [c, a] of [...chemins.entries()].sort((x,y)=>y[1].max-x[1].max).slice(0,26))
  console.log(`   ${String(a.max).padStart(5)} car.  ${c.padEnd(34)} « ${a.exemple}… »`);
