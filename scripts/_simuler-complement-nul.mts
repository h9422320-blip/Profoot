// La sélection d'aujourd'hui et trois variantes, jouées sur deux saisons.
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('.challenger/travail/resultat-gardien-cinq.json', 'utf8'));
const tous: any[] = r.variantes.champion;
const certitude = (p: any) => Math.max(...p.probas);
const partDuNul = (p: any) => p.probas[1] / Math.max(1e-6, 1 - certitude(p));
const parJour = new Map<string, any[]>();
for (const p of tous) parJour.set(String(p.date).slice(0, 10), [...(parJour.get(String(p.date).slice(0, 10)) ?? []), p]);
const MAX = 6;
type Regle = (tri: any[]) => any[];
const socle = (tri: any[]) => {
  const surs = tri.filter((p) => certitude(p) >= 0.65);
  return surs.length ? surs : tri.filter((p) => certitude(p) >= 0.55);
};
const regles: [string, Regle][] = [
  ['aujourd’hui', (tri) => socle(tri).slice(0, MAX)],
  [
    'nul dominant d’abord',
    (tri) => [...socle(tri)].sort((a, b) => Number(partDuNul(b) >= 0.62) - Number(partDuNul(a) >= 0.62)).slice(0, MAX),
  ],
  [
    'nul dominant seulement',
    (tri) => {
      const base = socle(tri);
      const dom = base.filter((p) => partDuNul(p) >= 0.62);
      return (dom.length ? dom : base).slice(0, MAX);
    },
  ],
  [
    'nul dominant seulement, sans repli',
    (tri) => tri.filter((p) => certitude(p) >= 0.65 && partDuNul(p) >= 0.62).slice(0, MAX),
  ],
];
for (const [nom, regle] of regles) {
  let montres = 0, justes = 0, jours = 0, parfaits = 0;
  for (const [, lot] of parJour) {
    const choix = regle([...lot].sort((a, b) => certitude(b) - certitude(a)));
    if (!choix.length) continue;
    jours++;
    montres += choix.length;
    const bons = choix.filter((p) => p.parScore === p.reel).length;
    justes += bons;
    if (bons === choix.length) parfaits++;
  }
  console.log(
    `${nom.padEnd(32)} ${String(montres).padStart(4)} rencontres sur ${jours} journées (${(montres / jours).toFixed(2)}/jour) · ` +
      `justes ${((100 * justes) / montres).toFixed(1)} % · journées 100 % justes ${((100 * parfaits) / jours).toFixed(1)} %`
  );
}
