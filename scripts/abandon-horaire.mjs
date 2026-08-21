/** Le taux d abandon heure par heure, autour du deploiement. LECTURE SEULE. */
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const entete={Authorization:`Bearer ${env.CHARIOW_API_KEY}`,Accept:'application/json'};
const ventes=[];let url='https://api.chariow.com/v1/sales?per_page=100';
for(let g=0;g<10&&url;g++){const r=await fetch(url,{headers:entete});if(!r.ok)break;const j=await r.json();ventes.push(...(j?.data??[]));url=j?.pagination?.next_page_url??null;}

const auj=ventes.filter(v=>String(v.created_at).slice(0,10)==='2026-08-20');
const parH=new Map();
for(const v of auj){const h=String(v.created_at).slice(11,13);const a=parH.get(h)??{completed:0,abandoned:0,failed:0,autre:0};
  if(v.status==='completed'||v.status==='settled')a.completed++;else if(v.status==='abandoned')a.abandoned++;else if(v.status==='failed')a.failed++;else a.autre++;parH.set(h,a);}

console.log(`\n  ══ AUJOURD HUI, HEURE PAR HEURE ══\n`);
console.log(`  heure   payes  abandons  echecs   taux de reussite`);
console.log('  '+'-'.repeat(52));
let avantP=0,avantT=0,apresP=0,apresT=0;
for(const [h,a] of [...parH].sort()){
  const total=a.completed+a.abandoned+a.failed+a.autre;
  const taux=total?((100*a.completed)/total).toFixed(0):'0';
  // La correction du pays a ete deployee vers 21h TU
  if(Number(h)<21){avantP+=a.completed;avantT+=total;}else{apresP+=a.completed;apresT+=total;}
  console.log(`  ${h}h ${String(a.completed).padStart(7)} ${String(a.abandoned).padStart(9)} ${String(a.failed).padStart(7)}   ${(taux+' %').padStart(6)}${Number(h)===21?'   <- correction du pays deployee':''}`);
}
console.log(`\n  AVANT 21h : ${avantP}/${avantT} payes  =  ${avantT?((100*avantP)/avantT).toFixed(1):'—'} %`);
console.log(`  APRES 21h : ${apresP}/${apresT} payes  =  ${apresT?((100*apresP)/apresT).toFixed(1):'—'} %`);

// Les echecs : que disent-ils ?
const echecs=auj.filter(v=>v.status==='failed');
console.log(`\n  ══ LES ${echecs.length} ECHECS D AUJOURD HUI ══\n`);
const devises=new Map(), pays=new Map();
for(const v of echecs){
  const d=v.payment_currency??v.currency??'?';devises.set(d,(devises.get(d)??0)+1);
  const p=v.customer_country??v.country??'?';pays.set(p,(pays.get(p)??0)+1);
}
console.log(`  par devise :`,[...devises].map(([d,n])=>`${d}=${n}`).join('  '));
console.log(`  par pays   :`,[...pays].map(([p,n])=>`${p}=${n}`).join('  '));
console.log('');
