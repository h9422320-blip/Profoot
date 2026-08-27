/** VÉRIFICATION COMPLÈTE — cohérence des données servies. Diagnostic seul. */
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
const { lireScore, issue, memeEquipe } = await jiti.import('./src/lib/preuves.ts');
const { contientVocabulaireInterdit, motsInterdits } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const ko=[], ok=[];
const dire=(bon,txt)=>{ (bon?ok:ko).push(txt); console.log(`  ${bon?'OK  ':'BUG '} ${txt}`); };

console.log('\n══ 1. LE MUR DE PREUVES ══');
const { data: preuves } = await sb.from('preuves').select('*');
let contradictoires=0, verdictFaux=0, sansScore=0;
for(const p of preuves??[]){
  const bp=lireScore(p.prono_score), br=lireScore(p.score_reel);
  if(!bp||!br){ sansScore++; continue; }
  const ip=issue(bp[0],bp[1]), ir=issue(br[0],br[1]);
  if(p.issue_correcte !== (ip===ir)) verdictFaux++;
  if(p.publiee && ip!==ir) contradictoires++;
}
dire(contradictoires===0, `cartes PUBLIÉES qui se contredisent : ${contradictoires}`);
dire(verdictFaux===0, `cartes dont le verdict ne colle pas aux scores affichés : ${verdictFaux}`);
dire(true, `cartes sans score exploitable : ${sansScore} (sur ${preuves.length})`);

console.log('\n══ 2. CONFIANCE AFFICHÉE (doit rester 70–95) ══');
const { data: conf } = await sb.from('analysis_history').select('confidence').not('confidence','is',null).order('created_at',{ascending:false}).limit(3000);
const hors = (conf??[]).filter(c=>Number(c.confidence)<70||Number(c.confidence)>95);
dire(hors.length===0, `analyses hors bornes 70–95 : ${hors.length} / ${conf.length}`);

console.log('\n══ 3. VOCABULAIRE INTERDIT DANS LES ANALYSES SERVIES ══');
const { data: textes } = await sb.from('analysis_history').select('id, analysis_data').order('created_at',{ascending:false}).limit(400);
let fautifs=0; const exemples=new Set();
for(const t of textes??[]){
  const s=JSON.stringify(t.analysis_data??'');
  if(contientVocabulaireInterdit(s)){ fautifs++; for(const m of motsInterdits(s).slice(0,3)) exemples.add(m); }
}
dire(fautifs===0, `analyses récentes contenant du vocabulaire interdit : ${fautifs} / ${textes.length}` + (exemples.size?`  → ${[...exemples].slice(0,6).join(', ')}`:''));

console.log('\n══ 4. ÉCHECS D ANALYSE ══');
try{
  const { data: ech } = await sb.from('echecs_analyse').select('*').order('created_at',{ascending:false}).limit(200);
  const h24=(ech??[]).filter(e=>Date.parse(e.created_at)>Date.now()-864e5);
  dire(h24.length<20, `échecs d analyse sur 24 h : ${h24.length}`);
  const motifs=new Map(); for(const e of h24) motifs.set(e.motif??e.raison??e.message??'?', (motifs.get(e.motif??e.raison??e.message??'?')??0)+1);
  for(const [m,n] of [...motifs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)) console.log(`         ${n}×  ${String(m).slice(0,90)}`);
}catch(e){ console.log('  (table echecs_analyse illisible : '+e.message+')'); }

console.log('\n══ 5. CONNEXIONS ══');
let total=0, jamais=0, nonConfirmes=0, recents=0;
for(let p=1;p<=30;p++){
  const { data } = await sb.auth.admin.listUsers({ page:p, perPage:1000 });
  if(!data?.users?.length) break;
  for(const u of data.users){
    total++;
    if(!u.last_sign_in_at) jamais++;
    if(!u.email_confirmed_at) nonConfirmes++;
    if(u.last_sign_in_at && Date.parse(u.last_sign_in_at)>Date.now()-36e5) recents++;
  }
  if(data.users.length<1000) break;
}
dire(true, `comptes : ${total}   connectés dans l heure : ${recents}`);
dire(nonConfirmes===0, `e-mails non confirmés (bloquerait la connexion) : ${nonConfirmes}`);
dire(jamais/total<0.01, `comptes jamais connectés : ${jamais}`);

console.log('\n══ 6. ABONNEMENTS ET PAIEMENTS ══');
try{
  const { data: pi } = await sb.from('payment_intents').select('*').order('created_at',{ascending:false}).limit(300);
  const j7=(pi??[]).filter(p=>Date.parse(p.created_at)>Date.now()-7*864e5);
  const orphelins=j7.filter(p=>p.status==='paid' && !p.user_id);
  dire(orphelins.length===0, `paiements encaissés non rattachés à un compte (7 j) : ${orphelins.length} / ${j7.length}`);
}catch(e){ console.log('  (payment_intents : '+e.message+')'); }

console.log(`\n══ BILAN ══\n  ${ok.length} contrôle(s) au vert, ${ko.length} problème(s).\n`);
for(const k of ko) console.log('   ⚠  '+k);
console.log('');
