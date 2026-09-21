// Un essai contre le champion, découpé en trois tranches chronologiques.
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const nom = process.argv[3];
const champ: any[] = [...r.variantes.champion].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
const essai = new Map(r.variantes[nom].map((p: any) => [p.id, p]));
const t = Math.floor(champ.length / 3);
const tranches: [string, any[]][] = [
  ['1re tranche', champ.slice(0, t)],
  ['2e tranche', champ.slice(t, 2 * t)],
  ['3e tranche', champ.slice(2 * t)],
];
const mesure = (l: any[]) => {
  let justes = 0, brier = 0, surs = 0, sursJustes = 0;
  for (const p of l) {
    if (p.parScore === p.reel) justes++;
    brier += p.probas.reduce((s: number, v: number, i: number) => s + (v - (i === p.reel ? 1 : 0)) ** 2, 0);
    const max = Math.max(...p.probas);
    if (max >= 0.6) { surs++; if (p.probas.indexOf(max) === p.reel) sursJustes++; }
  }
  return { n: l.length, justes, brier: brier / (l.length || 1), surs, sursJustes };
};
console.log(`essai « ${nom} » contre le champion, sur ${champ.length} rencontres`);
for (const [titre, lot] of tranches) {
  const a = mesure(lot);
  const b = mesure(lot.map((p) => essai.get(p.id)).filter(Boolean));
  const dep = (x: any) => (x.surs ? ((100 * x.sursJustes) / x.surs).toFixed(1) + ' %' : '—');
  console.log(
    `  ${titre} (${String(lot[0].date).slice(0, 10)} → ${String(lot[lot.length - 1].date).slice(0, 10)}) · ` +
      `${a.n} matchs · justes ${a.justes} → ${b.justes} (${b.justes - a.justes >= 0 ? '+' : ''}${b.justes - a.justes}) · ` +
      `Brier ${a.brier.toFixed(4)} → ${b.brier.toFixed(4)} · sûrs ${dep(a)} → ${dep(b)}`
  );
}
