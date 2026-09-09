/**
 * PURGE DES LIGNES DE CACHE PERIMEES.
 *
 * Constate le 6 septembre 2026 : la table `cache_api` comptait 60 978 lignes,
 * et lire UNE SEULE ligne par sa cle prenait de 0,9 a 1,8 seconde. Chaque
 * analyse, chaque lecture du moteur, chaque garde anti-abus payait cette
 * seconde -- et la construction du releve des forces n'arrivait plus a
 * terminer une seule competition dans son budget de temps.
 *
 * Sur ces 60 978 lignes :
 *   34 283 caches d'API perimes  (le code les redemande au fournisseur)
 *   20 362 compteurs anti-abus perimes (hors de leur fenetre, sans objet)
 *
 * Quatre-vingt-dix pour cent de la table etait du poids mort. Ces lignes sont
 * DEJA traitees comme absentes par le code : les supprimer ne change aucun
 * comportement, cela ne fait qu'alleger.
 *
 * Par tranches de dates : demander la suppression de trente mille lignes d'un
 * seul coup depasse le delai de la base.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: SR, Authorization: 'Bearer ' + SR };

const compter = async (filtre: string): Promise<number> => {
  const r = await fetch(`${U}/rest/v1/cache_api?select=cle${filtre ? '&' + filtre : ''}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  return Number((r.headers.get('content-range') ?? '').split('/')[1] ?? 0);
};

const debut = await compter('');
console.log(`Avant : ${debut} ligne(s).\n`);

const maintenant = new Date();
let totalSupprime = 0;

for (const prefixe of ['limite:', 'apifb:']) {
  let supprime = 0;
  // On remonte le temps par tranches d'une journée : chaque suppression porte
  // ainsi sur quelques milliers de lignes au plus, jamais sur trente mille.
  for (let jours = 400; jours >= 0; jours--) {
    const haut = new Date(maintenant.getTime() - jours * 86_400_000).toISOString();
    const bas = new Date(maintenant.getTime() - (jours + 1) * 86_400_000).toISOString();
    const url =
      `${U}/rest/v1/cache_api?cle=like.${encodeURIComponent(prefixe + '*')}` +
      `&expire_le=gte.${bas}&expire_le=lt.${haut}`;
    const r = await fetch(url, { method: 'DELETE', headers: { ...H, Prefer: 'count=exact' } });
    if (!r.ok) {
      console.log(`  ${prefixe} — arret : HTTP ${r.status} ${(await r.text()).slice(0, 100)}`);
      break;
    }
    const n = Number((r.headers.get('content-range') ?? '').split('/')[0]?.split('-')[1] ?? 0);
    supprime += Number.isFinite(n) ? n + (n ? 1 : 0) : 0;
  }
  // Et tout ce qui est plus vieux que la fenêtre balayée.
  const tresVieux = new Date(maintenant.getTime() - 401 * 86_400_000).toISOString();
  await fetch(
    `${U}/rest/v1/cache_api?cle=like.${encodeURIComponent(prefixe + '*')}&expire_le=lt.${tresVieux}`,
    { method: 'DELETE', headers: H }
  );
  const reste = await compter(
    `cle=like.${encodeURIComponent(prefixe + '*')}&expire_le=lt.${maintenant.toISOString()}`
  );
  console.log(`  ${prefixe} : ${reste} perimee(s) restante(s).`);
  totalSupprime += supprime;
}

const fin = await compter('');
console.log(`\nApres : ${fin} ligne(s)   (${debut - fin} supprimee(s)).`);

let somme = 0;
for (let i = 0; i < 5; i++) {
  const t0 = Date.now();
  await fetch(`${U}/rest/v1/cache_api?cle=eq.forces:occasions-v6&select=cle`, { headers: H });
  somme += Date.now() - t0;
}
console.log(`Lecture par cle : ${Math.round(somme / 5)} ms en moyenne.`);
