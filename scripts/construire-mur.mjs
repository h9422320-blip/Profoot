/**
 * RECONSTRUIT LE MUR DE PREUVES À LA DEMANDE.
 *
 * L'entretien quotidien le fait tout seul. Ce script sert quand on ne veut pas
 * attendre : après une vérification d'arriéré, les réussites du jour doivent
 * apparaître tout de suite.
 *
 * Il appelle le VRAI `construirePreuves` du serveur — pas une copie. Une copie
 * finirait par diverger, et le mur affiché ne serait plus celui qu'on teste.
 */
import fs from 'fs';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const jiti = createJiti(import.meta.url, { alias: { '@': new URL('../src', import.meta.url).pathname } });
const { construirePreuves } = await jiti.import('../src/lib/preuves.ts');

const r = await construirePreuves();
console.log(`\n  ${r.matchs} match(s) examiné(s), ${r.reussites} réussite(s), ${r.creees} nouvelle(s) preuve(s).`);
if (r.erreur) console.log(`  erreur : ${r.erreur}`);
console.log('');
