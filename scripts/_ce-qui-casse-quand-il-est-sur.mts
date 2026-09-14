/**
 * CE QUI CASSE QUAND LE MOTEUR SE DIT TRÈS SÛR.
 *
 * Mesuré le 14 septembre 2026 sur le banc corrigé : la justesse monte avec la
 * certitude jusqu'à 70 % (69,1 %), puis REDESCEND — 66,3 % au-dessus de 80 %.
 * Un classement « les mieux cernés » bâti sur cette certitude met donc en
 * avant, tout en haut, des rencontres moins fiables que celles du milieu.
 *
 * Ce relevé dit QUOI le moteur annonce là-haut, et ce qui arrive vraiment.
 *
 *   npx tsx scripts/_ce-qui-casse-quand-il-est-sur.mts <resultat.json> [variante]
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

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const RANGS = ['domicile', 'nul', 'extérieur'];
const certitude = (p: Pronostic) => {
  const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
  return Math.max(p.probas[0], p.probas[1], p.probas[2]) / s;
};

console.log(`\nVARIANTE : ${nom}\n`);

for (const [bas, haut] of [
  [0.6, 0.65],
  [0.65, 0.7],
  [0.7, 0.75],
  [0.75, 0.8],
  [0.8, 1.01],
]) {
  const tranche = liste.filter((p) => {
    const c = certitude(p);
    return c >= bas && c < haut;
  });
  if (!tranche.length) continue;

  const justes = tranche.filter((p) => p.parScore === p.reel).length;
  console.log(
    `CERTITUDE ${(100 * bas).toFixed(0)} – ${(100 * haut).toFixed(0)} %  —  ` +
      `${tranche.length} rencontres, ${pc(justes, tranche.length)} justes`
  );

  // Ce que le moteur ANNONCE dans cette tranche.
  for (let rang = 0; rang < 3; rang++) {
    const dit = tranche.filter((p) => p.parScore === rang);
    if (!dit.length) continue;
    const ok = dit.filter((p) => p.reel === rang).length;
    // Et quand il se trompe, que se passe-t-il ?
    const rates = dit.filter((p) => p.reel !== rang);
    const detail = [0, 1, 2]
      .filter((r) => r !== rang)
      .map((r) => `${RANGS[r]} ${pc(rates.filter((p) => p.reel === r).length, rates.length)}`)
      .join(', ');
    console.log(
      `    annonce ${RANGS[rang].padEnd(9)} ${String(dit.length).padStart(5)} fois  →  ${pc(ok, dit.length).padStart(6)} justes` +
        (rates.length ? `   (les ratés : ${detail})` : '')
    );
  }

  // Le nul est-il annonce ici ? Et arrive-t-il ?
  const nulsReels = tranche.filter((p) => p.reel === 1).length;
  const nulsDits = tranche.filter((p) => p.parScore === 1).length;
  console.log(
    `    le nul arrive ${pc(nulsReels, tranche.length)} du temps, il est annoncé ${pc(nulsDits, tranche.length)}\n`
  );
}
