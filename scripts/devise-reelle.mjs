/** En quelle devise les clients ont-ils reellement du payer ? LECTURE SEULE. */
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const entete={Authorization:`Bearer ${env.CHARIOW_API_KEY}`,Accept:'application/json'};
const ventes=[];let url='https://api.chariow.com/v1/sales?per_page=100';
for(let g=0;g<12&&url;g++){const r=await fetch(url,{headers:entete});if(!r.ok)break;const j=await r.json();ventes.push(...(j?.data??[]));url=j?.pagination?.next_page_url??null;}
const dev=v=>v?.payment?.amount?.currency ?? v?.amount?.currency ?? '?';
const paye=v=>v.status==='completed'||v.status==='settled';

console.log(`\n  ══ DEVISE REELLEMENT DEMANDEE AU CLIENT ══\n`);
console.log(`  ${'periode'.padEnd(34)} ${'XOF'.padStart(5)} ${'EUR'.padStart(5)} ${'USD'.padStart(5)}  ${'payes'.padStart(6)}`);
console.log('  '+'-'.repeat(64));
const tranches=[
  ['19 aout (journee)', v=>String(v.created_at).slice(0,10)==='2026-08-19'],
  ['20 aout AVANT 20h46 (bug pays)', v=>String(v.created_at).slice(0,10)==='2026-08-20'&&v.created_at<'2026-08-20T20:46'],
  ['20 aout APRES 20h46 (corrige)', v=>String(v.created_at).slice(0,10)==='2026-08-20'&&v.created_at>='2026-08-20T20:46'],
];
for(const [nom,f] of tranches){
  const l=ventes.filter(f);
  const c=d=>l.filter(v=>dev(v)===d).length;
  console.log(`  ${nom.padEnd(34)} ${String(c('XOF')).padStart(5)} ${String(c('EUR')).padStart(5)} ${String(c('USD')).padStart(5)}  ${String(l.filter(paye).length).padStart(6)}`);
}
console.log(`\n  ══ TAUX DE REUSSITE SELON LA DEVISE (tout l historique) ══\n`);
for(const d of ['XOF','EUR','USD','GBP']){
  const l=ventes.filter(v=>dev(v)===d);
  if(!l.length) continue;
  console.log(`  ${d} : ${String(l.filter(paye).length).padStart(3)}/${String(l.length).padStart(3)} payes  =  ${((100*l.filter(paye).length)/l.length).toFixed(1)} %`);
}
console.log('');
