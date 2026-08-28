/**
 * L'ACCÈS D'UN CLIENT, VU PAR L'APPLICATION ELLE-MÊME.
 *
 * ── POURQUOI PAS UNE SIMPLE LECTURE DE LA BASE ────────────────────────────
 *
 * Une ligne dans `subscriptions` ne prouve pas qu'un client a son accès. Ce
 * que l'application accorde vient de `computeEntitlements` : plan, contenu
 * payant, Agent VIP, quota d'analyses. Entre les deux vivent une date
 * d'expiration, une hiérarchie d'offres et des réglages d'administration —
 * autant d'endroits où « la ligne existe » et « le client peut travailler »
 * cessent de vouloir dire la même chose.
 *
 * Ce script pose donc la question au code de production, pas à la table.
 *
 *   npx tsx scripts/verifier-acces-client.ts client@exemple.com [autre@…]
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { computeEntitlements, UNLIMITED } from '../src/lib/subscription';
import { getQuotaState } from '../src/lib/analysis-quota';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const ADMIN = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function principal() {
  const demandes = process.argv.slice(2).map((e) => e.toLowerCase());
  if (!demandes.length) {
    console.log('Usage : npx tsx scripts/verifier-acces-client.ts client@exemple.com');
    return;
  }

  // Un seul balayage des comptes, quel que soit le nombre d'adresses.
  const comptes = new Map<string, any>();
  for (let page = 1; page <= 30; page++) {
    const { data } = await ADMIN.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    for (const u of data.users) comptes.set(String(u.email).toLowerCase(), u);
    if (data.users.length < 1000) break;
  }

  for (const email of demandes) {
    console.log(`\n══ ${email} ${'═'.repeat(Math.max(0, 56 - email.length))}`);
    const user = comptes.get(email);
    if (!user) {
      console.log('  ❌ AUCUN COMPTE ProFoot à cette adresse.');
      continue;
    }

    const droits = await computeEntitlements(ADMIN, user);
    const quota = await getQuotaState(user.id, droits);

    const restant = droits.expiresAt
      ? Math.round((Date.parse(droits.expiresAt) - Date.now()) / 86_400_000)
      : null;

    console.log(`  Compte créé le       : ${String(user.created_at).slice(0, 10)}`);
    console.log(`  Offre reconnue       : ${droits.plan}`);
    console.log(`  Contenu payant       : ${droits.premium ? '✅ OUVERT' : '❌ FERMÉ'}`);
    console.log(`  Agent VIP            : ${droits.vip ? '✅ ouvert' : '— non'}`);
    console.log(
      `  Analyses             : ${quota.used} utilisée(s) sur ` +
        `${quota.unlimited ? 'illimité' : quota.limit}` +
        `${quota.unlimited ? '' : `, ${quota.remaining} restante(s)`}`
    );
    console.log(
      `  Expire le            : ${droits.expiresAt?.slice(0, 10) ?? '—'}` +
        (restant !== null ? `  (dans ${restant} jours)` : '')
    );
    console.log(
      `  Limite d'analyses    : ${droits.analysisLimit === UNLIMITED ? 'illimitée' : droits.analysisLimit}`
    );

    // Le verdict, en une ligne, sans avoir à interpréter ce qui précède.
    console.log(
      droits.premium
        ? `\n  ✅ CE CLIENT PEUT TRAVAILLER : il ouvre ses analyses complètes dès maintenant.`
        : `\n  ❌ CE CLIENT NE VOIT RIEN DE PAYANT — il a payé pour rien en l'état.`
    );
  }
}

void principal();
