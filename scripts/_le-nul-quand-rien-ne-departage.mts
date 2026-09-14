/**
 * CE QUE COÛTE LE NUL ANNONCÉ QUAND RIEN NE DÉPARTAGE LES DEUX VICTOIRES.
 *
 * ── LA RÈGLE, ET POURQUOI ELLE EXISTE ─────────────────────────────────────
 *
 * `score-probable.ts` annonce le nul dans deux cas : quand le nul est la plus
 * forte probabilité, ET quand les deux victoires sont à moins de deux points
 * l'une de l'autre (`vraimentAegalite`). Le second cas vient du défaut signalé
 * le 3 septembre 2026 : « Real Betis 2-1 Real Madrid » sur 36/28/36. Désigner
 * un vainqueur sur un tel écart, c'est le tirer au sort — et l'application
 * promet le contraire.
 *
 * Le coût en avait été mesuré à l'époque sur 3 467 rencontres : neuf centièmes
 * de point. Le principe avait été gardé en connaissance de cause.
 *
 * ── CE QUE CE RELEVÉ REFAIT, SUR BANC ALIGNÉ ──────────────────────────────
 *
 * Le 14 septembre 2026, le banc d'essai reproduit enfin le vrai moteur (ancre
 * des douze derniers matchs, classement, forces ajustées, croisement entre
 * championnats). La question mérite donc d'être reposée sur 17 985 rencontres
 * au lieu de 3 467.
 *
 * Il sépare aussi les DEUX sortes de désaccord entre le score annoncé et
 * l'issue que le moteur juge la plus probable — la règle voulue d'un côté, et
 * tout le reste de l'autre. Le reste, s'il coûtait, serait une vraie
 * incohérence à corriger.
 *
 *   npx tsx scripts/_le-nul-quand-rien-ne-departage.mts <resultat.json> [variante]
 */
import fs from 'node:fs';
import type { Pronostic } from './challenger/porte.js';

const res: { variantes: Record<string, Pronostic[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const nom = process.argv[3] ?? Object.keys(res.variantes)[0];
const liste = res.variantes[nom];
if (!liste?.length) {
  console.log(`variante introuvable. Disponibles : ${Object.keys(res.variantes).join(' | ')}`);
  process.exit(1);
}

/** Le seuil de la production : `BANC_ECART_NUL`, deux points par défaut. */
const ECART_NON_DEPARTAGE = Number(process.env.BANC_ECART_NUL) || 2;
const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');

const moities = (l: Pronostic[]): [Pronostic[], Pronostic[]] => {
  const t = [...l].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const m = Math.floor(t.length / 2);
  return [t.slice(0, m), t.slice(m)];
};

type Cas = { n: number; scoreJuste: number; probableJuste: number };
const vide = (): Cas => ({ n: 0, scoreJuste: 0, probableJuste: 0 });

function decomposer(l: Pronostic[]) {
  const regle = vide();
  const reste = vide();
  let total = 0;
  let totalScore = 0;
  let totalProbable = 0;
  for (const p of l) {
    const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
    const pr = [p.probas[0] / s, p.probas[1] / s, p.probas[2] / s];
    const probable = pr.indexOf(Math.max(...pr));
    total++;
    if (p.parScore === p.reel) totalScore++;
    if (probable === p.reel) totalProbable++;
    if (probable === p.parScore) continue;

    const departage = Math.abs(pr[0] - pr[2]) * 100 >= ECART_NON_DEPARTAGE;
    const c = p.parScore === 1 && !departage ? regle : reste;
    c.n++;
    if (p.parScore === p.reel) c.scoreJuste++;
    if (probable === p.reel) c.probableJuste++;
  }
  return { regle, reste, total, totalScore, totalProbable };
}

const dire = (titre: string, c: Cas) =>
  console.log(
    `  ${titre.padEnd(46)} ${String(c.n).padStart(5)}   ` +
      `annoncé ${pc(c.scoreJuste, c.n).padStart(7)}   ` +
      `le plus probable ${pc(c.probableJuste, c.n).padStart(7)}   ` +
      `écart ${c.probableJuste - c.scoreJuste >= 0 ? '+' : ''}${c.probableJuste - c.scoreJuste}`
  );

console.log(`\nVARIANTE : ${nom} — ${liste.length} rencontres rejouées\n`);

const tout = decomposer(liste);
console.log('SUR TOUT L’HISTORIQUE');
console.log(
  `  vainqueur tiré du SCORE annoncé            ${tout.totalScore}/${tout.total}  ${pc(tout.totalScore, tout.total)}`
);
console.log(
  `  vainqueur que le moteur juge LE PLUS PROBABLE  ${tout.totalProbable}/${tout.total}  ${pc(tout.totalProbable, tout.total)}\n`
);
dire('le nul de la règle (rien ne départage)', tout.regle);
dire('tous les autres désaccords', tout.reste);

console.log('\nPAR MOITIÉ, POUR LA PORTE');
const [a, b] = moities(liste);
let i = 0;
for (const moitie of [a, b]) {
  i++;
  const d = decomposer(moitie);
  console.log(
    `  moitié ${i} : ${d.totalScore} vainqueurs justes par le score, ${d.totalProbable} par le plus probable ` +
      `(écart ${d.totalProbable - d.totalScore >= 0 ? '+' : ''}${d.totalProbable - d.totalScore})`
  );
}

console.log(
  '\n  Le Brier et la justesse des matchs sûrs ne bougeraient PAS : les deux se' +
    '\n  lisent déjà sur les probabilités, jamais sur le score annoncé.\n'
);
