/** Le tunnel de paiement, de bout en bout, jour par jour. LECTURE SEULE. */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const jour=d=>String(d).slice(0,10);

// ── 1. Ce que NOTRE cote enregistre : chaque clic sur "payer" ──────────────
const depuis=new Date(Date.now()-8*86400000).toISOString();
const {data:intents}=await sb.from('payment_intents').select('*').gte('created_at',depuis).order('created_at');
const {data:abos}=await sb.from('subscriptions').select('plan, created_at').gte('created_at',depuis).order('created_at');

const parJour=new Map();
for(const i of intents??[]){const j=jour(i.created_at);const a=parJour.get(j)??{clics:0,payes:0,montant:0,abos:0};a.clics++;if(i.consumed_at){a.payes++;a.montant+=Number(i.amount??0);}parJour.set(j,a);}
for(const s of abos??[]){const j=jour(s.created_at);const a=parJour.get(j)??{clics:0,payes:0,montant:0,abos:0};a.abos++;parJour.set(j,a);}

console.log(`\n  ══ LE TUNNEL, JOUR PAR JOUR ══\n`);
console.log(`  ${'jour'.padEnd(12)} ${'clics payer'.padStart(12)} ${'payes'.padStart(7)} ${'abonnements'.padStart(12)} ${'encaisse'.padStart(11)}`);
console.log('  '+'-'.repeat(58));
for(const [j,a] of [...parJour].sort()){
  console.log(`  ${j.padEnd(12)} ${String(a.clics).padStart(12)} ${String(a.payes).padStart(7)} ${String(a.abos).padStart(12)} ${(a.montant.toLocaleString('fr-FR')+' F').padStart(11)}`);
}

// ── 2. Ce que la BOUTIQUE dit, en direct ───────────────────────────────────
console.log(`\n  ══ CE QUE CHARIOW A ENREGISTRE ══\n`);
const entete={Authorization:`Bearer ${env.CHARIOW_API_KEY}`,Accept:'application/json'};
const ventes=[];
let url='https://api.chariow.com/v1/sales?per_page=100';
for(let g=0;g<10&&url;g++){
  const r=await fetch(url,{headers:entete});
  if(!r.ok){console.log(`  arret : HTTP ${r.status}`);break;}
  const j=await r.json();ventes.push(...(j?.data??[]));url=j?.pagination?.next_page_url??null;
}
const recentes=ventes.filter(v=>new Date(v.created_at)>=new Date(depuis));
const parJourC=new Map();
for(const v of recentes){const j=jour(v.created_at);const a=parJourC.get(j)??{};a[v.status]=(a[v.status]??0)+1;parJourC.set(j,a);}
console.log(`  ${ventes.length} vente(s) au total dans la boutique, ${recentes.length} sur 8 jours\n`);
for(const [j,a] of [...parJourC].sort())
  console.log(`  ${j}  ${Object.entries(a).map(([s,n])=>`${s}=${n}`).join('  ')}`);

const derniere=ventes.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
if(derniere) console.log(`\n  Derniere vente boutique : ${String(derniere.created_at).slice(0,19)}  ${derniere.status}  ${derniere.amount??''} ${derniere.currency??''}`);
const derI=(intents??[]).slice(-1)[0];
if(derI) console.log(`  Dernier clic payer      : ${String(derI.created_at).slice(0,19)}  ${derI.consumed_at?'PAYE':'en attente'}`);
console.log('');
