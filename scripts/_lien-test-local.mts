/** Ouvre une session de test locale, sur le compte interne uniquement. */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const { createAdminClient } = await import(
  '../src/lib/supabase-admin.js'
);
const sb = createAdminClient();

const EMAIL = 'ui.test@profoot-test.com';
const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email: EMAIL });
if (error) throw new Error(error.message);

const hash = (data as any)?.properties?.hashed_token;
if (!hash) throw new Error('aucun jeton rendu');
console.log(`http://localhost:3000/reinitialiser-mot-de-passe?token_hash=${hash}&type=recovery`);
