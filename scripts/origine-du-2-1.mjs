/**
 * LE 2-1 VIENT-IL DE LA GRILLE, OU DE LA RÈGLE QUI LA CORRIGE ?
 * Diagnostic seul.
 *
 * Pour chaque prédiction figée on connaît les buts attendus. On reconstruit la
 * grille de Poisson brute et on regarde son score le plus probable — celui que
 * le moteur annoncerait SANS la règle qui l'oblige à choisir un score dans
 * l'issue gagnante. La comparaison dit lequel des deux fabrique le 2-1.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { data } = await sb.from('predictions_match').select('buts_domicile, buts_exterieur, xg_domicile, xg_exterieur').limit(5000);

const fact=(k)=>{let r=1;for(let i=2;i<=k;i++)r*=i;return r;};
const poisson=(k,l)=>Math.exp(-l)*Math.pow(l,k)/fact(k);
const MAX=8;

const annonce=new Map(), naturel=new Map();
let identiques=0, n=0;
for(const p of data){
  const l1=Number(p.xg_domicile), l2=Number(p.xg_exterieur);
  if(!Number.isFinite(l1)||!Number.isFinite(l2)) continue;
  n++;
  let best={i:0,j:0,p:-1};
  for(let i=0;i<=MAX;i++) for(let j=0;j<=MAX;j++){
    const q=poisson(i,l1)*poisson(j,l2);
    if(q>best.p) best={i,j,p:q};
  }
  const a=`${p.buts_domicile}-${p.buts_exterieur}`;
  const b=`${best.i}-${best.j}`;
  annonce.set(a,(annonce.get(a)??0)+1);
  naturel.set(b,(naturel.get(b)??0)+1);
  if(a===b) identiques++;
}
const top=(m)=>[...m.entries()].sort((x,y)=>y[1]-x[1]).slice(0,6)
  .map(([k,v])=>`${k} ${Math.round(v/n*1000)/10}%`).join('   ');

console.log(`\n  ${n} predictions comparees.\n`);
console.log(`  SCORE ANNONCE PAR L APP ....... ${top(annonce)}`);
console.log(`  SCORE MODAL DE LA GRILLE ...... ${top(naturel)}`);
console.log(`\n  Les deux coincident dans ${Math.round(identiques/n*1000)/10} % des cas.`);
console.log(`  Scores distincts annonces : ${annonce.size}   /   modal de la grille : ${naturel.size}`);
