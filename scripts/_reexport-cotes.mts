/**
 * Ré-exporte SEULEMENT le fichier des cotes depuis la réserve, sans aucun
 * appel au fournisseur et sans toucher aux rencontres ni aux tirs.
 *
 * Pourquoi à part : le rafraîchissement complet balaie toutes les cotes du
 * jour chez le fournisseur, ce qui prend une demi-heure. Quand les cotes sont
 * DÉJÀ en réserve et qu'on veut seulement les reverser au banc — par exemple
 * pour rejuger la couche du marché le soir même —, ce balayage ne sert à rien.
 *
 * La règle des cotes de clôture est reprise mot pour mot : une journée rangée
 * APRÈS son propre jour contient déjà les compositions et l'argent engagé,
 * elle est écartée.
 */
import fs from 'node:fs';
import { chargerEnv, assurerDossiers, FICHIER_COTES, journal } from './challenger/commun.mjs';

chargerEnv();
assurerDossiers();

const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const cotes: Record<string, { dom: number; nul: number; ext: number }> = {};
let gardees = 0;
let ecartees = 0;

for (let de = 0; de < 20_000; de += 200) {
  const { data, error } = await sb
    .from('cache_api')
    .select('cle, contenu, ecrit_le')
    .ilike('cle', 'cotes:%')
    .range(de, de + 199);
  if (error) throw new Error(`lecture des cotes (page ${de}) : ${error.message}`);
  const lignes = data ?? [];
  for (const r of lignes) {
    const jour = String(r.cle).slice('cotes:'.length);
    const ecrit = String((r as any).ecrit_le ?? '').slice(0, 10);
    if (!ecrit || Date.parse(ecrit) > Date.parse(jour)) {
      ecartees++;
      continue;
    }
    gardees++;
    const c: any = (r as any).contenu;
    const liste: any[] = Array.isArray(c)
      ? c
      : Array.isArray(c?.matchs)
        ? c.matchs
        : Array.isArray(c?.cotes)
          ? c.cotes
          : Object.values(c ?? {}).flatMap((v: any) => (Array.isArray(v) ? v : []));
    for (const m of liste)
      if (m?.id && m?.proba)
        cotes[String(m.id)] = { dom: Number(m.proba.dom), nul: Number(m.proba.nul), ext: Number(m.proba.ext) };
  }
  if (lignes.length < 200) break;
}

// Une collecte vide écraserait le fichier : on refuse, comme pour les
// rencontres depuis la nuit du 13 septembre 2026.
const avant = fs.existsSync(FICHIER_COTES)
  ? Object.keys(JSON.parse(fs.readFileSync(FICHIER_COTES, 'utf8'))).length
  : 0;
const apres = Object.keys(cotes).length;
if (apres < avant * 0.9) {
  journal(`ré-export REFUSÉ : ${apres} cotes contre ${avant} déjà en place. Le fichier n'est pas touché.`);
  process.exit(1);
}

fs.writeFileSync(FICHIER_COTES, JSON.stringify(cotes));
journal(
  `${apres} rencontres cotées exportées (${avant} avant) — ` +
    `${gardees} journée(s) relevée(s) avant les matchs, ${ecartees} écartée(s) (cote de clôture)`
);
