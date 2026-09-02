/**
 * ★ ACQUIS — DEUX RELANCES, PAS UNE DE PLUS.
 *
 * ── CE QUI S'EST RÉELLEMENT PASSÉ ─────────────────────────────────────────
 *
 * Le 2 septembre 2026, trois personnes ayant payé sans jamais se connecter
 * étaient relancées. L'une d'elles, mbayesaliou2024@icloud.com, avait reçu le
 * message le 31 août, le 1er septembre ET le 2 septembre. Trois fois le même
 * texte, avec le même objet.
 *
 * La règle « deux messages maximum » était écrite dans le fichier, commentée,
 * justifiée — et elle n'était pas appliquée.
 *
 * ── LE DÉFAUT, EN UNE LIGNE ───────────────────────────────────────────────
 *
 *     relance-2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-08-31-1
 *
 * Le découpage cherchait le DERNIER tiret et gardait ce qui précède :
 *
 *     2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-08-31
 *                                          ↑ la date était restée dedans
 *
 * Une clé différente chaque jour pour la même personne. Le compteur valait
 * donc toujours 1.
 *
 * ── POURQUOI C'EST PLUS GRAVE QU'UN MESSAGE DE TROP ───────────────────────
 *
 * Ces messages partent de `noreply@profootai.com`, la même adresse que les
 * liens de mot de passe et les livraisons d'accès. Le même texte tous les
 * jours à quelqu'un qui ne répond pas, c'est la définition du courrier
 * indésirable — et un seul signalement frappe le domaine entier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/relance-jamais-entres.ts'),
  'utf8'
);
const sansCommentaires = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Le découpage tel qu'il est écrit dans le fichier, rejoué ici. */
function identifiantDepuisTrace(deliveryId: string): string | null {
  const reste = deliveryId.slice('relance-'.length);
  const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const trouve = reste.match(FORME_UUID);
  return trouve ? trouve[0] : null;
}

test('★ ACQUIS — trois traces de jours différents comptent pour UNE personne', () => {
  // Les trois traces réelles de mbayesaliou2024@icloud.com.
  const traces = [
    'relance-2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-08-31-1',
    'relance-2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-09-01-1',
    'relance-2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-09-02-1',
  ];

  const compte = new Map<string, number>();
  for (const t of traces) {
    const id = identifiantDepuisTrace(t);
    if (id) compte.set(id, (compte.get(id) ?? 0) + 1);
  }

  assert.equal(compte.size, 1, 'Les trois traces sont attribuées à des personnes différentes.');
  assert.equal(
    compte.get('2a556414-5912-4a4a-a5c7-5f96f45cb54d'),
    3,
    'Le compteur ne voit pas les trois relances déjà envoyées : le plafond ne se déclenchera pas.'
  );
});

test('★ ACQUIS — l’ancien découpage est bien celui qui échouait', () => {
  // Ce test fige la démonstration du défaut. S'il tombe un jour, c'est que
  // quelqu'un a « simplifié » le découpage et rouvert la porte.
  const trace = 'relance-2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-08-31-1';
  const reste = trace.slice('relance-'.length);
  const ancien = reste.slice(0, reste.lastIndexOf('-'));

  assert.equal(
    ancien,
    '2a556414-5912-4a4a-a5c7-5f96f45cb54d-2026-08-31',
    'La démonstration du défaut ne tient plus — vérifier le format des traces.'
  );
  assert.notEqual(
    ancien,
    identifiantDepuisTrace(trace),
    'L’ancien et le nouveau découpage donnent le même résultat : la correction ne corrige rien.'
  );
});

test('★ ACQUIS — le découpage lit la FORME de l’identifiant, pas un séparateur', () => {
  assert.match(
    sansCommentaires,
    /const FORME_UUID = \/\^\[0-9a-f\]\{8\}-/,
    'Le découpage par forme a disparu.'
  );
  assert.doesNotMatch(
    sansCommentaires,
    /reste\.slice\(0, reste\.lastIndexOf\('-'\)\)/,
    'L’ancien découpage par dernier tiret est revenu : la relance repartira tous les jours.'
  );
});

test('★ ACQUIS — le plafond de deux messages est toujours écrit ET appliqué', () => {
  assert.match(sansCommentaires, /const MAX_RELANCES = 2/, 'Le plafond a disparu.');
  assert.match(
    sansCommentaires,
    /if \(envoyees >= MAX_RELANCES\) continue;/,
    'Le plafond n’est plus consulté avant l’envoi.'
  );
});

test('★ ACQUIS — une trace illisible n’est jamais comptée pour quelqu’un d’autre', () => {
  assert.equal(identifiantDepuisTrace('relance-nimportequoi-2026-09-02-1'), null);
  assert.match(
    sansCommentaires,
    /if \(!trouve\) continue;/,
    'Une trace sans identifiant reconnaissable est de nouveau comptée sous une clé inventée.'
  );
});
