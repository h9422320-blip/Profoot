/**
 * L'AVANTAGE DU TERRAIN EXISTE-T-IL VRAIMENT EN SÉLECTION ?
 *
 * Le moteur applique le même avantage partout : +15 % à qui reçoit, -8 % à qui
 * se déplace. Il a été réglé sur des clubs. Or une phase finale — Coupe du
 * monde, CAN, Euro — se joue sur terrain NEUTRE : il n'y a pas d'équipe qui
 * reçoit, et l'avantage appliqué est alors une invention.
 */
import fs from 'node:fs';
const clubs: any[] = JSON.parse(fs.readFileSync('.challenger/rencontres.json', 'utf8'));
const sel = Object.values<any>(JSON.parse(fs.readFileSync('.challenger/selections.json', 'utf8')).matchs ?? {});

const bilan = (l: any[]) => {
  if (!l.length) return null;
  const v = l.filter((m) => m.bd > m.be).length;
  const n = l.filter((m) => m.bd === m.be).length;
  const d = l.filter((m) => m.bd < m.be).length;
  const gd = l.reduce((s, m) => s + m.bd, 0) / l.length;
  const ge = l.reduce((s, m) => s + m.be, 0) / l.length;
  return { n: l.length, v: (100 * v) / l.length, nul: (100 * n) / l.length, d: (100 * d) / l.length, gd, ge, ecart: gd - ge };
};
const ligne = (nom: string, l: any[]) => {
  const b = bilan(l);
  if (!b || b.n < 80) return;
  console.log(
    `  ${nom.padEnd(34)} ${String(b.n).padStart(5)} · reçoit ${b.v.toFixed(1)} % / nul ${b.nul.toFixed(1)} % / dehors ${b.d.toFixed(1)} %` +
      ` · buts ${b.gd.toFixed(2)} contre ${b.ge.toFixed(2)} (écart ${b.ecart >= 0 ? '+' : ''}${b.ecart.toFixed(2)})`
  );
};

console.log('CLUBS — la référence sur laquelle le moteur a été réglé');
ligne('tous championnats', clubs);

console.log('\nSÉLECTIONS');
ligne('toutes compétitions', sel);

// Les compétitions à domicile/extérieur véritables contre les phases finales.
const ALLER_RETOUR = new Set([5, 10, 29, 30, 31, 32, 33, 34, 35, 36, 37, 536, 960]);
const PHASE_FINALE = new Set([1, 4, 6, 9, 19, 22, 25, 535]);
ligne('aller-retour (qualifs, ligue des nations)', sel.filter((m) => ALLER_RETOUR.has(Number(m.ligue))));
ligne('phases finales (Mondial, CAN, Euro…)', sel.filter((m) => PHASE_FINALE.has(Number(m.ligue))));

console.log('\nLES PRINCIPALES, UNE À UNE');
const nom: Record<number, string> = { 1: 'Coupe du monde', 4: "Championnat d'Europe", 5: 'Ligue des nations', 6: 'CAN', 9: 'Copa América', 10: 'Amicaux', 29: 'Qualifs Mondial (Afrique)', 32: 'Qualifs Mondial (Europe)', 34: 'Qualifs Mondial (Amérique du Sud)', 36: 'Qualifs CAN', 536: 'CONCACAF Nations League' };
const parLigue = new Map<number, any[]>();
for (const m of sel) parLigue.set(Number(m.ligue), [...(parLigue.get(Number(m.ligue)) ?? []), m]);
for (const [l, liste] of [...parLigue.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10))
  ligne(nom[l] ?? `compétition ${l}`, liste);
