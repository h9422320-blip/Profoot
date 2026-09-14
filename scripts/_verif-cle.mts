import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data, error } = await sb.from('cache_api').select('cle, expire_le, ecrit_le').eq('cle', 'elan-terrain:v1');
console.log(error ? `ERREUR ${error.message}` : JSON.stringify(data));
const { data: d2 } = await sb.from('cache_api').select('contenu').eq('cle', 'elan-terrain:v1').single();
const c: any = d2?.contenu;
console.log(c ? `contenu : ${c.clubs} clubs, ${c.championnats} championnats, calculé ${String(c.calculeLe).slice(0,16)}` : 'contenu vide');
