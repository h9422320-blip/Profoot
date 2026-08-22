/**
 * L'ADMINISTRATION DOIT DIRE EXACTEMENT CE QUE DIT CHARIOW.
 *
 * Cibles relevées sur le tableau de bord Chariow le 22 août 2026 à 12 h 17 :
 *   • Revenu total (depuis le lancement) .... 375 200 FCFA
 *   • 16 → 22 août .......................... 336 000 FCFA sur 103 ventes
 */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });

// On repart de zéro, comme le fera le serveur au premier affichage.
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await sb.from('cache_api').delete().eq('cle', 'chariow:recettes-jour');
console.log('\n  Réserve vidée. Premier affichage : lecture complète.\n');

const { recettesParJour, totalEntre } = await jiti.import('../src/lib/recettes-boutique.ts');
const { getPartenaires } = await jiti.import('../src/lib/partenaires.ts');
const { getAdminMetrics, resoudrePeriode } = await jiti.import('../src/lib/admin-metrics.ts');

const controle = (libelle, obtenu, cible) => {
  const ok = obtenu === cible;
  console.log(`  ${libelle.padEnd(42)} ${String(obtenu).padStart(9)}   cible ${String(cible).padStart(9)}   ${ok ? '✔' : '✘ ÉCART ' + (obtenu - cible)}`);
  return ok;
};

let t0 = Date.now();
const j1 = await recettesParJour();
console.log(`  Lecture complète : ${Date.now() - t0} ms\n`);

let bon = true;
bon = controle('Total depuis le lancement', totalEntre(j1).xof, 375200) && bon;
const p = totalEntre(j1, '2026-08-16', '2026-08-22');
bon = controle('16 → 22 août', p.xof, 336000) && bon;
bon = controle('16 → 22 août — nombre de ventes', p.ventes, 103) && bon;

// Deuxième lecture : celle de tous les affichages suivants.
t0 = Date.now();
const j2 = await recettesParJour();
console.log(`\n  Lecture suivante (fenêtre de 3 jours) : ${Date.now() - t0} ms\n`);
bon = controle('Total depuis le lancement', totalEntre(j2).xof, 375200) && bon;
bon = controle('16 → 22 août', totalEntre(j2, '2026-08-16', '2026-08-22').xof, 336000) && bon;

// Ce que les deux pages afficheront réellement.
const m = await getAdminMetrics(resoudrePeriode({ periode: 'tout' }));
const [kader] = await getPartenaires();
console.log('');
bon = controle("Vue d'ensemble — revenus", m.revenus.totalCumule, 375200) && bon;
bon = controle('Page partenaires — août', kader?.mois?.find((x) => x.mois === '2026-08')?.recettesXof ?? 0, 336000) && bon;
bon = controle('Dû à Kader (35 %)', kader?.duMoisEnCoursXof ?? 0, Math.round(336000 * 0.35)) && bon;

console.log(`\n  ${bon ? '✔ TOUT CORRESPOND À CHARIOW' : '✘ IL RESTE UN ÉCART'}\n`);
