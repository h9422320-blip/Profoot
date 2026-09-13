import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { prenomDe } = await import('../src/lib/affiche-du-jour.js');
const sb = createAdminClient();
let u: any = null;
for (let page = 1; page <= 12 && !u; page++) {
  const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (!data?.users?.length) break;
  u = data.users.find((x: any) => String(x.email).toLowerCase() === 'h9422320@gmail.com') ?? null;
  if (data.users.length < 1000) break;
}
console.log('full_name  :', JSON.stringify(u?.user_metadata?.full_name));
console.log('email      :', u?.email);
console.log('prénom calculé :', prenomDe(u?.user_metadata?.full_name, u?.email));
