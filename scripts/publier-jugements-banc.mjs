/**
 * PUBLIER LA MATIÈRE DU BANC POUR LA MESURE DE FIABILITÉ.
 *
 * ── POURQUOI CETTE SECONDE SOURCE ─────────────────────────────────────────
 *
 * La fiabilité affichée au client se mesure sur `jugements_moteur` : les
 * rencontres réellement analysées, puis confrontées à leur résultat. Elles
 * s'accumulent d'une quarantaine par jour, et les grands championnats n'y
 * comptent que quelques dizaines de rencontres à haute confiance — trop peu
 * pour distinguer une Liga à 86 % d'une Ligue 1 à 72 %.
 *
 * Le banc d'essai, lui, parcourt une saison entière journée après journée, en
 * ne connaissant à chaque instant que le passé, et en appelant la VRAIE
 * fonction de production. Il produit 2 305 verdicts de plus.
 *
 * ── LE CONTRÔLE QUI AUTORISE CETTE FUSION ─────────────────────────────────
 *
 * Deux sources ne se mélangent que si elles mesurent la même chose. Vérifié
 * le 5 septembre 2026 :
 *
 *                        global   ≥ 62 %   ≥ 68 %   ≥ 74 %
 *     banc (simulé)      50,2 %   67,1 %   72,8 %   76,5 %
 *     jugements réels    48,9 %   66,1 %   70,3 %   75,6 %
 *
 * Un à deux points d'écart, dans la marge. Championnat par championnat, de
 * -5,0 (La Liga) à +1,6 (Premier League). Le banc est très légèrement plus
 * optimiste : les taux affichés montent donc d'environ un point, et c'est le
 * prix — assumé et écrit ici — de vingt-sept combinaisons qui deviennent
 * mesurables.
 *
 * ── CE QUE ÇA REND POSSIBLE ───────────────────────────────────────────────
 *
 *     Eredivisie, confiance ≥ 74 % .............. 88,5 %
 *     La Liga, confiance ≥ 74 % ................. 86,4 %
 *     Serie A ≥ 62 %, favori à l'extérieur ...... 86,1 %
 *     Bundesliga ≥ 68 %, favori à l'extérieur ... 84,6 %
 *
 * ── QUAND LE RELANCER ─────────────────────────────────────────────────────
 *
 * Rarement. Il porte sur une saison achevée : son contenu ne bouge pas. À
 * relancer quand une nouvelle saison est terminée, ou après une modification
 * du moteur assez profonde pour changer ses probabilités.
 *
 *     node scripts/publier-jugements-banc.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

for (const ligne of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = ligne.indexOf('=');
  if (i > 0 && !ligne.startsWith('#')) {
    process.env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const fichier = path.join(os.tmpdir(), 'verdicts-banc.json');

console.log('Parcours de la saison par le banc — quelques minutes.\n');
execFileSync(process.execPath, ['scripts/banc-variete.mjs'], {
  env: { ...process.env, BANC_EXPORT_JUGEMENTS: fichier },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const verdicts = JSON.parse(fs.readFileSync(fichier, 'utf8'));
console.log(`${verdicts.length} verdict(s) produits.`);

// ── LE RELEVÉ, DANS LA MÊME FORME QUE CELUI DES JUGEMENTS RÉELS ───────────
//
// Les paliers et les familles sont recopiés de `fiabilite-apprise.ts`. Les
// importer d'ici obligerait à charger tout le module serveur ; les garder
// alignés est le prix de cette indépendance, et le test le vérifie.
const TRANCHES = [
  { cle: 'incertain', min: 0 },
  { cle: 'penche', min: 45 },
  { cle: 'marque', min: 55 },
  { cle: 'nette', min: 62 },
  { cle: 'forte', min: 68 },
  { cle: 'tresforte', min: 74 },
];

const global = {};
const parLigue = {};
for (const v of verdicts) {
  const tete = Math.max(v.proba_domicile, v.proba_nul, v.proba_exterieur);
  const cote = v.proba_domicile >= v.proba_exterieur ? 'domicile' : 'exterieur';
  let famille = 'incertain';
  for (const t of TRANCHES) if (tete >= t.min) famille = t.cle;

  for (const k of [`${famille}|${cote}`, famille]) {
    global[k] ??= { justes: 0, total: 0 };
    global[k].total++;
    if (v.issue_juste) global[k].justes++;
  }

  const ligue = String(v.ligue ?? '').trim();
  if (!ligue) continue;
  for (const palier of TRANCHES) {
    if (tete < palier.min) continue;
    for (const k of [`${ligue}|${palier.cle}|${cote}`, `${ligue}|${palier.cle}`]) {
      parLigue[k] ??= { justes: 0, total: 0 };
      parLigue[k].total++;
      if (v.issue_juste) parLigue[k].justes++;
    }
  }
}

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const contenu = {
  global,
  parLigue,
  total: verdicts.length,
  publieLe: new Date().toISOString(),
};

// Dix ans : ce relevé décrit une saison achevée, il ne périme pas. C'est le
// script qu'on relance, jamais l'expiration qui décide.
const { error } = await sb.from('cache_api').upsert(
  {
    cle: 'fiabilite:banc-v1',
    contenu,
    expire_le: new Date(Date.now() + 3650 * 86_400_000).toISOString(),
    ecrit_le: new Date().toISOString(),
  },
  { onConflict: 'cle' }
);

if (error) {
  console.error('ÉCHEC : ' + error.message);
  process.exit(1);
}

console.log(
  `\nRelevé publié : ${Object.keys(global).length} familles, ${Object.keys(parLigue).length} combinaisons par championnat.`
);
const assez = Object.values(parLigue).filter((o) => o.total >= 25).length;
console.log(`${assez} combinaison(s) atteignent les 25 rencontres exigées.`);
