/*
 * Met en reserve les statistiques de tirs des matchs de quatre championnats
 * que le fournisseur couvre (Finlande 244, Roumanie 283, Serbie 286,
 * Irlande 357), depuis le 1er juillet 2025. Memes appels et memes cles que la
 * construction du releve : si ces championnats entrent au releve, la
 * production trouvera la reserve deja chaude. Lecture seule cote moteur.
 */
import fs from 'node:fs';
for (const brut of fs.readFileSync('.env.local', 'utf8').split(String.fromCharCode(10))) {
  const l = brut.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { apiFootball } = await import('../src/lib/api-football.js');
const F = 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(F, 'utf8'));
const LIGUES = [244, 283, 286, 357];
const aLire: number[] = tout.filter((x: any) => LIGUES.includes(x.ligue) && x.date >= '2025-07-01').map((x: any) => Number(x.id));
let ok = 0, vides = 0, erreurs = 0;
const t0 = Date.now();
for (let k = 0; k < aLire.length; k++) {
  try {
    const r: any = await apiFootball('/fixtures/statistics?fixture=' + aLire[k], 365 * 86400000);
    if ((r?.response ?? []).length >= 2) ok++; else vides++;
  } catch {
    erreurs++;
  }
  if (k % 150 === 149) console.log('  ' + (k + 1) + '/' + aLire.length + ' lus, ' + ok + ' avec tirs, ' + vides + ' vides, ' + erreurs + ' erreurs, ' + Math.round((Date.now() - t0) / 1000) + ' s');
  await new Promise((res) => setTimeout(res, 120));
}
console.log('FIN : ' + aLire.length + ' matchs, ' + ok + ' avec tirs, ' + vides + ' vides, ' + erreurs + ' erreurs, ' + Math.round((Date.now() - t0) / 1000) + ' s');
