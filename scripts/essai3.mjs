/**
 * PHASE 2 (suite) — COMBINAISON ET RÉGLAGE.
 *
 * ── POURQUOI DEUX MOITIÉS SÉPARÉES, ET PAS UN SEUL CHIFFRE ────────────────
 *
 * Régler un paramètre sur le jeu de test, puis annoncer le résultat sur ce
 * même jeu, revient à corriger sa copie avant de la rendre. On règle donc sur
 * la PREMIÈRE moitié du test, et on ne regarde la seconde que pour vérifier
 * que le réglage tient. Un paramètre qui brille sur l'une et s'effondre sur
 * l'autre est du bruit, pas un progrès.
 */
import { poissonParLigue } from './modeles.mjs';
import { poissonAvance } from './modeles2.mjs';

process.env.BANC_SILENCIEUX = '1';
const { derouler } = await import('./essai.mjs');

const CANDIDATS = [
  { nom: 'reference (rien)', f: () => poissonParLigue() },
  { nom: 'A seul', f: () => poissonAvance({ nom: 'A seul', normaliserLigues: true }) },
  { nom: 'C seul', f: () => poissonAvance({ nom: 'C seul', ponderationTemporelle: true }) },
  { nom: 'A + C', f: () => poissonAvance({ nom: 'A + C', normaliserLigues: true, ponderationTemporelle: true }) },
];

// ── Réglage de la vitesse d'apprentissage des championnats (levier A) ────
for (const v of [0.01, 0.02, 0.05, 0.08]) {
  CANDIDATS.push({
    nom: `A+C vitesse ${v}`,
    f: () => poissonAvance({ nom: `A+C vitesse ${v}`, normaliserLigues: true, ponderationTemporelle: true, vitesseLigue: v }),
  });
}

// ── Réglage de la longueur de mémoire (levier C) ─────────────────────────
for (const mem of [20, 60, 100]) {
  CANDIDATS.push({
    nom: `A+C memoire ${mem}`,
    f: () => poissonAvance({ nom: `A+C memoire ${mem}`, normaliserLigues: true, ponderationTemporelle: true, memoire: mem }),
  });
}

const r = derouler(CANDIDATS.map((c) => c.f));

console.log(`\n  ${r.entraines} matchs d'entrainement, ${r.testes} matchs de test.\n`);
console.log('  ══ REGLAGE SUR LA 1re MOITIE, VERIFICATION SUR LA 2e ══\n');
console.log('  candidat                  1re moitie          2e moitie         ensemble');
console.log('                          vainq.   log-loss   vainq.   log-loss   vainq.   log-loss');
console.log('  ' + '─'.repeat(84));

const base = { A: r.moities.A[0], B: r.moities.B[0], T: r.bilans[0] };

r.bilans.forEach((b, i) => {
  const a = r.moities.A[i];
  const c = r.moities.B[i];
  const marque = i === 0 ? '  <- reference' : '';
  console.log(
    `  ${CANDIDATS[i].nom.padEnd(22)} ${String(a.vainqueur).padStart(6)} % ${String(a.logloss).padStart(9)}` +
    ` ${String(c.vainqueur).padStart(8)} % ${String(c.logloss).padStart(9)}` +
    ` ${String(b.vainqueur).padStart(8)} % ${String(b.logloss).padStart(9)}${marque}`
  );
});

console.log('\n  ══ GAIN CONTRE LA REFERENCE, MOITIE PAR MOITIE ══\n');
console.log('  candidat                 1re moitie   2e moitie   verdict');
console.log('  ' + '─'.repeat(62));
const s = (v) => (v > 0 ? '+' : '') + Math.round(v * 10) / 10;
r.bilans.forEach((b, i) => {
  if (i === 0) return;
  const dA = r.moities.A[i].vainqueur - base.A.vainqueur;
  const dB = r.moities.B[i].vainqueur - base.B.vainqueur;
  const verdict = dA > 0 && dB > 0 ? 'TIENT SUR LES DEUX' : dA < 0 && dB < 0 ? 'pire sur les deux' : 'ne tient pas';
  console.log(`  ${CANDIDATS[i].nom.padEnd(22)} ${s(dA).padStart(8)} pt ${s(dB).padStart(9)} pt   ${verdict}`);
});
console.log('');
