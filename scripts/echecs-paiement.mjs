/** Que disent vraiment les ventes echouees et abandonnees ? LECTURE SEULE. */
import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const entete={Authorization:`Bearer ${env.CHARIOW_API_KEY}`,Accept:'application/json'};
const ventes=[];let url='https://api.chariow.com/v1/sales?per_page=100';
for(let g=0;g<12&&url;g++){const r=await fetch(url,{headers:entete});if(!r.ok)break;const j=await r.json();ventes.push(...(j?.data??[]));url=j?.pagination?.next_page_url??null;}
const auj=ventes.filter(v=>String(v.created_at).slice(0,10)==='2026-08-20');
const un=auj.find(v=>v.status==='failed');
console.log(`\n  ══ STRUCTURE D UNE VENTE ECHOUEE ══\n`);
console.log(JSON.stringify(un,null,2).slice(0,1400));
console.log(`\n  ══ REPARTITION PAR DEVISE ET PAYS (tous statuts, aujourd hui) ══\n`);
const cle=(v,ch)=>{for(const c of ch){const x=c.split('.').reduce((o,k)=>o?.[k],v);if(x)return String(x);}return '?';};
const grouper=(liste,champs)=>{const m=new Map();for(const v of liste)m.set(cle(v,champs),(m.get(cle(v,champs))??0)+1);return [...m].sort((a,b)=>b[1]-a[1]);};
for(const [nom,statuts] of [['PAYES',['completed','settled']],['ABANDONNES',['abandoned']],['ECHOUES',['failed']]]){
  const l=auj.filter(v=>statuts.includes(v.status));
  console.log(`  ${nom} (${l.length})`);
  console.log(`     devise :`,grouper(l,['payment_currency','currency','amount.currency']).map(([d,n])=>`${d}=${n}`).join('  '));
  console.log(`     pays   :`,grouper(l,['customer_country','country','customer.country']).map(([p,n])=>`${p}=${n}`).join('  '));
  console.log(`     moyen  :`,grouper(l,['payment_method','payment_provider','provider']).map(([p,n])=>`${p}=${n}`).join('  '));
  console.log('');
}
