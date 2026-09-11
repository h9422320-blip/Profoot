/** Combien de matchs cotés et joués s'ajoutent chaque semaine dans les grands championnats et les coupes d'Europe. */
import fs from 'node:fs';
const cotes = JSON.parse(fs.readFileSync('.challenger/cotes.json', 'utf8'));
const rencontres: any[] = JSON.parse(fs.readFileSync('.challenger/rencontres.json', 'utf8'));
const suivies = new Set([39, 140, 135, 78, 61, 94, 88, 2, 3]);
const parSemaine = new Map<string, { suivies: number; toutes: number }>();
for (const m of rencontres) {
  if (!cotes[String(m.id)]) continue;
  const d = new Date(m.date);
  const lundi = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
  const c = parSemaine.get(lundi) ?? { suivies: 0, toutes: 0 };
  c.toutes++;
  if (suivies.has(Number(m.ligue))) c.suivies++;
  parSemaine.set(lundi, c);
}
let cumul = 0;
console.log('semaine du   grands+coupes  toutes competitions');
for (const [s, c] of [...parSemaine].sort()) { cumul += c.suivies; console.log(`  ${s}      ${String(c.suivies).padStart(4)}          ${String(c.toutes).padStart(5)}      cumul grands+coupes ${cumul}`); }
const cotesAVenir = Object.keys(cotes).length - rencontres.filter((m) => cotes[String(m.id)]).length;
console.log(`\n${Object.keys(cotes).length} rencontres cotees en reserve, dont ${cotesAVenir} pas encore jouees`);
