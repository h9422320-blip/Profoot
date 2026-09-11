import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com';
for (const email of process.argv.slice(2)) {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email });
  const jeton = data?.properties?.hashed_token;
  console.log(`${email}\n  ${jeton ? `${SITE}/reinitialiser-mot-de-passe?token_hash=${jeton}&type=recovery` : 'non genere — ' + error?.message}`);
}
