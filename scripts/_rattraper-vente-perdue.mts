/**
 * INSCRIRE DANS LES COMPTES LA VENTE QUE LE PULSE A REFUSÉE.
 *
 * Le 9 septembre 2026 à 10 h 53, p13057177@gmail.com règle 2 500 francs depuis
 * le Cameroun (Orange Money). Le contrôle de montant refuse — « Montant 2500
 * incompatible avec l'offre essential_monthly (2000) » — et la vente n'est
 * inscrite nulle part. Elle manque donc aux livres :
 *
 *     MakeTou              387 ventes    1 176 570 F
 *     page des partenaires 386 ventes    1 174 020 F
 *
 * Le correctif du code empêche que cela se reproduise. Celui-ci répare le
 * passé, à partir du journal du pulse — la seule trace qui subsiste.
 *
 * L'accès de cette personne est déjà ouvert : cet outil ne touche donc QUE la
 * comptabilité, jamais ses droits.
 *
 * Sans argument : simulation. Avec --ecrire : appliqué.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const ECRIRE = process.argv.includes('--ecrire');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

console.log(ECRIRE ? '\nAPPLICATION\n' : '\nSIMULATION — rien ne sera écrit\n');

// ── LE JOURNAL DU PULSE EST LA SOURCE ──────────────────────────────────────
const { data } = await sb.from('cache_api').select('contenu').eq('cle', 'maketou:pulse:recus').maybeSingle();
const journal: any[] = Array.isArray(data?.contenu) ? data!.contenu : [];

const connues = new Set<string>();
for (let de = 0; de < 60000; de += 1000) {
  const { data: p } = await sb.from('payment_intents').select('sale_id').range(de, de + 999);
  for (const x of p ?? []) connues.add(String(x.sale_id));
  if (!p || p.length < 1000) break;
}

// Les comptes de test ne sont pas des recettes.
const perdues = journal.filter(
  (e: any) =>
    e?.evenement === 'SUCCESSFUL_SALE' &&
    e?.identifie === true &&
    e?.vente &&
    e?.email &&
    !connues.has(String(e.vente))
);

console.log(`${journal.length} entrées au journal, ${perdues.length} vente(s) absente(s) des comptes.\n`);
if (!perdues.length) { console.log('  Rien à rattraper.\n'); process.exit(0); }

for (const e of perdues) {
  const prix = Number(e.prix);
  console.log(`── ${String(e.recuLe).slice(0, 19)}  ${prix} F  ${e.email}`);
  console.log(`   vente  : ${e.vente}`);
  console.log(`   produit: ${e.produit}`);
  console.log(`   refus  : ${e.resultat?.motif ?? '?'}`);

  if (!Number.isFinite(prix) || prix <= 0) {
    console.log('   MONTANT ILLISIBLE — ignorée.\n');
    continue;
  }

  // L'offre se déduit du nom du produit, comme le fait le pulse.
  const plan = /essentiel/i.test(String(e.produit))
    ? 'essential_monthly'
    : /pro/i.test(String(e.produit))
      ? 'pro_monthly'
      : /vip|annuel/i.test(String(e.produit))
        ? 'vip_yearly'
        : null;

  if (!ECRIRE) {
    console.log(`   SERAIT INSCRITE : ${prix} F, offre ${plan ?? '(inconnue)'}\n`);
    continue;
  }

  // ── L'ACHETEUR, S'IL A UN COMPTE ─────────────────────────────────────────
  let userId: string | null = null;
  for (let page = 1; page <= 200; page++) {
    const { data: u } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    const lot = u?.users ?? [];
    const t = lot.find((x: any) => String(x.email ?? '').toLowerCase() === String(e.email).toLowerCase());
    if (t) { userId = t.id; break; }
    if (lot.length < 1000) break;
  }

  const { error } = await sb.from('payment_intents').upsert(
    {
      sale_id: String(e.vente),
      user_id: userId,
      email: String(e.email).toLowerCase(),
      plan,
      amount: prix,
      pays: e.pays ?? null,
      pays_source: 'maketou',
      moyen_paiement: e.moyen ?? null,
      statut_boutique: 'completed',
      cause_echec: 'acces_non_ouvert',
      message_echec: String(e.resultat?.motif ?? '').slice(0, 500),
      created_at: e.recuLe,
      releve_le: e.recuLe,
      // L'accès a été ouvert autrement — à la main par le propriétaire le
      // 9 septembre. La vente est donc servie, et aucune livraison ne doit la
      // reprendre.
      consumed_at: userId ? new Date().toISOString() : null,
    },
    { onConflict: 'sale_id' }
  );
  console.log(`   ${error ? 'ÉCHEC : ' + error.message : `INSCRITE (${prix} F, compte ${userId ? userId.slice(0, 8) : 'aucun'})`}\n`);
}
