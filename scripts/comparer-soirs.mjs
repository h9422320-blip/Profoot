/** Le soir d hier contre le soir d aujourd hui, heure par heure. LECTURE SEULE. */
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const entete={Authorization:`Bearer ${env.CHARIOW_API_KEY}`,Accept:'application/json'};
const ventes=[];let url='https://api.chariow.com/v1/sales?per_page=100';
for(let g=0;g<12&&url;g++){const r=await fetch(url,{headers:entete});if(!r.ok)break;const j=await r.json();ventes.push(...(j?.data??[]));url=j?.pagination?.next_page_url??null;}
const paye=v=>v.status==='completed'||v.status==='settled';
console.log(`\n  ══ LE SOIR, HIER CONTRE AUJOURD HUI (heures UTC) ══\n`);
console.log(`  heure    19 aout            20 aout`);
console.log(`           tentatives payes   tentatives payes`);
console.log('  '+'-'.repeat(50));
for(const h of ['17','18','19','20','21','22','23']){
  const a=ventes.filter(v=>String(v.created_at).slice(0,10)==='2026-08-19'&&String(v.created_at).slice(11,13)===h);
  const b=ventes.filter(v=>String(v.created_at).slice(0,10)==='2026-08-20'&&String(v.created_at).slice(11,13)===h);
  console.log(`  ${h}h ${String(a.length).padStart(11)} ${String(a.filter(paye).length).padStart(6)}   ${String(b.length).padStart(10)} ${String(b.filter(paye).length).padStart(6)}`);
}
const s19=ventes.filter(v=>String(v.created_at).slice(0,10)==='2026-08-19'&&Number(String(v.created_at).slice(11,13))>=19);
const s20=ventes.filter(v=>String(v.created_at).slice(0,10)==='2026-08-20'&&Number(String(v.created_at).slice(11,13))>=19);
console.log(`\n  A partir de 19h :`);
console.log(`     19 aout : ${s19.length} tentative(s), ${s19.filter(paye).length} paye(s)`);
console.log(`     20 aout : ${s20.length} tentative(s), ${s20.filter(paye).length} paye(s)`);
console.log('');
