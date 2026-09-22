/**
 * CHAQUE NUIT : LES DIVISIONS INFÉRIEURES ENTRENT DANS LA HIÉRARCHIE ET DANS
 * LA MÉMOIRE DES CLUBS.
 *
 * Mis en ligne le 21 septembre 2026 après mesure (voir `etendreHierarchie`) :
 *
 *   coupes nationales, 1 560 matchs      +14 / +2 vainqueurs, trois tranches +5 +7 +4
 *   compétitions déjà servies, 22 674    +12 / +10, Brier égal
 *
 * Trois gestes, dans cet ordre :
 *   1. relever la saison en cours des divisions inférieures et des coupes
 *      nationales (les saisons closes sont gardées) ;
 *   2. étendre la hiérarchie publiée — ses championnats d'origine FIGÉS — et
 *      la ranger sous la même clé ;
 *   3. recalculer la mémoire des clubs avec ces rencontres, ancrée sur la
 *      hiérarchie étendue, et la ranger.
 *
 * Un échec laisse en ligne ce qui y était : chaque réserve n'est écrite que si
 * son calcul a abouti.
 *
 *   npx tsx scripts/challenger/elargissement.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chargerEnv, DOSSIER } from './commun.mjs';
chargerEnv();

export async function elargir(): Promise<string[]> {
  const lignes: string[] = [];
  const { ramasserInferieures, FICHIER_INFERIEURES, COUPES_NATIONALES } = await import('./rencontres-inferieures.mjs');
  const { etendreHierarchie, rangerForcesChampionnats, saisonsRecentes } = await import('../../src/lib/forces-championnats.js');
  const { calculerMemoireClubs, rangerMemoireClubs } = await import('../../src/lib/memoire-clubs.js');
  const { lireReservePatiemment } = await import('../../src/lib/api-football.js');

  const collecte = await ramasserInferieures();
  lignes.push(`${collecte.rencontres} rencontres de divisions inférieures et de coupes nationales (${collecte.appels} appels).`);

  const base: any = await lireReservePatiemment('forces-championnats:v1', 15_000);
  if (!base?.coefficients) {
    lignes.push('⚠️ Hiérarchie en ligne illisible : rien n’est étendu, rien n’est réécrit.');
    return lignes;
  }
  const coupes = COUPES_NATIONALES.map((c: any) => c.id);
  const saisons = new Set(saisonsRecentes());
  const principales = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'rencontres.json'), 'utf8')) as any[];
  const inferieures = Object.values(JSON.parse(fs.readFileSync(FICHIER_INFERIEURES, 'utf8')).rencontres) as any[];
  const enRencontre = (m: any) => ({ date: m.date, ligue: m.ligue, dom: m.dom, ext: m.ext, butsDom: m.bd, butsExt: m.be });

  const etendue = etendreHierarchie(
    base,
    [...principales, ...inferieures].filter((m) => saisons.has(Number(m.saison))).map(enRencontre),
    coupes
  );
  // Garde-fou : les championnats d'origine ne doivent pas avoir bougé d'un millième.
  for (const l of etendue.championnatsDeBase) {
    if (Math.abs(Number(etendue.coefficients[l]) - Number(base.coefficients[l])) > 1e-9) {
      lignes.push(`⚠️ Le championnat ${l} a bougé pendant l’extension : rien n’est publié.`);
      return lignes;
    }
  }
  await rangerForcesChampionnats(etendue);
  lignes.push(
    `Hiérarchie étendue : ${etendue.championnatsDeBase.length} championnats d’origine figés, ` +
      `${etendue.championnatsAjoutes} divisions ajoutées.`
  );

  const memoire = calculerMemoireClubs([...principales, ...inferieures] as any, {
    coefficients: etendue.coefficients,
    coupesEnPlus: coupes,
  });
  if (memoire.clubs < 1000) {
    lignes.push(`⚠️ Mémoire des clubs suspecte (${memoire.clubs} clubs) : celle en ligne est conservée.`);
    return lignes;
  }
  await rangerMemoireClubs(memoire);
  lignes.push(`Mémoire des clubs : ${memoire.clubs} clubs sur ${memoire.rencontres} rencontres, ${memoire.championnatsAncres} championnats ancrés.`);
  return lignes;
}

if (path.basename(process.argv[1] ?? '') === 'elargissement.mts') {
  for (const l of await elargir()) console.log('[ÉLARGISSEMENT]', l);
}
