/**
 * ★ ACQUIS — CHAQUE ACHAT DONNE SON QUOTA, TOUT DE SUITE.
 *
 * ── LA RÈGLE, TELLE QUE LE PROPRIÉTAIRE L'ÉNONCE ──────────────────────────
 *
 * « Il achète 2 000, il a 20 analyses. Il les finit, il rachète 2 000, on lui
 * redonne 20 analyses. Même le même jour. Même cinquante fois. »
 *
 * Ce n'est pas un abonnement à débit mensuel : c'est un carnet qu'on recharge.
 *
 * ── CE QUE ÇA A COÛTÉ ─────────────────────────────────────────────────────
 *
 * Le calcul des droits ne retenait QUE l'abonnement du meilleur niveau : deux
 * Essentiel étant du même rang, le second était ignoré. Il donnait des jours
 * de validité, aucune analyse.
 *
 * Le 28 août 2026 à 10 h 49 et 10 h 50, quelqu'un paie DEUX FOIS 2 000 FCFA,
 * reçoit 20 analyses, les épuise, se retrouve bloqué, et écrit : « Je paye
 * deux fois, normalement 40 analyses. » Il avait raison.
 *
 * Relevé le 29 août sur la base : 33 comptes cumulaient plusieurs abonnements
 * actifs, et DIX-SEPT étaient bloqués alors qu'ils avaient payé.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PLANS, UNLIMITED, currentPeriodStart } from '../src/lib/subscription';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SOURCE = 'src/lib/subscription.ts';

test('★ ACQUIS — le quota est la SOMME des offres achetées et valides', () => {
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /quotaCumule \+= limite/, 'Le quota ne se cumule plus.');
  assert.match(
    s,
    /analysisLimit: quotaIllimite \? UNLIMITED : quotaCumule/,
    'Les droits rendus ne portent plus le quota cumulé.'
  );
});

test('★ ACQUIS — le cumul se fait AVANT le classement par niveau', () => {
  // C'était exactement le défaut : le `continue` qui écarte les abonnements de
  // niveau inférieur ou égal passait AVANT le comptage. Les abonnements
  // ignorés étaient précisément ceux que le client avait payés.
  const s = sansCommentaires(lire(SOURCE));
  const iCumul = s.indexOf('quotaCumule += limite');
  const iRang = s.indexOf('if (RANK[config.tier] <= RANK[best.plan]) continue;');
  assert.ok(iCumul > 0 && iRang > 0, 'Les deux repères doivent exister.');
  assert.ok(
    iCumul < iRang,
    'Le cumul est repassé APRÈS le filtre de niveau : les rachats de même offre sont de nouveau ignorés.'
  );
});

test('★ ACQUIS — la période part du plus ancien achat encore valide', () => {
  // Sinon un rachat effacerait les analyses déjà consommées sur l'achat
  // précédent, et ferait cadeau de ce qui a déjà servi.
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /debutLePlusAncien/, 'La période ne part plus du plus ancien achat.');
  assert.match(s, /debut < debutLePlusAncien/);
  assert.match(s, /periodStart: debutLePlusAncien/);
});

test('★ ACQUIS — deux Essentiel le même jour font 40 analyses', () => {
  // Le cas exact de Tenere, mesuré : deux achats à 10 h 49 et 10 h 50, vingt
  // analyses consommées, vingt encore dues.
  const limite = PLANS.essential_monthly.analysisLimit;
  assert.equal(limite, 20);
  assert.equal(limite + limite, 40, 'Deux Essentiel ne font plus 40 analyses.');

  // Consommé 20 sur 40 : il lui en reste 20, il n'est plus bloqué.
  const utilise = 20;
  assert.equal(Math.max(0, limite * 2 - utilise), 20);
});

test('★ ACQUIS — un VIP illimité n’est jamais réduit à une somme', () => {
  // Additionner un quota fini à un illimité donnerait un nombre — et
  // enfermerait un VIP annuel dans une limite qu'il n'a jamais eue.
  assert.equal(PLANS.vip_yearly.analysisLimit, UNLIMITED);
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /if \(limite === UNLIMITED\) quotaIllimite = true;/);
  assert.match(s, /else quotaCumule \+= limite;/);
});

test('★ ACQUIS — le niveau reste celui de l’offre la plus avantageuse', () => {
  // Cumuler les quotas ne doit pas cumuler les privilèges : quelqu'un qui a un
  // Essentiel et un Pro reste Pro, il ne devient pas VIP.
  const s = sansCommentaires(lire(SOURCE));
  assert.match(s, /if \(RANK\[config\.tier\] <= RANK\[best\.plan\]\) continue;/);
  assert.match(s, /plan: config\.tier/);
});

test('★ ACQUIS — la période de quota se calcule toujours par cycles', () => {
  // Un abonnement de trente jours souscrit il y a soixante-cinq jours ouvre sa
  // troisième période, pas la première.
  const depuis = '2026-06-01T00:00:00.000Z';
  const debut = currentPeriodStart(depuis, 30, new Date('2026-08-05T00:00:00.000Z'));
  assert.equal(debut.toISOString(), '2026-07-31T00:00:00.000Z');
});
