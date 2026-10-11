import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
console.log('projet :', url);

const essai = async (nom: string, chemin: string, options: any = {}) => {
  const t = Date.now();
  try {
    const r = await fetch(url + chemin, { headers: { apikey: anon, 'Content-Type': 'application/json', ...(options.headers ?? {}) }, ...options });
    const corps = await r.text();
    console.log(`${nom.padEnd(34)} ${r.status} en ${Date.now() - t} ms  ${corps.slice(0, 150).replace(/\s+/g, ' ')}`);
    return { status: r.status, corps };
  } catch (e: any) {
    console.log(`${nom.padEnd(34)} ✖ ${e?.message}`);
    return null;
  }
};

await essai('santé de l’authentification', '/auth/v1/health');
await essai('réglages publics', '/auth/v1/settings');
await essai('base de données (REST)', '/rest/v1/', { method: 'GET' });
// Une tentative de connexion avec un mot de passe faux : le message d'erreur
// dit si le service répond normalement.
await essai('connexion (mot de passe faux)', '/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: JSON.stringify({ email: 'test-diagnostic@profoot-test.com', password: 'mauvais-mot-de-passe-volontaire' }),
});
