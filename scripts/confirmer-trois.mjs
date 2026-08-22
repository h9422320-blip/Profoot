import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cibles = ['kafandofadyl@gmail.com', 'carvalhoake4@gmail.com', 'ferobomassa@gmail.com'];
const comptes = [];
for (let page = 1; page <= 30; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (!data?.users?.length) break; comptes.push(...data.users); if (data.users.length < 1000) break;
}
console.log('');
for (const email of cibles) {
  const u = comptes.find((c) => String(c.email).toLowerCase() === email);
  if (!u) { console.log(`  ${email} : COMPTE INTROUVABLE`); continue; }
  const { data: abos } = await sb.from('subscriptions').select('*').eq('user_id', u.id).order('created_at', { ascending: false });
  const actif = (abos ?? []).find((a) => a.status === 'active' && (!a.expires_at || new Date(a.expires_at) > new Date()));
  console.log(`  ${email}`);
  console.log(`     ${actif ? `ACTIF — ${actif.plan}, jusqu'au ${String(actif.expires_at).slice(0,10)}` : 'AUCUN ABONNEMENT ACTIF'}`);
}
console.log('');
