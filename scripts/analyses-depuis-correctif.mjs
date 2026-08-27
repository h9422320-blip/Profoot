/**
 * LES ANALYSES PRODUITES DEPUIS LE DÉPLOIEMENT SONT-ELLES PROPRES ?
 *
 *     node scripts/analyses-depuis-correctif.mjs <ISO de depart>
 *
 * Le build qui passe ne prouve rien : il dit que le code compile, pas que le
 * filtre tourne. La seule preuve est une analyse NEUVE, produite par le
 * serveur en ligne, qui ressort sans vocabulaire fautif.
 */
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
const { contientVocabulaireInterdit, motsInterdits } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const DEPART = process.argv[2];
const { data } = await sb.from('analysis_history')
  .select('id, created_at, analysis_data')
  .gt('created_at', DEPART)
  .order('created_at', { ascending: true });

let fautives = 0; const mots = new Map();
for (const a of data ?? []) {
  const s = JSON.stringify(a.analysis_data ?? '');
  if (!contientVocabulaireInterdit(s)) continue;
  fautives++;
  for (const m of motsInterdits(s)) mots.set(m, (mots.get(m) ?? 0) + 1);
}
console.log(`  ${data?.length ?? 0} analyse(s) produites depuis ${DEPART} — ${fautives} fautive(s).`);
if (mots.size) console.log(`     mots : ${[...mots.entries()].sort((a,b)=>b[1]-a[1]).map(([m,n])=>`${m} (${n})`).join(', ')}`);
process.exit(fautives ? 2 : (data?.length >= 25 ? 0 : 3));
