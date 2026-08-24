/**
 * Premier relevé des cotes, lancé à la main.
 *
 * Le même code que la tâche quotidienne. Lancé maintenant plutôt qu'à minuit :
 * chaque journée non relevée est perdue pour toujours, le fournisseur ne
 * gardant pas les cotes passées.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}

const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { releverCotes, lireCotesDuJour } = await jiti.import('./src/lib/cotes-marche.ts');

console.log('\n  Releve par championnat, saison en cours...\n');

const debut = Date.now();
const r = await releverCotes();
const duree = Math.round((Date.now() - debut) / 1000);

console.log(
  `  ${r.matchs} rencontres cotees sur ${r.jours} journees, ` +
  `${r.ligues} championnats interroges, en ${duree} s.\n`
);
console.log('  ══ DETAIL PAR JOURNEE ══\n');
for (const d of r.detail.slice(0, 14)) console.log(`  ${d.jour}   ${String(d.matchs).padStart(4)} rencontres`);

// Relecture : ce qui est ecrit doit etre relisible, sinon le releve ne sert a rien.
const premier = r.detail.find((d) => d.matchs > 0);
if (premier) {
  const relu = await lireCotesDuJour(premier.jour);
  console.log(`\n  Relecture du ${premier.jour} : ${relu ? `${relu.matchs.length} rencontres` : 'ECHEC'}`);

  console.log('\n  ══ CE QUI EST CONSERVE, PAR RENCONTRE ══\n');
  for (const m of (relu?.matchs ?? []).slice(0, 6)) {
    const p = (v) => `${Math.round(v * 100)} %`;
    console.log(
      `  match ${m.id}  ligue ${String(m.ligue).padStart(3)}  ${String(m.date).slice(5, 16)}  ` +
      `cotes ${m.cote.dom}/${m.cote.nul}/${m.cote.ext}  ->  ` +
      `${p(m.proba.dom)} / ${p(m.proba.nul)} / ${p(m.proba.ext)}  ` +
      `(${m.maisons} maisons, marge ${m.marge} %)`
    );
  }

  const marges = (relu?.matchs ?? []).map((m) => m.marge).sort((a, b) => a - b);
  if (marges.length) {
    console.log(`\n  Marge des bookmakers : ${marges[0]} % au plus bas, ${marges[Math.floor(marges.length / 2)]} % en median, ${marges[marges.length - 1]} % au plus haut.`);
  }
}
console.log('');
