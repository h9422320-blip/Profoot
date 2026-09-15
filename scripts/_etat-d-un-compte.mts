/**
 * L'ÉTAT D'UN COMPTE, POUR COMPRENDRE POURQUOI IL N'ENTRE PAS.
 *
 * Ne touche à RIEN : aucune écriture, aucun mot de passe changé, aucune
 * session ouverte. Il lit et il dit.
 *
 * Ce qui empêche une connexion, dans l'ordre de fréquence :
 *   — le compte n'existe pas sous cette adresse (faute de frappe, autre adresse) ;
 *   — l'adresse n'est pas confirmée, et le projet exige la confirmation ;
 *   — le compte est banni ou supprimé.
 *
 *   npx tsx scripts/_etat-d-un-compte.mts <adresse> [autre adresse...]
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const cherchees = process.argv.slice(2).map((x) => x.toLowerCase().trim()).filter(Boolean);
if (!cherchees.length) {
  console.log('usage : npx tsx scripts/_etat-d-un-compte.mts <adresse> [autre...]');
  process.exit(1);
}

const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

// `listUsers` est paginé : sans la boucle, un compte au-delà de la première
// page passe pour inexistant. Erreur commise le 15 septembre 2026.
const tous: any[] = [];
for (let page = 1; page <= 100; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error(error.message);
  const lot = data?.users ?? [];
  tous.push(...lot);
  if (lot.length < 1000) break;
}
console.log(`${tous.length} comptes lus.\n`);

for (const adresse of cherchees) {
  const u = tous.find((x) => String(x.email ?? '').toLowerCase() === adresse);
  if (!u) {
    // Peut-être une adresse voisine : on aide sans rien deviner.
    const debut = adresse.split('@')[0].slice(0, 5);
    const proches = tous
      .filter((x) => String(x.email ?? '').toLowerCase().startsWith(debut))
      .map((x) => x.email)
      .slice(0, 5);
    console.log(`${adresse} : AUCUN COMPTE.`);
    if (proches.length) console.log(`   adresses voisines : ${proches.join(', ')}`);
    console.log('');
    continue;
  }

  const { data: abos } = await sb
    .from('subscriptions')
    .select('plan, status, provider, expires_at')
    .eq('user_id', u.id);

  console.log(`${adresse}`);
  console.log(`   créé le            ${String(u.created_at).slice(0, 19).replace('T', ' ')}`);
  console.log(`   adresse confirmée  ${u.email_confirmed_at ? 'oui' : 'NON'}`);
  console.log(`   dernière entrée    ${u.last_sign_in_at ? String(u.last_sign_in_at).slice(0, 19).replace('T', ' ') : 'jamais'}`);
  console.log(`   banni jusqu'à      ${(u as any).banned_until ?? '—'}`);
  console.log(`   supprimé le        ${(u as any).deleted_at ?? '—'}`);
  console.log(`   abonnements        ${(abos ?? []).length}`);
  for (const a of abos ?? []) console.log(`      ${JSON.stringify(a)}`);
  console.log('');
}
