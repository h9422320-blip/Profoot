/**
 * OÙ LE MOTEUR EST AVEUGLE, ET COMBIEN ÇA LUI COÛTE.
 *
 * Mesurer une justesse moyenne ne dit pas où chercher. Ce relevé découpe les
 * 17 985 rencontres du banc selon CE QUE LE MOTEUR AVAIT SOUS LA MAIN avant le
 * coup d'envoi — le relèvement des tirs, les forces ajustées à l'adversaire,
 * l'avis de la mémoire des clubs, et l'épaisseur de la saison en cours.
 *
 * Une tranche nombreuse et mauvaise est une cible. Une tranche mauvaise mais
 * rare ne vaut pas une couche.
 *
 *   npx tsx scripts/_ou-le-moteur-est-aveugle.mts <resultat.json> [variante]
 */
import fs from 'node:fs';
import type { Pronostic } from './challenger/porte.js';

const res: {
  variantes: Record<string, Pronostic[]>;
  contexte?: Record<string, [number, number, number, number]>;
} = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const nom = process.argv[3] ?? Object.keys(res.variantes)[0];
const liste = res.variantes[nom];
if (!liste?.length) {
  console.log(`variante introuvable. Disponibles : ${Object.keys(res.variantes).join(' | ')}`);
  process.exit(1);
}
if (!res.contexte) {
  console.log('ce résultat ne porte pas le contexte — relancer `evaluer.mts` avec la version du 14 septembre 2026.');
  process.exit(1);
}

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const certitude = (p: Pronostic) => {
  const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
  return Math.max(p.probas[0], p.probas[1], p.probas[2]) / s;
};

type Case = { n: number; justes: number; surs: number; sursJustes: number };
const vide = (): Case => ({ n: 0, justes: 0, surs: 0, sursJustes: 0 });

function grouper(nomGroupe: string, cle: (p: Pronostic, c: [number, number, number, number]) => string | null) {
  const cases = new Map<string, Case>();
  for (const p of liste) {
    const c = res.contexte![String(p.id)];
    if (!c) continue;
    const k = cle(p, c);
    if (k === null) continue;
    const x = cases.get(k) ?? vide();
    x.n++;
    if (p.parScore === p.reel) x.justes++;
    if (certitude(p) >= 0.6) {
      x.surs++;
      if (p.probas.indexOf(Math.max(...p.probas)) === p.reel) x.sursJustes++;
    }
    cases.set(k, x);
  }
  console.log(`\n${nomGroupe}`);
  console.log('  tranche                          rencontres   justes   mises en avant   justes alors');
  for (const [k, x] of [...cases].sort((a, b) => b[1].n - a[1].n))
    console.log(
      `  ${k.padEnd(32)} ${String(x.n).padStart(6)}   ${pc(x.justes, x.n).padStart(6)}   ` +
        `${String(x.surs).padStart(9)} (${pc(x.surs, x.n).padStart(6)})   ${pc(x.sursJustes, x.surs).padStart(6)}`
    );
}

console.log(`\nVARIANTE : ${nom} — ${liste.length} rencontres rejouées`);

grouper('CE QUE LE MOTEUR VOYAIT', (_p, c) => {
  const morceaux: string[] = [];
  morceaux.push(c[0] ? 'tirs' : 'pas de tirs');
  morceaux.push(c[1] ? 'forces' : 'pas de forces');
  return morceaux.join(' + ');
});

grouper('L’AVIS DE LA MÉMOIRE', (_p, c) => (c[2] ? 'la mémoire parle' : 'la mémoire se tait'));

grouper('L’ÉPAISSEUR DE LA SAISON (le moins vu des deux clubs)', (_p, c) => {
  const j = c[3];
  if (j <= 2) return 'moins de 3 rencontres';
  if (j <= 5) return '3 à 5 rencontres';
  if (j <= 10) return '6 à 10 rencontres';
  if (j <= 20) return '11 à 20 rencontres';
  return 'plus de 20 rencontres';
});

grouper('LE CAMP ANNONCÉ', (p) => (p.parScore === 0 ? 'le club qui reçoit' : p.parScore === 1 ? 'le nul' : 'le visiteur'));
