import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ★ ACQUIS — LA PAGE « IA CENTER » NE REVIENT PAS CÔTÉ UTILISATEUR.
 *
 * ── POURQUOI ELLE A ÉTÉ RETIRÉE LE 24 AOÛT 2026 ───────────────────────────
 *
 * Elle n'était liée depuis nulle part — absente du menu, absente de toute
 * page — mais elle n'était protégée que par la CONNEXION, pas par le droit
 * d'administrer. N'importe quel compte qui tapait l'adresse y entrait.
 *
 * Ce qu'elle montrait n'avait rien de confidentiel — précision réelle, score
 * exact, pronostics vérifiés et en attente — et ces quatre chiffres vivent
 * déjà sur /admin/system, accompagnés de l'écart entre la confiance affichée
 * et la précision constatée, que la page publique ne montrait pas.
 *
 * Ce qu'elle affichait à côté était plus gênant : « plus de 50 sources »,
 * « 200 variables par match », « compositions, blessures, conditions météo ».
 * Le moteur n'a jamais lu la météo. Ces phrases décrivaient un produit qui
 * n'existe pas, à des abonnés qui paient.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * Qu'aucune route ne réapparaisse côté utilisateur, et qu'aucun lien ne
 * pointe vers elle. Le contenu reste dans l'historique de Git : il n'est pas
 * perdu, il n'est plus servi.
 */

const RACINE = join(process.cwd(), 'src');

test('★ ACQUIS — aucune route « ia-center » côté utilisateur', () => {
  for (const chemin of [
    'app/(dashboard)/ia-center',
    'app/ia-center',
    'app/(public)/ia-center',
  ]) {
    assert.equal(
      existsSync(join(RACINE, chemin)),
      false,
      `La route ${chemin} est revenue. Elle n'était protégée que par la ` +
        'connexion : tout compte qui tape l’adresse y entre. Ses chiffres sont ' +
        'déjà sur /admin/system.'
    );
  }
});

test('★ ACQUIS — aucun lien ne mène à « ia-center »', () => {
  const fautifs: string[] = [];

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const complet = join(dossier, entree);
      if (statSync(complet).isDirectory()) {
        parcourir(complet);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entree)) continue;

      const src = readFileSync(complet, 'utf8');
      // Les lignes de commentaire expliquent le retrait : elles ne mènent
      // nulle part et ne doivent pas faire échouer l'épreuve.
      const lignes = src.split('\n').filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      });
      if (lignes.join('\n').includes('ia-center')) {
        fautifs.push(complet.replace(process.cwd(), '').replace(/\\/g, '/'));
      }
    }
  };

  parcourir(RACINE);

  assert.deepEqual(
    fautifs,
    [],
    `Ces fichiers mentionnent encore « ia-center » hors commentaire :\n  ${fautifs.join('\n  ')}\n` +
      'Un lien vers une page retirée mène à une erreur ; une route protégée ' +
      'qui n’existe plus n’a rien à protéger.'
  );
});

test('★ ACQUIS — les chiffres qu’elle montrait restent visibles côté admin', () => {
  const src = readFileSync(join(RACINE, 'app/admin/system/page.tsx'), 'utf8');

  for (const champ of ['precisionReelle', 'pronosticsVerifies', 'confianceIA', 'ecartConfiance']) {
    assert.ok(
      src.includes(champ),
      `/admin/system n’affiche plus « ${champ} ». Retirer la page utilisateur ` +
        'ne devait rien coûter à la mesure : ces chiffres servent à savoir si ' +
        'le moteur tient ce qu’il promet.'
    );
  }
});
