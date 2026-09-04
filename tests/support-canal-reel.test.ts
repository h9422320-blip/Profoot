/**
 * ★ ACQUIS — LA PAGE D'AIDE NE PROMET QUE DES CANAUX QUI EXISTENT.
 *
 * ── CE QU'ELLE ANNONÇAIT ──────────────────────────────────────────────────
 *
 *     Chat en direct
 *     Parle directement avec notre équipe support.
 *     Réponse rapide pendant les heures ouvrables.
 *     Ouvrir le chat →
 *
 * Le clic appelait `window.Tawk_API.toggle()`. Vérifié le 4 septembre 2026 :
 * le composant `TawkToChat` existe dans le dépôt mais n'est monté par AUCUNE
 * page. `Tawk_API` valait donc toujours `undefined`, et le clic retombait sur
 * un `mailto:` — qui, sur un téléphone sans application de courrier
 * configurée, ne fait rigoureusement rien.
 *
 * ── POURQUOI CE N'EST PAS UN DÉTAIL ──────────────────────────────────────
 *
 * Cette carte se lit au pire moment. Sur la boutique, trois avis du 28 août
 * disent « Je deja paye », « Ya quoi », « J'ai payé déjà ». Ces personnes
 * cherchaient quelqu'un à qui parler ; on leur montrait une porte peinte sur
 * un mur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const support = sansCommentaires(lire('src/app/support/page.tsx'));

test('★ ACQUIS — aucune promesse de chat en direct', () => {
  assert.doesNotMatch(support, /Chat en direct/i, 'La page promet de nouveau un chat en direct.');
  assert.doesNotMatch(support, /Ouvrir le chat/i, 'Le bouton de chat est revenu.');
});

test('★ ACQUIS — la page n’appelle pas une bibliothèque absente', () => {
  // Tant que « TawkToChat » n'est monté nulle part, l'appeler ne peut que
  // retomber sur un repli silencieux.
  assert.doesNotMatch(support, /Tawk_API/, 'La page appelle de nouveau Tawk, qui n’est chargé nulle part.');
});

test('★ ACQUIS — si le chat revient, il doit d’abord être monté', () => {
  // Ce test tombe le jour où quelqu'un remet une promesse de chat sans avoir
  // monté le composant qui la tient.
  const monte = fs
    .readdirSync(path.join(process.cwd(), 'src'), { recursive: true })
    .filter((f) => typeof f === 'string' && /\.(tsx|ts)$/.test(f as string))
    .some((f) => {
      const chemin = path.join('src', f as string);
      if (chemin.endsWith(path.join('components', 'TawkToChat.tsx'))) return false;
      return lire(chemin).includes('TawkToChat');
    });
  if (!monte) {
    assert.doesNotMatch(
      support,
      /Tawk|Chat en direct/i,
      'La page promet un chat alors que le composant n’est monté nulle part.'
    );
  }
});

test('★ ACQUIS — le canal restant dit quoi écrire pour être retrouvé', () => {
  // Un message d'aide sans l'adresse ayant servi à payer oblige à un
  // aller-retour, et c'est un jour de plus sans accès.
  assert.match(support, /contactprofootai@gmail\.com/, 'L’adresse de contact a disparu.');
  assert.match(
    support,
    /adresse e-mail utilisée pour payer/i,
    'La page ne demande plus l’adresse qui permet de retrouver l’achat.'
  );
});
