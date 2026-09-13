import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email: 'ui.test@profoot-test.com' });
if (error) throw new Error(error.message);
const h = (data as any)?.properties?.hashed_token;
console.log('token_hash :', h);
console.log('local  :', `http://localhost:3000/reinitialiser-mot-de-passe?token_hash=${h}&type=recovery`);
