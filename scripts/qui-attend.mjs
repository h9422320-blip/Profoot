/** Qui a payé sans recevoir son accès ? Lecture seule, aucun courriel. */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=l.trim(); if(!t||t.startsWith('#'))continue;
  const i=t.indexOf('='); if(i<0)continue;
  process.env[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(),'src') } });
const { rattraperAccesManquants } = await jiti.import('./src/lib/acces-manquants.ts');
// `false` = on regarde sans rien envoyer ni réparer.
const bilan = await rattraperAccesManquants(false);
console.log('\n  bilan (lecture seule) :', JSON.stringify(bilan).slice(0,300), '\n');
