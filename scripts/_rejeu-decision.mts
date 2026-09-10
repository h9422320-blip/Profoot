/**
 * BANC DE REJEU DE LA COUCHE DE DÉCISION.
 *
 * ── CE QU'IL MESURE, ET POURQUOI IL EST HONNÊTE ───────────────────────────
 *
 * Il ne réimplémente PAS le moteur. Il part des BUTS ATTENDUS que le moteur a
 * réellement produits en production — relevés dans `jugements_moteur`, à côté
 * du résultat réel de la rencontre — et ne rejoue que la dernière étape : la
 * grille de scores, les trois probabilités, et l'issue annoncée.
 *
 * C'est exactement la couche où se décide ce que le propriétaire regarde :
 * « quand l'application dit que cette équipe gagne, est-ce qu'elle gagne ».
 *
 * Le banc `banc-large.mjs` porte un avertissement en toutes lettres : il est
 * une COPIE du calcul des forces, et peut donc mesurer autre chose que la
 * production sans que rien ne le signale. Ici il n'y a pas de copie : les
 * buts attendus sont ceux de la production, pas une reconstitution.
 *
 * ── LA DISCIPLINE ─────────────────────────────────────────────────────────
 *
 * Les rencontres sont rangées par date. La première moitié sert à CHERCHER,
 * la seconde à VÉRIFIER — et la seconde est coupée en deux périodes, parce
 * qu'un réglage qui gagne sur l'une et perd sur l'autre n'a rien trouvé.
 *
 * Un réglage n'est retenu que s'il gagne sur LES DEUX périodes de
 * vérification. C'est ce critère qui a fait rejeter l'inflation des nuls, le
 * calibrage par championnat et la formule à poids libres.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

// ── LA COUCHE DE DÉCISION, AU CARACTÈRE PRÈS ───────────────────────────────
//
// Recopiée de `score-probable.ts`. Toute divergence se verrait immédiatement
// dans le contrôle de fidélité imprimé en premier.
const BUTS_MAX = 8;
const CORRECTION_PETITS_SCORES = -0.1;
const AIGUISAGE = 1.15;

function poisson(k: number, lambda: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
}

function correction(i: number, j: number, l1: number, l2: number): number {
  if (i === 0 && j === 0) return 1 - l1 * l2 * CORRECTION_PETITS_SCORES;
  if (i === 0 && j === 1) return 1 + l1 * CORRECTION_PETITS_SCORES;
  if (i === 1 && j === 0) return 1 + l2 * CORRECTION_PETITS_SCORES;
  if (i === 1 && j === 1) return 1 - CORRECTION_PETITS_SCORES;
  return 1;
}

/** Les trois pourcentages affichés, et l'issue annoncée. */
function decider(
  l1: number,
  l2: number,
  aiguisage = AIGUISAGE
): { pv1: number; pn: number; pv2: number; issue: 'domicile' | 'nul' | 'exterieur' } {
  const p1 = Array.from({ length: BUTS_MAX + 1 }, (_, i) => poisson(i, l1));
  const p2 = Array.from({ length: BUTS_MAX + 1 }, (_, j) => poisson(j, l2));

  let v1 = 0, n = 0, v2 = 0;
  for (let i = 0; i <= BUTS_MAX; i++)
    for (let j = 0; j <= BUTS_MAX; j++) {
      const p = p1[i] * p2[j] * correction(i, j, l1, l2);
      if (i > j) v1 += p;
      else if (i === j) n += p;
      else v2 += p;
    }

  if (aiguisage !== 1) {
    const q = [v1, n, v2].map((x) => Math.pow(Math.max(1e-9, x), aiguisage));
    const t = q[0] + q[1] + q[2];
    if (t > 0) { v1 = q[0] / t; n = q[1] / t; v2 = q[2] / t; }
  }

  let pv1 = Math.round(v1 * 100);
  let pn = Math.round(n * 100);
  let pv2 = Math.round(v2 * 100);
  const reste = 100 - (pv1 + pn + pv2);
  if (reste !== 0) {
    if (pv1 >= pn && pv1 >= pv2) pv1 += reste;
    else if (pv2 >= pn) pv2 += reste;
    else pn += reste;
  }

  const issue = pn >= pv1 && pn >= pv2 ? 'nul' : pv1 >= pv2 ? 'domicile' : 'exterieur';
  return { pv1, pn, pv2, issue };
}

// ── LA MATIÈRE ─────────────────────────────────────────────────────────────
const tous: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb
    .from('jugements_moteur')
    .select(
      'date_match, ligue, buts_attendus_domicile, buts_attendus_exterieur, ' +
        'buts_reels_domicile, buts_reels_exterieur, issue_prevue, issue_reelle, ' +
        'proba_domicile, proba_nul, proba_exterieur'
    )
    .range(de, de + 999);
  tous.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const matiere = tous
  .filter(
    (j) =>
      j.buts_attendus_domicile != null &&
      j.buts_attendus_exterieur != null &&
      Number(j.buts_attendus_domicile) > 0 &&
      Number(j.buts_attendus_exterieur) > 0 &&
      j.date_match
  )
  .map((j) => ({
    date: String(j.date_match),
    ligue: String(j.ligue ?? ''),
    l1: Number(j.buts_attendus_domicile),
    l2: Number(j.buts_attendus_exterieur),
    reelle: String(j.issue_reelle) as 'domicile' | 'nul' | 'exterieur',
    annonceeEnProd: String(j.issue_prevue),
    probasEnProd: [Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur)],
  }))
  .sort((a, b) => a.date.localeCompare(b.date));

console.log(`${matiere.length} rencontres rejouables, du ${matiere[0].date.slice(0, 10)} au ${matiere[matiere.length - 1].date.slice(0, 10)}\n`);

// ── CONTRÔLE DE FIDÉLITÉ ───────────────────────────────────────────────────
//
// Si le rejeu ne retrouve pas ce que la production a annoncé, il ne mesure pas
// la production et tout ce qui suit est sans valeur.
let memeIssue = 0;
let ecartProbaTotal = 0;
for (const m of matiere) {
  const d = decider(m.l1, m.l2);
  if (d.issue === m.annonceeEnProd) memeIssue++;
  ecartProbaTotal += Math.abs(d.pv1 - m.probasEnProd[0]);
}
console.log('=== FIDÉLITÉ DU REJEU ===');
console.log(`  même issue que la production : ${((100 * memeIssue) / matiere.length).toFixed(1)} %`);
console.log(`  écart moyen sur la proba domicile : ${(ecartProbaTotal / matiere.length).toFixed(1)} points\n`);

// ── LES TROIS PÉRIODES ─────────────────────────────────────────────────────
const moitie = Math.floor(matiere.length / 2);
const A = matiere.slice(0, moitie);
const B1 = matiere.slice(moitie, moitie + Math.floor((matiere.length - moitie) / 2));
const B2 = matiere.slice(moitie + Math.floor((matiere.length - moitie) / 2));

console.log(
  `apprentissage A : ${A.length} (${A[0].date.slice(0, 10)} → ${A[A.length - 1].date.slice(0, 10)})\n` +
    `vérification B1 : ${B1.length} (${B1[0].date.slice(0, 10)} → ${B1[B1.length - 1].date.slice(0, 10)})\n` +
    `vérification B2 : ${B2.length} (${B2[0].date.slice(0, 10)} → ${B2[B2.length - 1].date.slice(0, 10)})\n`
);

/** Taux d'issue juste d'un réglage sur un lot. */
function justesse(
  lot: typeof matiere,
  penteDomicile: number,
  penteExterieur: number,
  aiguisage = AIGUISAGE
): number {
  let justes = 0;
  for (const m of lot) {
    const d = decider(m.l1 * penteDomicile, m.l2 * penteExterieur, aiguisage);
    if (d.issue === m.reelle) justes++;
  }
  return (100 * justes) / Math.max(1, lot.length);
}

const SOCLE = { d: 1, e: 1 };
const socleA = justesse(A, 1, 1);
const socleB1 = justesse(B1, 1, 1);
const socleB2 = justesse(B2, 1, 1);
console.log('=== LE SOCLE, TEL QUEL ===');
console.log(`  A ${socleA.toFixed(2)} %   B1 ${socleB1.toFixed(2)} %   B2 ${socleB2.toFixed(2)} %\n`);

// ── LA PENTE DU TERRAIN ────────────────────────────────────────────────────
//
// Le moteur annonce 2 413 victoires à domicile pour 1 663 réelles : +45 %. On
// cherche de combien il faut retenir l'avantage du terrain, et l'on vérifie
// que ce n'est pas un hasard de la première moitié.
console.log('=== CHERCHER SUR A : retenir l’avantage du terrain ===');
const essais: { nom: string; d: number; e: number; a: number }[] = [];
for (const d of [1, 0.97, 0.94, 0.91, 0.88, 0.85]) {
  for (const e of [1, 1.03, 1.06, 1.09]) {
    if (d === 1 && e === 1) continue;
    essais.push({ nom: `domicile ×${d}  extérieur ×${e}`, d, e, a: justesse(A, d, e) });
  }
}
essais.sort((x, y) => y.a - x.a);
for (const t of essais.slice(0, 8)) {
  console.log(`  ${t.nom.padEnd(30)} A ${t.a.toFixed(2)} %  (socle ${socleA.toFixed(2)} %)`);
}

console.log('\n=== VÉRIFIER LES CINQ MEILLEURS SUR B1 ET B2 ===');
for (const t of essais.slice(0, 5)) {
  const b1 = justesse(B1, t.d, t.e);
  const b2 = justesse(B2, t.d, t.e);
  const verdict =
    b1 > socleB1 && b2 > socleB2
      ? 'RETENU — gagne sur les deux'
      : b1 > socleB1 || b2 > socleB2
        ? 'rejeté — ne gagne que sur une'
        : 'rejeté — perd partout';
  console.log(
    `  ${t.nom.padEnd(30)} B1 ${b1.toFixed(2)} % (${(b1 - socleB1 >= 0 ? '+' : '') + (b1 - socleB1).toFixed(2)})` +
      `  B2 ${b2.toFixed(2)} % (${(b2 - socleB2 >= 0 ? '+' : '') + (b2 - socleB2).toFixed(2)})  ${verdict}`
  );
}

// ── L'AIGUISAGE ────────────────────────────────────────────────────────────
console.log('\n=== L’AIGUISAGE (resserrement des probabilités) ===');
for (const a of [1, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4]) {
  console.log(
    `  aiguisage ${String(a).padEnd(5)} A ${justesse(A, 1, 1, a).toFixed(2)} %   ` +
      `B1 ${justesse(B1, 1, 1, a).toFixed(2)} %   B2 ${justesse(B2, 1, 1, a).toFixed(2)} %`
  );
}

// ── NE JAMAIS ANNONCER LE NUL ──────────────────────────────────────────────
//
// Les nuls annoncés ne réussissent qu'à 26,5 %. Que gagnerait-on à annoncer,
// sur ces rencontres, la meilleure des deux victoires ?
console.log('\n=== SUR LES RENCONTRES OÙ LE NUL SORT EN TÊTE ===');
for (const [nom, lot] of [['A', A], ['B1', B1], ['B2', B2]] as [string, typeof matiere][]) {
  const nuls = lot.filter((m) => decider(m.l1, m.l2).issue === 'nul');
  const justesNul = nuls.filter((m) => m.reelle === 'nul').length;
  const justesSiVictoire = nuls.filter((m) => {
    const d = decider(m.l1, m.l2);
    return m.reelle === (d.pv1 >= d.pv2 ? 'domicile' : 'exterieur');
  }).length;
  console.log(
    `  ${nom} : ${String(nuls.length).padStart(4)} rencontres — ` +
      `en annonçant le nul ${((100 * justesNul) / Math.max(1, nuls.length)).toFixed(1)} %, ` +
      `en annonçant la meilleure victoire ${((100 * justesSiVictoire) / Math.max(1, nuls.length)).toFixed(1)} %`
  );
}
void SOCLE;
