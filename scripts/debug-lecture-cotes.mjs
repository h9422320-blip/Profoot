import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { chargerMatchs } from './banc.mjs';
import { meilleurPoisson } from './modeles3.mjs';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireCotesDuJour, lireCotesEntre } = await jiti.import('./src/lib/cotes-marche.ts');
const { lireReserve } = await jiti.import('./src/lib/api-football.ts');

console.log('\n  lireReserve directe :');
const brut = await lireReserve('cotes:2026-08-17');
console.log('    contenu present : ' + (brut && brut.contenu ? 'OUI' : 'NON') + ' · expiree : ' + (brut ? brut.expiree : '—'));
if (brut && brut.contenu) console.log('    matchs : ' + (brut.contenu.matchs || []).length);

console.log('\n  lireCotesDuJour :');
const j = await lireCotesDuJour('2026-08-17');
console.log('    ' + (j ? j.matchs.length + ' matchs' : 'null'));

console.log('\n  lireCotesEntre sur 30 jours :');
const fin = new Date();
const debut = new Date(fin.getTime() - 30 * 86400000);
console.log('    du ' + debut.toISOString().slice(0, 10) + ' au ' + fin.toISOString().slice(0, 10));
const m = await lireCotesEntre(debut, fin);
console.log('    ' + m.size + ' rencontres');
console.log('');
