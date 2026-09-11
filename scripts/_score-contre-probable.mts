/**
 * Le vainqueur tiré du SCORE annoncé contre l'issue la plus PROBABLE.
 * Lecture seule, sur les pronostics du moteur actuel rejoués par le challenger.
 */
import fs from 'node:fs';
const res = JSON.parse(fs.readFileSync('.challenger/travail/resultat-champion.json', 'utf8'));
const champ: any[] = res.variantes.champion;
const tri = [...champ].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
const m = Math.floor(tri.length / 2);
const moities = [tri.slice(0, m), tri.slice(m)];
const choix = (p: number[]) => p.indexOf(Math.max(...p));
const lib = ['victoire domicile', 'nul', 'victoire extérieur'];
for (const [i, l] of moities.entries()) {
  const parScore = l.filter((p) => p.parScore === p.reel).length;
  const parProba = l.filter((p) => choix(p.probas) === p.reel).length;
  console.log(`${i === 0 ? '1re' : '2e'} moitié (${l.length}) : vainqueur du score ${parScore} (${(100 * parScore / l.length).toFixed(1)} %)   issue la plus probable ${parProba} (${(100 * parProba / l.length).toFixed(1)} %)`);
}
const desaccords = champ.filter((p) => p.parScore !== choix(p.probas));
console.log(`\n${desaccords.length} matchs sur ${champ.length} où le score annonce une autre issue que la plus probable`);
const cases = new Map<string, { n: number; score: number; proba: number }>();
for (const p of desaccords) {
  const k = `score dit ${lib[p.parScore]} / pourcentages disent ${lib[choix(p.probas)]}`;
  const c = cases.get(k) ?? { n: 0, score: 0, proba: 0 };
  c.n++; if (p.parScore === p.reel) c.score++; if (choix(p.probas) === p.reel) c.proba++;
  cases.set(k, c);
}
for (const [k, c] of [...cases].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(70)} ${String(c.n).padStart(4)} matchs : le score avait raison ${c.score}, les pourcentages ${c.proba}`);
