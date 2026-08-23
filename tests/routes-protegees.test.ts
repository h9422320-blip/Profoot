import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * TOUTE ROUTE QUI DÉPENSE DE L'ARGENT EST FERMÉE.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 23 AOÛT 2026 ───────────────────────────────────
 *
 * `/api/diagnostic/modeles` était ouverte à tout Internet. Chaque appel lance
 * trois VRAIES analyses payantes via OpenRouter, et le paramètre `?i=` laisse
 * choisir le modèle — donc le plus cher de la liste.
 *
 * Vérifié en production : la route ne renvoyait ni 401 ni 403, elle se mettait
 * à travailler. Une boucle depuis n'importe quel ordinateur vidait le solde en
 * quelques heures — et un solde vide arrête TOUTES les analyses, pour tous les
 * abonnés. Le 19 août, trois heures de crédit épuisé ont coûté cent cinquante
 * analyses perdues.
 */
test('★ ACQUIS — les routes de diagnostic payantes exigent un administrateur', () => {
  const payantes = [
    ['src/app/api/diagnostic/modeles/route.ts', 'appelerOpenRouter'],
    ['src/app/api/diagnostic/courriel/route.ts', 'envoyerCourriel'],
    ['src/app/api/diagnostic/clarity-brut/route.ts', 'CLARITY_API_TOKEN'],
  ] as const;

  for (const [chemin, depense] of payantes) {
    const src = lire(chemin);

    assert.ok(
      /estAdmin\(/.test(src),
      `${chemin} ne contrôle plus l'administrateur, alors qu'elle appelle un ` +
        `service payant (${depense}). N'importe qui pourrait la faire tourner en boucle.`
    );

    // Le contrôle doit précéder la dépense, sinon il ne protège rien.
    assert.ok(
      src.indexOf('estAdmin(') < src.indexOf(depense, src.indexOf('export async function')),
      `${chemin} : le contrôle d'administrateur arrive APRÈS l'appel payant. ` +
        "L'argent est dépensé avant que la porte soit refermée."
    );
  }
});

test('★ ACQUIS — le refus est explicite, jamais un contenu partiel', () => {
  const src = lire('src/app/api/diagnostic/modeles/route.ts');
  const bloc = src.slice(src.indexOf('export async function GET'), src.indexOf('OPENROUTER_API_KEY absente'));

  assert.ok(
    /status:\s*403/.test(bloc),
    "Le refus ne renvoie plus 403. Un code de succès laisserait croire que la " +
      'route a fonctionné, et masquerait la protection.'
  );
});
