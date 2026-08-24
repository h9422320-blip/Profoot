/**
 * RÉGULARISATION — jusqu'où faut-il croire la hiérarchie apprise ?
 *
 * Mesuré sur le segment qui compte : les matchs entre championnats différents.
 * Un amortissement qui garde le gain est une assurance gratuite ; un
 * amortissement qui le détruit dirait que le gain tenait à des valeurs
 * extrêmes, donc fragiles.
 */
import { nouveauJuge, chargerMatchs } from './banc.mjs';
import { poissonParLigue, COUPES } from './modeles.mjs';
import { poissonAvance } from './modeles2.mjs';

const COUPURE = Date.parse('2025-08-01T00:00:00Z');
const PUISSANCES = [0, 0.3, 0.5, 0.7, 0.85, 1, 1.2];

const fabriques = [
  { nom: 'reference (aucune normalisation)', f: () => poissonParLigue() },
  ...PUISSANCES.map((p) => ({
    nom: `normalisation a ${Math.round(p * 100)} %`,
    f: () => poissonAvance({
      nom: `normalisation a ${Math.round(p * 100)} %`,
      normaliserLigues: true, ponderationTemporelle: true, memoire: 60, puissanceCoef: p,
    }),
  })),
];

const matchs = chargerMatchs();
const modeles = fabriques.map((x) => x.f());
const segments = ['croise', 'interne'];
const juges = modeles.map(() => Object.fromEntries(segments.map((s) => [s, nouveauJuge('')])));
const moities = modeles.map(() => Object.fromEntries(segments.map((s) => [s, [nouveauJuge(''), nouveauJuge('')]])));

const test = matchs.filter((m) => Date.parse(m.date) >= COUPURE);
const milieu = Date.parse(test[Math.floor(test.length / 2)].date);

for (const m of matchs) {
  const t = Date.parse(m.date);
  if (t >= COUPURE) {
    const lDom = modeles[1].ligueDe?.(m.dom) ?? null;
    const lExt = modeles[1].ligueDe?.(m.ext) ?? null;
    const croise = lDom !== null && lExt !== null && lDom !== lExt;
    const seg = croise ? 'croise' : 'interne';
    modeles.forEach((mod, i) => {
      const r = mod.predire(m);
      juges[i][seg].ajouter(r.probas, r.score, m);
      moities[i][seg][t < milieu ? 0 : 1].ajouter(r.probas, r.score, m);
    });
  }
  modeles.forEach((mod) => mod.apprendre(m));
}

console.log('\n  ══ EFFET DE L AMORTISSEMENT, SUR LES MATCHS CROISES ══\n');
console.log('  reglage                          matchs  vainqueur   log-loss   1re moitie  2e moitie  verdict');
console.log('  ' + '─'.repeat(96));

const base = juges[0].croise.bilan();
const baseA = moities[0].croise[0].bilan();
const baseB = moities[0].croise[1].bilan();

fabriques.forEach((x, i) => {
  const b = juges[i].croise.bilan();
  const a = moities[i].croise[0].bilan();
  const c = moities[i].croise[1].bilan();
  const dA = Math.round((a.vainqueur - baseA.vainqueur) * 10) / 10;
  const dB = Math.round((c.vainqueur - baseB.vainqueur) * 10) / 10;
  const verdict = i === 0 ? '' : dA > 0 && dB > 0 ? 'TIENT' : dA < 0 && dB < 0 ? 'pire' : 'incertain';
  const s = (v) => (v > 0 ? '+' : '') + v;
  console.log(
    `  ${x.nom.padEnd(32)} ${String(b.n).padStart(5)} ${String(b.vainqueur).padStart(9)} %` +
    ` ${String(b.logloss).padStart(10)} ${(i === 0 ? '' : s(dA) + ' pt').padStart(11)} ${(i === 0 ? '' : s(dB) + ' pt').padStart(10)}  ${verdict}`
  );
});

console.log('\n  ══ CONTROLE : les matchs internes ne doivent PAS se degrader ══\n');
console.log('  reglage                          matchs  vainqueur   log-loss');
console.log('  ' + '─'.repeat(66));
fabriques.forEach((x, i) => {
  const b = juges[i].interne.bilan();
  console.log(`  ${x.nom.padEnd(32)} ${String(b.n).padStart(5)} ${String(b.vainqueur).padStart(9)} % ${String(b.logloss).padStart(10)}`);
});
console.log('');
