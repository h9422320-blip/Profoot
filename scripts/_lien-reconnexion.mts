/**
 * UN LIEN POUR REPRENDRE LA MAIN SUR SON COMPTE.
 *
 * Le chemin qui marche est celui de la récupération de mot de passe : le lien
 * magique ne pose PAS de session (la page d'accueil ne traite pas le fragment).
 *
 *   npx tsx scripts/_lien-reconnexion.mts adresse@exemple.com
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const adresse = String(process.argv[2] ?? '').trim().toLowerCase();
if (!adresse) { console.error('Il faut une adresse.'); process.exitCode = 1; }
else {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email: adresse });
  if (error) { console.error('✖', error.message); process.exitCode = 1; }
  else {
    const jeton = (data as any)?.properties?.hashed_token;
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com';
    console.log(`\n${adresse}\n`);
    console.log(`${site}/reinitialiser-mot-de-passe?token_hash=${jeton}&type=recovery\n`);
    console.log('Ouvrez ce lien, cliquez « Choisir un nouveau mot de passe », posez-en un :');
    console.log('la session s’ouvre aussitôt. Le lien ne vaut qu’une fois.');
  }
}
