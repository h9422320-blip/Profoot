/**
 * OÙ LE GAIN SE TROUVE-T-IL VRAIMENT ?
 *
 * Un gain moyen de 1,3 point peut cacher deux choses très différentes : un
 * progrès étalé sur tous les matchs, ou un progrès concentré là où le moteur
 * était mauvais. La seconde vaut bien plus que la première, parce qu'elle
 * répare un défaut connu au lieu de grappiller partout.
 */
import { nouveauJuge, chargerMatchs } from './banc.mjs';
import { poissonParLigue, COUPES } from './modeles.mjs';
import { ensemble, meilleurPoisson } from './modeles3.mjs';

const COUPURE = Date.parse('2025-08-01T00:00:00Z');

const fabriques = [
  () => poissonParLigue(),
  () => meilleurPoisson(),
  () => ensemble({ poidsElo: 0.3, nom: 'H. Ensemble 30 % Elo' }),
];

const matchs = chargerMatchs();
const modeles = fabriques.map((f) => f());

// Trois segments : le match ordinaire, le match de coupe, et le match entre
// deux équipes de championnats différents (qui recouvre en partie le second).
const segments = ['tous', 'coupe', 'croise', 'interne'];
const juges = modeles.map((m) => Object.fromEntries(segments.map((s) => [s, nouveauJuge(m.nom)])));

for (const m of matchs) {
  if (Date.parse(m.date) >= COUPURE) {
    // Le championnat de chaque équipe, tel que le modèle le connaît.
    const lDom = modeles[1].ligueDe?.(m.dom) ?? null;
    const lExt = modeles[1].ligueDe?.(m.ext) ?? null;
    const estCoupe = COUPES.has(m.ligue);
    const estCroise = lDom !== null && lExt !== null && lDom !== lExt;

    modeles.forEach((mod, i) => {
      const r = mod.predire(m);
      juges[i].tous.ajouter(r.probas, r.score, m);
      if (estCoupe) juges[i].coupe.ajouter(r.probas, r.score, m);
      if (estCroise) juges[i].croise.ajouter(r.probas, r.score, m);
      else juges[i].interne.ajouter(r.probas, r.score, m);
    });
  }
  modeles.forEach((mod) => mod.apprendre(m));
}

const titres = {
  tous: 'TOUS LES MATCHS',
  interne: 'MEME CHAMPIONNAT',
  croise: 'CHAMPIONNATS DIFFERENTS',
  coupe: 'COUPES EUROPEENNES',
};

for (const seg of ['tous', 'interne', 'croise', 'coupe']) {
  console.log(`\n  ══ ${titres[seg]} ══\n`);
  console.log('  modele                          matchs  vainqueur    score     Brier   log-loss');
  console.log('  ' + '─'.repeat(80));
  const base = juges[0][seg].bilan();
  juges.forEach((j) => {
    const b = j[seg].bilan();
    if (!b.n) return;
    const gain = b === base ? '' : `   ${b.vainqueur - base.vainqueur > 0 ? '+' : ''}${Math.round((b.vainqueur - base.vainqueur) * 10) / 10} pt`;
    console.log(
      `  ${b.nom.padEnd(30)} ${String(b.n).padStart(6)} ${String(b.vainqueur).padStart(9)} %` +
      ` ${String(b.scoreExact ?? '—').padStart(7)} % ${String(b.brier).padStart(9)} ${String(b.logloss).padStart(10)}${gain}`
    );
  });
}
console.log('');
