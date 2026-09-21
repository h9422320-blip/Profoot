// Lien de session à usage unique pour le compte de test INTERNE — jamais un compte client.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email: 'ui.test@profoot-test.com' });
if (error) throw new Error(error.message);
console.log('https://profootai.com/reinitialiser-mot-de-passe?token_hash=' + data.properties?.hashed_token + '&type=recovery');
