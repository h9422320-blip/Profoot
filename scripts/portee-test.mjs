/**
 * Les deux mots du 27 août ne sont cherchés que sur les pages PUBLIQUES.
 *
 * Le fichier applique déjà ce raisonnement pour « revenus » : l'administration
 * est derrière authentification, aucun visiteur ne la voit, et la plateforme
 * de paiement encore moins. Y bannir « abonnement » demanderait de réécrire
 * cent deux libellés de tableaux de bord — au risque de les rendre illisibles —
 * pour un gain de conformité nul.
 *
 * Le vocabulaire de PARI, lui, reste interdit partout, administration comprise :
 * c'est la règle d'origine et elle ne bouge pas.
 */
import fs from 'node:fs';

const p = 'tests/conformite-vocabulaire.test.ts';
const lignes = fs.readFileSync(p, 'utf8').split(/\r?\n/);

// 1. Marquer la frontière entre pages publiques et administration.
const iAdmin = lignes.findIndex((l) => l.includes("'src/app/admin/system/page.tsx'"));
if (iAdmin < 0) { console.log('  frontière admin introuvable'); process.exit(1); }
lignes.splice(iAdmin, 0, '    // ── FRONTIÈRE : tout ce qui suit est derrière authentification ──────');

// 2. Le contrôle des deux mots ne s'applique qu'avant cette frontière.
const iCtrl = lignes.findIndex((l) => l.includes('!PROBABILITE_ET_ABONNEMENT.test(affichable)'));
if (iCtrl < 0) { console.log('  contrôle introuvable'); process.exit(1); }
lignes[iCtrl] = lignes[iCtrl].replace(
  '!PROBABILITE_ET_ABONNEMENT.test(affichable)',
  '(estAdministration(page) || !PROBABILITE_ET_ABONNEMENT.test(affichable))'
);

// 3. Le prédicat, posé juste avant la boucle.
const iBoucle = lignes.findIndex((l) => l.trim() === 'for (const page of PAGES) {');
if (iBoucle < 0) { console.log('  boucle introuvable'); process.exit(1); }
lignes.splice(iBoucle, 0,
  '  // Derrière authentification : ni un visiteur ni la plateforme de paiement',
  "  // n'y accèdent. Le vocabulaire de pari y reste interdit ; « probabilité »",
  '  // et « abonnement » y sont tolérés, comme « revenus ».',
  "  const estAdministration = (chemin) => chemin.includes('/admin/');",
  ''
);

fs.writeFileSync(p, lignes.join('\n'), 'utf8');
console.log('  portée du contrôle limitée aux pages publiques');
