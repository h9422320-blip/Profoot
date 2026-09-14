/**
 * CE QUE LE CHANGEMENT DU NUL A CHANGE, CAS PAR CAS.
 *
 * Le 14 septembre 2026, `ECART_NON_DEPARTAGE` est passe de 2 a 1 : le nul
 * n est plus annonce quand un ou deux points separent les deux victoires, mais
 * seulement quand elles sont strictement egales.
 *
 * Ce relevé rejoue les 4 096 combinaisons du balayage avec l ancien reglage et
 * le nouveau, et montre CE QUI CHANGE. Trente-huit combinaisons, toutes d un
 * nul vers un vainqueur. Aucune ne va dans l autre sens, et aucune ne touche un
 * cas ou les deux victoires sont a egalite.
 *
 *   npx tsx scripts/_preuve-nul.mts
 */
import { calculerScoreProbable } from '../src/lib/score-probable';

const pas = [0.6, 0.9, 1.1, 1.3, 1.5, 1.8, 2.1, 2.5];
const eq = (m: number, e: number) => ({
  butsMarques: Math.round(m * 20),
  butsEncaisses: Math.round(e * 20),
  matchsJoues: 20,
});

const cas: { p: string; avant: string; apres: string }[] = [];
for (const m1 of pas)
  for (const e1 of pas)
    for (const m2 of pas)
      for (const e2 of pas) {
        process.env.BANC_ECART_NUL = '2';
        const avant: any = calculerScoreProbable(eq(m1, e1), eq(m2, e2), true);
        delete process.env.BANC_ECART_NUL;
        const apres: any = calculerScoreProbable(eq(m1, e1), eq(m2, e2), true);
        if (avant.buts1 !== apres.buts1 || avant.buts2 !== apres.buts2)
          cas.push({
            p: `${avant.probaVictoire1}/${avant.probaNul}/${avant.probaVictoire2}`,
            avant: `${avant.buts1}-${avant.buts2}`,
            apres: `${apres.buts1}-${apres.buts2}`,
          });
      }

console.log(`\n  rencontres changees sur 4096 combinaisons : ${cas.length}\n`);
for (const c of cas.slice(0, 8))
  console.log(`  probabilites ${c.p.padEnd(12)}  avant ${c.avant}   maintenant ${c.apres}`);
console.log('');
