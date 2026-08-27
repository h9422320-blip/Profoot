/**
 * TOUT CE QUI A ÉTÉ ENCAISSÉ UN JOUR DONNÉ, ET CE QUE LE CLIENT A REÇU.
 *     node scripts/audit-jour.mjs 2026-08-25
 * Lecture seule.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const cle = process.env.CHARIOW_API_KEY;
const JOUR = process.argv[2] ?? '2026-08-25';

async function toutes(statut){
  const vues=new Set(); const out=[]; let cursor=null;
  for(let t=0;t<80;t++){
    const u=new URL('https://api.chariow.com/v1/sales');
    u.searchParams.set('status',statut); u.searchParams.set('per_page','100');
    if(cursor) u.searchParams.set('cursor',cursor);
    const r=await fetch(u,{headers:{Authorization:`Bearer ${cle}`,Accept:'application/json'}});
    const j=await r.json().catch(()=>({}));
    const d=Array.isArray(j?.data)?j.data:[];
    let nv=0; for(const v of d) if(!vues.has(v.id)){ vues.add(v.id); out.push(v); nv++; }
    if(!j?.pagination?.has_more_pages||!j?.pagination?.next_cursor||nv===0) break;
    cursor=j.pagination.next_cursor;
  }
  return out;
}

const encaissees = [...await toutes('completed'), ...await toutes('settled')];
const duJour = encaissees.filter(v => String(v.completed_at ?? v.created_at ?? '').slice(0,10) === JOUR);

const lireTout = async (t,c) => { const o=[]; for(let de=0;de<200000;de+=1000){ const {data,error}=await sb.from(t).select(c).range(de,de+999); if(error||!data?.length) break; o.push(...data); if(data.length<1000) break; } return o; };
const intentions = await lireTout('payment_intents','sale_id, email, user_id, plan, pays, amount');
const parVente = new Map(intentions.filter(i=>i.sale_id).map(i=>[i.sale_id,i]));
const abos = await lireTout('subscriptions','user_id, plan, status, expires_at, created_at, chariow_sale_id');
const parVenteAbo = new Map(abos.filter(a=>a.chariow_sale_id).map(a=>[a.chariow_sale_id,a]));
const matchs = await lireTout('matchs_debloques','sale_id');
const venteMatch = new Set(matchs.map(m=>m.sale_id).filter(Boolean));

const comptes=new Map();
for(let p=1;p<=40;p++){ const {data}=await sb.auth.admin.listUsers({page:p,perPage:1000}); if(!data?.users?.length) break; for(const u of data.users) comptes.set(String(u.email).toLowerCase(), u.id); if(data.users.length<1000) break; }

console.log(`\n══ VENTES ENCAISSÉES LE ${JOUR} : ${duJour.length} ══\n`);
let totalF=0, servies=0, problemes=[];
console.log('  heure   montant   offre               pays  moyen            client                              état');
for(const v of duJour.sort((a,b)=>String(a.completed_at??a.created_at).localeCompare(String(b.completed_at??b.created_at)))){
  const i = parVente.get(v.id);
  const email = (i?.email ?? v.customer?.email ?? v.buyer?.email ?? '').toLowerCase();
  // Le montant DE LA VENTE, en francs. `payment.amount` est ce que la carte du
  // client a été débitée dans sa propre devise — 3,14 € pour 2 000 F — et le
  // lire ici faisait fondre le chiffre d affaires des acheteurs européens.
  const montant = Number(v.amount?.value ?? v.original_amount?.value ?? 0);
  totalF += montant;
  const abo = parVenteAbo.get(v.id);
  const match = venteMatch.has(v.id);
  const uid = comptes.get(email);
  let etat;
  if (abo) { const actif = !abo.expires_at || Date.parse(abo.expires_at) > Date.now(); etat = actif ? 'OK actif' : 'expiré'; servies++; }
  else if (match) { etat = 'OK match'; servies++; }
  else if (!uid) { etat = 'PAS DE COMPTE'; problemes.push({v,email,montant,raison:'aucun compte à cette adresse'}); }
  else { etat = '*** NON SERVI ***'; problemes.push({v,email,montant,raison:'compte existe, accès jamais ouvert'}); }
  const heure = String(v.completed_at ?? v.created_at).slice(11,16);
  console.log(`  ${heure}  ${String(montant).padStart(6)}F   ${String(i?.plan ?? v.product?.name ?? '?').padEnd(19)} ${String(i?.pays ?? '?').padEnd(4)}  ${String(v.payment?.method?.name ?? '—').padEnd(14)} ${String(email||'(inconnu)').padEnd(35)} ${etat}`);
}
console.log(`\n  TOTAL ENCAISSÉ : ${totalF.toLocaleString('fr-FR')} FCFA`);
console.log(`  servies : ${servies} / ${duJour.length}`);
if(problemes.length){
  console.log(`\n  ⚠  ${problemes.length} VENTE(S) À REGARDER :\n`);
  for(const p of problemes) console.log(`     ${p.v.id}   ${String(p.montant).padStart(6)}F   ${String(p.email||'(inconnu)').padEnd(35)} ${p.raison}`);
}
console.log('');
