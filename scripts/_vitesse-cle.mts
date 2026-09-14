import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
for (const cle of ['elan-terrain:v1', 'memoire-clubs:v1']) {
  const t0 = Date.now();
  const { data, error } = await sb.from('cache_api').select('contenu').eq('cle', cle).maybeSingle();
  const ms = Date.now() - t0;
  const taille = data?.contenu ? JSON.stringify(data.contenu).length : 0;
  console.log(`${cle.padEnd(20)} ${String(ms).padStart(6)} ms   ${(taille / 1024).toFixed(0).padStart(5)} Ko   ${error ? 'ERREUR ' + error.message : 'ok'}`);
}
// Combien de lignes dans la table ?
const { count } = await sb.from('cache_api').select('cle', { count: 'exact', head: true });
console.log(`\ncache_api : ${count} lignes`);
