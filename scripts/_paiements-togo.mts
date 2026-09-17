// Lecture seule : les paiements venus du Togo, et par quel opérateur.
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb.from('webhook_events').select('*').range(de, de + 999);
  if (error) { console.log('erreur', error.message); break; }
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log('événements de boutique :', tout.length);
const cle = (o: any, chemins: string[]) => { for (const c of chemins) { const v = c.split('.').reduce((x: any, k) => x?.[k], o); if (v !== undefined && v !== null && v !== '') return String(v); } return null; };
const champs = new Set<string>();
const aplatir = (o: any, prefixe = '') => {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    const chemin = prefixe ? `${prefixe}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) aplatir(v, chemin);
    else champs.add(chemin);
  }
};
for (const e of tout.slice(0, 40)) aplatir(e.payload ?? {});
console.log('\nchamps vus dans les charges utiles :');
console.log([...champs].sort().join('\n'));
console.log('\nun événement complet, pour voir ce que la boutique envoie :');
console.log(JSON.stringify(tout[0], null, 1).slice(0, 2000));
