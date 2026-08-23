import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/** Découpe en lignes, quel que soit le style de fin de ligne du fichier. */
const SAUTS = /\r?\n/;

/**
 * Le code seul, commentaires retirés.
 *
 * Les commentaires de ces routes CITENT la faille corrigée — « vercel-cron »
 * y figure à dessein, pour expliquer ce qui était accepté autrefois. Les
 * chercher dans le fichier entier ferait échouer le test sur sa propre
 * explication.
 */
function codeSeul(source: string): string {
  return source
    .split(SAUTS)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join(' ');
}

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
    const debutRoute = src.indexOf('export async function');
    assert.ok(
      src.indexOf('estAdmin(') < src.indexOf(depense, debutRoute),
      `${chemin} : le contrôle d'administrateur arrive APRÈS l'appel payant. ` +
        "L'argent est dépensé avant que la porte soit refermée."
    );
  }
});

test('★ ACQUIS — le refus est explicite, jamais un contenu partiel', () => {
  const src = lire('src/app/api/diagnostic/modeles/route.ts');
  const bloc = src.slice(
    src.indexOf('export async function GET'),
    src.indexOf('OPENROUTER_API_KEY absente')
  );

  assert.ok(
    /status:\s*403/.test(bloc),
    'Le refus ne renvoie plus 403. Un code de succès laisserait croire que la ' +
      'route a fonctionné, et masquerait la protection.'
  );
});

/**
 * UNE TÂCHE PLANIFIÉE NE S'OUVRE PAS SUR UN EN-TÊTE QU'ON PEUT ÉCRIRE.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 23 AOÛT 2026 ───────────────────────────────────
 *
 * Les deux routes portaient ce raisonnement : si `CRON_SECRET` n'est pas
 * configuré, accepter tout appel dont le `user-agent` contient « vercel-cron ».
 *
 * Vérifié en production : sans en-tête, 401 ; avec `-A "vercel-cron/1.0"`, la
 * route se mettait à travailler. Or `cron/refresh` consomme le quota du
 * fournisseur de données football — la ressource la plus rare du projet, qui a
 * frôlé les 100 % le 16 août. Au-delà, plus aucune analyse pour personne.
 */
test('★ ACQUIS — aucune tâche planifiée ne s ouvre sur un user-agent', () => {
  for (const chemin of [
    'src/app/api/cron/refresh/route.ts',
    'src/app/api/cron/audit/route.ts',
  ]) {
    const code = codeSeul(lire(chemin));

    assert.ok(
      !/vercel-cron/.test(code),
      `${chemin} accepte de nouveau un appel sur la foi du user-agent. ` +
        "C'est une chaîne que n'importe qui écrit en trois secondes."
    );

    assert.ok(
      /autoriserCron\(/.test(code),
      `${chemin} n'utilise plus le gardien commun : le contrôle a été réécrit ` +
        'sur place, hors de portée de ce test.'
    );
  }
});

test('★ ACQUIS — sans CRON_SECRET, la porte est fermée, pas ouverte', () => {
  const garde = lire('src/lib/garde-cron.ts');

  // Le point exact du défaut : l'absence de secret refusait-elle, ou ouvrait-elle ?
  const bloc = garde.slice(garde.indexOf('if (!secret)'), garde.indexOf('const fourni'));

  assert.ok(
    /autorise: false/.test(bloc),
    "L'absence de CRON_SECRET n'entraîne plus un refus. C'était exactement la " +
      'faille : pas de secret configuré, donc porte ouverte.'
  );

  // Et le refus doit rester bruyant : une tâche muette qui ne part pas est
  // indétectable — c'est ce qui a laissé le mur de preuves figé des jours.
  assert.ok(
    /console\.error/.test(bloc),
    'Le refus faute de secret est redevenu silencieux. Une tâche qui ne part pas ' +
      "sans rien écrire nulle part ne se découvre qu'en constatant les dégâts."
  );
});
