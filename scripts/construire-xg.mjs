/**
 * CONSTRUIRE LE SOCLE DES BUTS ATTENDUS, UNE FOIS POUR TOUTES.
 *
 * POURQUOI CE SCRIPT EXISTE, ET POURQUOI IL N'EST PAS DANS L'APPLICATION
 *
 * Relever les buts attendus coûte UN appel par rencontre : trois cent quatre
 * vingts pour une saison de championnat. Le faire pendant qu'un abonné attend
 * son analyse dépasserait de très loin la minute accordée à une page, et
 * brûlerait le quota du fournisseur.
 *
 * On le fait donc une fois, ici, et le résultat est conservé en base. Ensuite
 * l'application se contente de le LIRE — une lecture, quel que soit le nombre
 * d'abonnés.
 *
 * IL REPREND OÙ IL S'ARRÊTE
 *
 * Chaque rencontre déjà relevée est retrouvée dans la réserve et ne coûte rien.
 * Interrompre puis relancer ne repaie jamais deux fois.
 *
 * CE QU'IL FAUT SAVOIR SUR LES PETITS CHAMPIONNATS
 *
 * Le fournisseur ne calcule pas les buts attendus partout. Un championnat sans
 * couverture ressort à zéro rencontre relevée : ce n'est pas une panne, et
 * l'application y gardera son calcul sur les buts marqués, qui reste juste.
 *
 * Usage :
 *   node scripts/construire-xg.mjs            toutes les compétitions suivies
 *   node scripts/construire-xg.mjs 39 140     seulement ces championnats
 */
import fs from 'fs';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const jiti = createJiti(import.meta.url);
const { apiFootball, CACHE_TTL, lireReserve, ecrireReserve, LEAGUE_IDS, getSeason } =
  await jiti.import('../src/lib/api-football.ts');
const { cleXg } = await jiti.import('../src/lib/forces-equipes.ts');

const TERMINE = ['FT', 'AET', 'PEN'];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un an de validité : une rencontre jouée ne change plus de buts attendus. */
const TTL = 365 * 24 * 3600 * 1000;

const demandes = process.argv.slice(2).map(Number).filter(Number.isFinite);
const ligues = demandes.length
  ? demandes
  : [...new Set(Object.values(LEAGUE_IDS))];

console.log(`\n${ligues.length} championnat(s) à traiter.\n`);

let appels = 0;
let totalReleves = 0;
const sansCouverture = [];

for (const ligue of ligues) {
  const saisonCourante = Number(getSeason('epl')) || new Date().getFullYear();

  for (const saison of [saisonCourante - 1, saisonCourante]) {
    const cle = cleXg(ligue, saison);
    const deja = await lireReserve(cle);
    const releves = deja?.contenu && typeof deja.contenu === 'object' ? { ...deja.contenu } : {};
    const dejaConnus = Object.keys(releves).length;

    const fixtures = await apiFootball(`/fixtures?league=${ligue}&season=${saison}`, CACHE_TTL.TEAM_INFO);
    const matchs = (fixtures?.response ?? []).filter((f) => TERMINE.includes(f?.fixture?.status?.short));
    if (matchs.length === 0) continue;

    let nouveaux = 0;
    let sansXg = 0;

    for (const f of matchs) {
      const id = Number(f?.fixture?.id);
      if (!Number.isFinite(id) || releves[id] !== undefined) continue;

      const st = await apiFootball(`/fixtures/statistics?fixture=${id}`, CACHE_TTL.TEAM_INFO);
      appels++;
      await pause(280); // Le fournisseur limite le nombre d'appels par minute.

      const par = {};
      for (const e of st?.response ?? []) {
        const v = (e.statistics ?? []).find((s) => s.type === 'expected_goals')?.value;
        if (v != null) par[Number(e.team?.id)] = Number(v);
      }
      const dom = Number(f?.teams?.home?.id);
      const ext = Number(f?.teams?.away?.id);
      if (par[dom] != null && par[ext] != null) {
        releves[id] = [par[dom], par[ext]];
        nouveaux++;
      } else {
        sansXg++;
      }

      // Écriture régulière : une interruption ne perd jamais plus de vingt-cinq
      // rencontres.
      if (nouveaux % 25 === 0 && nouveaux > 0) await ecrireReserve(cle, releves, TTL);
    }

    const total = Object.keys(releves).length;
    if (total > 0) await ecrireReserve(cle, releves, TTL);
    totalReleves += total;

    const couverture = matchs.length ? Math.round((100 * total) / matchs.length) : 0;
    const etiquette = `ligue ${String(ligue).padStart(4)} saison ${saison}`;
    if (total === 0) {
      sansCouverture.push(`${ligue}/${saison}`);
      console.log(`  ${etiquette} : aucun but attendu disponible (${matchs.length} matchs) — repli sur les buts`);
    } else {
      console.log(
        `  ${etiquette} : ${String(total).padStart(4)}/${String(matchs.length).padStart(4)} relevés (${couverture} %)` +
          `${dejaConnus ? `, dont ${dejaConnus} déjà en réserve` : ''}${sansXg ? `, ${sansXg} sans donnée` : ''}`
      );
    }
  }
}

console.log(`\nTerminé.`);
console.log(`  Rencontres en réserve : ${totalReleves}`);
console.log(`  Appels au fournisseur : ${appels}`);
if (sansCouverture.length) {
  console.log(`  Sans couverture (${sansCouverture.length}) : ${sansCouverture.slice(0, 12).join(', ')}${sansCouverture.length > 12 ? '…' : ''}`);
  console.log(`  Ces championnats gardent le calcul sur les buts marqués. Rien n'est cassé.`);
}
