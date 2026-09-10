/**
 * RATTRAPE CE QUE LA BOUCLE D'APPRENTISSAGE N'A PAS APPRIS.
 *
 * Juge toutes les rencontres terminées encore inconnues, puis recalcule les
 * facteurs de correction par championnat. C'est exactement ce que fait la
 * tâche de 5 h 37 ; ici sans le plafond de temps de la plateforme, pour
 * résorber un arriéré d'un coup.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { jugerRencontresTerminees, recalculerCalibrages } = await import('../src/lib/calibrage.js');

// Plusieurs passages : chacun juge au plus `appelsMax * 20` rencontres, et
// libère la place pour le suivant.
for (let passe = 1; passe <= 6; passe++) {
  const j = await jugerRencontresTerminees(40);
  console.log(
    `passe ${passe} : ${j.examinees} examinée(s), ${j.jugees} jugée(s), ${j.deja} déjà connue(s)`
  );
  if (j.jugees === 0) break;
}

const c = await recalculerCalibrages();
console.log(`\ncalibrage : ${c.ligues} championnat(s) sur ${c.matchs} rencontre(s)`);
