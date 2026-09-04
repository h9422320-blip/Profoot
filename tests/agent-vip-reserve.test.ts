/**
 * ★ ACQUIS — L'AGENT VIP APPARTIENT À L'ACCÈS ANNUEL, ET À LUI SEUL.
 *
 * ── LA RÈGLE, ET QUI L'A POSÉE ────────────────────────────────────────────
 *
 * Décision du propriétaire, le 4 septembre 2026 :
 *
 *     « L'Agent VIP n'est disponible que pour les personnes qui ont un accès
 *       VIP — celles qui paient les quinze mille francs par an. S'il paie deux
 *       mille, même cinq fois ou dix fois, il n'y a pas accès. Cinq mille
 *       pareil. »
 *
 * Le réglage lui-même vit dans la table `offres`, modifiable depuis
 * /admin/offres, et c'est très bien ainsi : un tarif ne se change pas en
 * déployant du code.
 *
 * ── ALORS POURQUOI CE FICHIER ─────────────────────────────────────────────
 *
 * Parce que la table peut être injoignable. `lireOffres()` est appelée avec un
 * `.catch(() => null)`, et le calcul des droits retombe alors sur `PLANS` :
 *
 *     vip: reglee?.agentVip ?? config.vip
 *
 * Tant que `PLANS.pro_monthly.vip` valait `true`, une simple panne de lecture
 * rouvrait l'Agent VIP à TOUS les abonnés, en silence, sans qu'aucun écran ne
 * change. C'est le poste de dépense le plus cher de l'application — chaque
 * question passe par Claude Opus — et la panne se serait vue sur la facture,
 * pas dans les journaux.
 *
 * Le repli doit donc dire la même chose que la table.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const abonnement = sansCommentaires(lire('src/lib/subscription.ts'));

// ── LE REPLI ───────────────────────────────────────────────────────────────

test('★ ACQUIS — l’Essentiel et le Pro n’ouvrent PAS l’Agent VIP en repli', () => {
  const bloc = abonnement.slice(
    abonnement.indexOf('export const PLANS'),
    abonnement.indexOf('} as const;')
  );

  const offre = (cle: string) => bloc.slice(bloc.indexOf(cle), bloc.indexOf(cle) + 260);

  assert.match(
    offre('essential_monthly'),
    /vip: false/,
    'L’Essentiel rouvre l’Agent VIP dès que la table des offres ne répond plus.'
  );
  assert.match(
    offre('pro_monthly'),
    /vip: false/,
    'Le Pro rouvre l’Agent VIP dès que la table des offres ne répond plus.'
  );
  assert.match(
    offre('vip_yearly'),
    /vip: true/,
    'L’accès annuel a perdu l’Agent VIP — c’est pourtant ce qu’il achète.'
  );
});

test('★ ACQUIS — la table des offres reste prioritaire sur le repli', () => {
  // Le propriétaire doit pouvoir rouvrir ou refermer l'Agent VIP depuis
  // /admin/offres sans déploiement. Le repli ne sert QUE quand la table se
  // tait : l'ordre des deux termes est donc l'acquis, pas leur valeur.
  assert.match(
    abonnement,
    /vip: reglee\?\.agentVip \?\? config\.vip/,
    'Le réglage de l’administration ne commande plus l’accès à l’Agent VIP.'
  );
});

// ── LA PORTE ───────────────────────────────────────────────────────────────

test('★ ACQUIS — l’Agent VIP se ferme sur le DROIT, jamais sur le nom du plan', () => {
  // Un contrôle écrit « si plan === VIP » raterait les accès offerts et tout
  // réglage venu de l'administration. Le droit calculé est le seul juge.
  assert.match(
    abonnement,
    /export async function requireVip/,
    'La garde de l’Agent VIP a disparu.'
  );
  const garde = abonnement.slice(abonnement.indexOf('export async function requireVip'));
  assert.match(
    garde.slice(0, 400),
    /if \(!guard\.entitlements\.vip\)/,
    'La garde ne vérifie plus le droit « vip ».'
  );

  const chat = sansCommentaires(lire('src/app/api/chat/route.ts'));
  assert.match(chat, /await requireVip\(\)/, 'La route de l’Agent VIP n’est plus gardée.');
});

test('★ ACQUIS — l’écran de l’Agent VIP lit le droit, pas le libellé de l’offre', () => {
  const expert = sansCommentaires(lire('src/app/(dashboard)/expert/page.tsx'));
  assert.match(
    expert,
    /setIsPro\(!!data\.vip\)/,
    'L’écran décide lui-même qui entre au lieu de suivre le serveur.'
  );
});
