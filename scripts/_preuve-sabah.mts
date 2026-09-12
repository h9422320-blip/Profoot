/**
 * LE CAS SABAH, AVANT ET APRÈS LA MÉMOIRE DES CLUBS. Lecture seule.
 *
 * Le 10 septembre 2026, l'application a annoncé Manchester United 0-3 Sabah,
 * 66 % pour Sabah. Résultat réel : 4-0 pour Manchester United. Dix abonnés
 * l'ont vu.
 *
 * La cause : Sabah (Azerbaïdjan) n'est pas dans le relevé des tirs, et un seul
 * club absent suffit à annuler TOUTE la moitié occasions du calcul.
 *
 * Ce script rejoue la rencontre avec exactement ce qui était connu la veille,
 * sans la mémoire puis avec, et montre l'écart.
 *
 *   npx tsx scripts/_preuve-sabah.mts [nom du club adverse]
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES } from './challenger/commun.mjs';

chargerEnv();
const { calculerScoreProbable } = await import('../src/lib/score-probable.js');
const { calculerMemoireClubs, avisDeLaMemoire } = await import('../src/lib/memoire-clubs.js');

const cherche = (process.argv[2] ?? 'sabah').toLowerCase();
const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
rencontres.sort((a, b) => a.date.localeCompare(b.date));

const match = rencontres.find(
  (m) => String(m.nomDom).toLowerCase().includes(cherche) || String(m.nomExt).toLowerCase().includes(cherche)
    ? String(m.nomDom).toLowerCase().includes('manchester united') || String(m.nomExt).toLowerCase().includes('manchester united')
    : false
);
if (!match) {
  console.log(`rencontre introuvable pour « ${cherche} »`);
  process.exit(1);
}

// Les statistiques de la compétition AVANT le match, comme les lit le moteur.
const statsAvant = (equipe: number) => {
  let bm = 0, be = 0, n = 0;
  for (const x of rencontres) {
    if (x.ligue !== match.ligue || x.saison !== match.saison || x.date >= match.date) continue;
    if (x.dom === equipe) { bm += x.bd; be += x.be; n++; }
    else if (x.ext === equipe) { bm += x.be; be += x.bd; n++; }
  }
  return { butsMarques: bm, butsEncaisses: be, matchsJoues: n };
};

// La mémoire telle qu'elle était la VEILLE : aucun match du jour ni d'après.
const veille = match.date.slice(0, 10);
const { lireHierarchieDirect } = await import('./challenger/commun.mjs');
const hierarchie = await lireHierarchieDirect();
console.log(hierarchie ? `hiérarchie lue : ${Object.keys(hierarchie.coefficients).length} championnats` : 'hiérarchie ILLISIBLE');
const memoire = calculerMemoireClubs(rencontres.filter((m) => m.date.slice(0, 10) < veille), {
  coefficients: hierarchie?.coefficients ?? null,
});

const s1 = statsAvant(match.dom);
const s2 = statsAvant(match.ext);
// La part est réglable : la mémoire pèse davantage quand le moteur a peu de
// matchs dans la compétition (voir la couche à poids variable).
const part = Number(process.argv[3]);
const avis = avisDeLaMemoire(memoire, match.dom, match.ext, Number.isFinite(part) && part > 0 ? part : undefined);
console.log(`part de la mémoire : ${avis ? avis.poids : "—"}`);

const sans: any = calculerScoreProbable(s1 as any, s2 as any, true, false, undefined, null, undefined, false, 1, null);
const avec: any = calculerScoreProbable(s1 as any, s2 as any, true, false, undefined, null, undefined, false, 1, null, null, avis);

const pc = (x: any) => `${Number(x).toFixed(1)} %`;
console.log(`${match.nomDom} — ${match.nomExt}, le ${veille} (compétition ${match.ligue})`);
console.log(`résultat réel : ${match.bd}-${match.be}\n`);
console.log(`notes de la mémoire : ${match.nomDom} ${Math.round(Number(memoire.notes[String(match.dom)]))}, ${match.nomExt} ${Math.round(Number(memoire.notes[String(match.ext)]))}`);
console.log(`statistiques connues : ${match.nomDom} ${s1.matchsJoues} match(s), ${match.nomExt} ${s2.matchsJoues} match(s)\n`);
const ligne = (titre: string, r: any) =>
  console.log(
    `${titre.padEnd(28)} score ${r.buts1}-${r.buts2}   ` +
      `${match.nomDom} ${pc(r.probaVictoire1).padStart(7)} | nul ${pc(r.probaNul).padStart(7)} | ${match.nomExt} ${pc(r.probaVictoire2).padStart(7)}`
  );
ligne('AVANT (sans la mémoire)', sans);
ligne('APRÈS (avec la mémoire)', avec);
const justeAvant = (match.bd > match.be && sans.buts1 > sans.buts2) || (match.bd < match.be && sans.buts1 < sans.buts2) || (match.bd === match.be && sans.buts1 === sans.buts2);
const justeApres = (match.bd > match.be && avec.buts1 > avec.buts2) || (match.bd < match.be && avec.buts1 < avec.buts2) || (match.bd === match.be && avec.buts1 === avec.buts2);
console.log(`\nvainqueur trouvé — avant : ${justeAvant ? 'OUI' : 'NON'} | après : ${justeApres ? 'OUI' : 'NON'}`);
