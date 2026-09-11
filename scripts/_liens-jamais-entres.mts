/**
 * Pour chaque acheteur servi mais jamais entre : son etat, un eventuel second
 * compte, et un lien NEUF pour choisir son mot de passe. N envoie rien.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com';
const cibles = ['sindoukamagate141@gmail.com', 'mbayesaliou2024@icloud.com', 'mohamedabdoulrayanecherky@gmail.com', 'babaoulare@gmail.com'];
const tous: any[] = [];
for (let page = 1; page <= 200; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('ERREUR ' + error.message); process.exit(1); }
  tous.push(...(data?.users ?? []));
  if ((data?.users ?? []).length < 1000) break;
}
const racine = (e: string) => e.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 8);
for (const email of cibles) {
  const u = tous.find((x) => String(x.email).toLowerCase() === email);
  console.log(`\n=== ${email}`);
  if (!u) { console.log('  AUCUN COMPTE'); continue; }
  const { data: subs } = await sb.from('subscriptions').select('plan, status, expires_at, created_at').eq('user_id', u.id);
  const actifs = (subs ?? []).filter((s: any) => s.status === 'active' && Date.parse(s.expires_at) > Date.now());
  console.log(`  compte cree ${String(u.created_at).slice(0, 10)}, connexion : ${u.last_sign_in_at ? String(u.last_sign_in_at).slice(0, 16) : 'JAMAIS'}`);
  console.log(`  abonnements actifs : ${actifs.map((s: any) => s.plan + ' jusqu au ' + String(s.expires_at).slice(0, 10)).join(', ') || 'aucun'}`);
  const voisins = tous.filter((x) => x.id !== u.id && racine(String(x.email).toLowerCase()) === racine(email));
  for (const v of voisins) console.log(`  compte voisin : ${v.email} (cree ${String(v.created_at).slice(0, 10)}, connexion ${v.last_sign_in_at ? String(v.last_sign_in_at).slice(0, 10) : 'jamais'})`);
  const { data: lien, error } = await sb.auth.admin.generateLink({ type: 'recovery', email });
  const jeton = lien?.properties?.hashed_token;
  console.log(`  LIEN : ${jeton ? `${SITE}/reinitialiser-mot-de-passe?token_hash=${jeton}&type=recovery` : 'non genere — ' + error?.message}`);
}
