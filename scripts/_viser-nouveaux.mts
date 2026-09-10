/**
 * Place le point de reprise de l anneau sur une competition precise.
 *
 * Sert quand des competitions viennent d etre ajoutees en fin de liste :
 * l anneau mettrait autant de passes qu il y a de competitions avant elles
 * pour les atteindre, alors que ce sont elles qu on veut lire tout de suite.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const CLE = 'forces:occasions-v6';

const cible = Number(process.argv[2] ?? 0);
const { data } = await sb.from('cache_api').select('contenu, expire_le').eq('cle', CLE).maybeSingle();
if (!data?.contenu?.clubs) { console.log('relevé absent'); process.exit(1); }
console.log(`${CHAMPIONNATS.length} competitions — reprise actuelle a ${data.contenu.prochainDepart} (${CHAMPIONNATS[Number(data.contenu.prochainDepart ?? 0) % CHAMPIONNATS.length]?.nom})`);
if (process.argv.includes('--poser') || Number.isFinite(cible)) {
  const { error } = await sb.from('cache_api').update({
    contenu: { ...data.contenu, prochainDepart: cible },
    expire_le: data.expire_le,
  }).eq('cle', CLE);
  console.log(error ? 'ECHEC ' + error.message : `reprise posee a ${cible} (${CHAMPIONNATS[cible]?.nom})`);
}
