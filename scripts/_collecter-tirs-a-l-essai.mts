/**
 * RANGER LES FICHES DE TIRS DES COMPÉTITIONS À L'ESSAI. Écrit en réserve.
 *
 * Le relevé du moteur a besoin de 240 jours d'historique pour juger un club.
 * Ce script va chercher les fiches manquantes des compétitions déclarées dans
 * `TIRS_EN_PLUS`, une demande à la fois, avec une pause — la clé du
 * fournisseur est partagée avec les abonnés, et ce script tourne en journée.
 *
 *   npx tsx scripts/_collecter-tirs-a-l-essai.mts [jours]
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, TIRS_EN_PLUS } from './challenger/commun.mjs';

chargerEnv();
const { apiFootball, CACHE_TTL } = await import('../src/lib/api-football.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jours = Number(process.argv[2]) || 240;
const depuis = Date.now() - jours * 86_400_000;
const cibles = new Set(Object.keys(TIRS_EN_PLUS).map(Number));

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const aLire = rencontres.filter((m) => cibles.has(Number(m.ligue)) && Date.parse(m.date) >= depuis);

// Ce qui est déjà en réserve ne se redemande pas.
const deja = new Set<string>();
for (let de = 0; de < 200_000; de += 1000) {
  const { data, error } = await sb
    .from('cache_api')
    .select('cle')
    .ilike('cle', 'apifb:/fixtures/statistics?fixture=%')
    .range(de, de + 999);
  if (error) throw new Error('lecture de la réserve : ' + error.message);
  for (const d of data ?? []) deja.add(String(d.cle));
  if (!data || data.length < 1000) break;
}

const manquantes = aLire.filter((m) => !deja.has(`apifb:/fixtures/statistics?fixture=${m.id}`));
console.log(
  `${aLire.length} rencontres des compétitions à l'essai sur ${jours} jours, ` +
    `dont ${manquantes.length} sans fiche en réserve.`
);

let lues = 0;
let ratees = 0;
const debut = Date.now();
for (const [i, m] of manquantes.entries()) {
  try {
    await apiFootball<any>(`/fixtures/statistics?fixture=${m.id}`, 365 * 86_400_000);
    lues++;
  } catch {
    ratees++;
  }
  // Une demande toutes les six cents millisecondes : le même rythme que le
  // relevé des cotes, qui n'a jamais fait broncher le fournisseur.
  await new Promise((r) => setTimeout(r, 600));
  if ((i + 1) % 50 === 0)
    console.log(`  ${i + 1}/${manquantes.length} — ${lues} rangées, ${ratees} illisibles, ${Math.round((Date.now() - debut) / 1000)} s`);
}
console.log(`terminé : ${lues} fiches rangées, ${ratees} illisibles, en ${Math.round((Date.now() - debut) / 60_000)} min`);
