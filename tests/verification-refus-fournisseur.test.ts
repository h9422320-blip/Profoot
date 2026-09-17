import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * ★ ACQUIS — UN REFUS DU FOURNISSEUR NE FAIT PLUS DISPARAÎTRE UN MATCH DU MUR.
 *
 * FC Barcelone 7-2 Racing Santander, 16 septembre 2026 : 315 analyses, un
 * pronostic juste, et aucune preuve au mur le lendemain. Le fournisseur avait
 * répondu « Too many requests » à une partie des paquets ; la vérification
 * recevait alors en silence la réponse conservée — prise pendant le match —
 * et jugeait la rencontre « pas terminée ».
 */
import { lirePaquetFrais } from '../src/lib/precision-reelle';

const REFUS = { errors: { rateLimit: 'Too many requests. You have exceeded the limit of requests per minute of your subscription.' }, response: [] };
const BARCA = { errors: [], response: [{ fixture: { id: 1570385, status: { short: 'FT' } }, goals: { home: 7, away: 2 } }] };

function fournisseur(reponses: unknown[]) {
  process.env.API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || 'cle-de-test';
  let appels = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    const corps = reponses[Math.min(appels, reponses.length - 1)];
    appels++;
    return new Response(JSON.stringify(corps), { status: 200 });
  }) as typeof fetch;
  return { appels: () => appels, rendre: () => { globalThis.fetch = original; } };
}

test('★ ACQUIS — un refus de quota est réessayé, et le vrai résultat arrive', async () => {
  const f = fournisseur([REFUS, REFUS, BARCA]);
  try {
    const r = await lirePaquetFrais(['1570385'], 1);
    assert.equal(r?.response?.[0]?.fixture?.status?.short, 'FT', 'Le refus du fournisseur fait encore passer le match pour non terminé.');
    assert.equal(f.appels(), 3);
  } finally { f.rendre(); }
});

test('★ ACQUIS — un refus persistant rend « inconnu », jamais une vieille réponse', async () => {
  const f = fournisseur([REFUS]);
  try {
    assert.equal(await lirePaquetFrais(['1570385'], 1), null, 'Un paquet refusé est jugé sur une réponse périmée.');
  } finally { f.rendre(); }
});

test('★ ACQUIS — la vérification ne passe plus par la réponse conservée', () => {
  const s = fs.readFileSync('src/lib/precision-reelle.ts', 'utf8');
  assert.match(s, /\.map\(\(paquet\) => lirePaquetFrais\(paquet\)\)/, 'La vérification relit les paquets par l’accès qui sert les réponses périmées.');
});
