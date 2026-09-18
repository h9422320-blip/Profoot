/**
 * LES STATISTIQUES DE MATCH, SORTIES DE LA RÉSERVE DE PRODUCTION.
 *
 * La production garde en réserve les fiches `/fixtures/statistics` qu'elle a
 * demandées pour le relevé des occasions : 8 865 au 18 septembre 2026, dont
 * 5 706 portent le xG du fournisseur. Elles ne coûtent donc AUCUN appel
 * supplémentaire.
 *
 * On les ramène ici, une ligne par rencontre, du point de vue de celui qui
 * reçoit, dans `.challenger/statistiques-matchs.json`. Le modèle de Poisson
 * s'en sert pour s'ajuster sur le xG plutôt que sur les buts — voir
 * `ciblesDuModele`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DOSSIER, FICHIER_RENCONTRES } from './commun.mjs';

export const FICHIER_STATISTIQUES = path.join(DOSSIER, 'statistiques-matchs.json');

export interface StatistiquesMatch {
  id: number;
  date: string;
  ligue: number;
  dom: number;
  ext: number;
  bd: number;
  be: number;
  xgD: number | null;
  xgE: number | null;
  cadresD: number | null;
  cadresE: number | null;
  surfaceD: number | null;
  surfaceE: number | null;
}

export async function exporterStatistiquesDeMatch(): Promise<{ lues: number; exportees: number; avecXg: number }> {
  const { createAdminClient } = await import('../../src/lib/supabase-admin.js');
  const sb = createAdminClient();
  const lignes: any[] = [];
  for (let de = 0; de < 60000; de += 500) {
    let page: any[] | null = null;
    // Trois essais par page : la base coupe parfois une lecture longue.
    for (let essai = 1; essai <= 3 && !page; essai++) {
      const { data, error } = await sb
        .from('cache_api')
        .select('cle, contenu')
        .like('cle', 'apifb:/fixtures/statistics?fixture=%')
        .range(de, de + 499);
      if (!error) page = data ?? [];
      else await new Promise((r) => setTimeout(r, 2000 * essai));
    }
    if (!page) break;
    lignes.push(...page);
    if (page.length < 500) break;
  }

  const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
  const parId = new Map(rencontres.map((m) => [Number(m.id), m]));
  const val = (stats: any[], type: string) => {
    const v = stats.find((s: any) => s.type === type)?.value;
    const n = typeof v === 'string' ? Number(v.replace('%', '')) : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const sortie: StatistiquesMatch[] = [];
  for (const l of lignes) {
    const id = Number(String(l.cle).split('fixture=')[1]);
    const m = parId.get(id);
    const r = l.contenu?.response ?? [];
    if (!m || r.length < 2) continue;
    const dom = r.find((e: any) => Number(e.team?.id) === Number(m.dom));
    const ext = r.find((e: any) => Number(e.team?.id) === Number(m.ext));
    if (!dom || !ext) continue;
    sortie.push({
      id,
      date: m.date,
      ligue: Number(m.ligue),
      dom: Number(m.dom),
      ext: Number(m.ext),
      bd: Number(m.bd),
      be: Number(m.be),
      xgD: val(dom.statistics, 'expected_goals'),
      xgE: val(ext.statistics, 'expected_goals'),
      cadresD: val(dom.statistics, 'Shots on Goal'),
      cadresE: val(ext.statistics, 'Shots on Goal'),
      surfaceD: val(dom.statistics, 'Shots insidebox'),
      surfaceE: val(ext.statistics, 'Shots insidebox'),
    });
  }
  // Une lecture ratée ne doit pas écraser un export précédent plus complet.
  if (sortie.length > 0) fs.writeFileSync(FICHIER_STATISTIQUES, JSON.stringify(sortie));
  return { lues: lignes.length, exportees: sortie.length, avecXg: sortie.filter((s) => s.xgD !== null && s.xgE !== null).length };
}

/**
 * CE QUE LE MODÈLE DE POISSON CHERCHE À EXPLIQUER, RENCONTRE PAR RENCONTRE.
 *
 * Le xG du fournisseur quand il existe, les buts sinon. Le xG mesure ce que
 * chaque équipe s'est CRÉÉ ; les buts y ajoutent la chance d'un poteau ou d'un
 * gardien en état de grâce, qui ne se reproduit pas.
 *
 * Mesuré le 18 septembre 2026 sur 1 063 matchs des sept grands championnats
 * (2026-02 → 2026-09, réajusté chaque mois sur le seul passé), à la même part
 * 0,5 que la production :
 *
 *     cible                 scores exacts   Brier « plus de 2,5 »   total, erreur
 *     buts (avant) ..............  114            0,2424               1,272
 *     moitié buts, moitié xG ....  119            0,2417               1,267
 *     xG seul ...................  121            0,2412               1,265
 *
 * Mois par mois, le xG fait au moins aussi bien sur les scores exacts les
 * cinq mois (+2, +0, +2, +1, +2) et mieux sur le Brier les cinq mois sur cinq.
 */
export function ciblesDuModele(rencontres: any[]): any[] {
  let xg = new Map<number, [number, number]>();
  if (fs.existsSync(FICHIER_STATISTIQUES)) {
    const st: StatistiquesMatch[] = JSON.parse(fs.readFileSync(FICHIER_STATISTIQUES, 'utf8'));
    xg = new Map(
      st.filter((s) => s.xgD !== null && s.xgE !== null).map((s) => [s.id, [Number(s.xgD), Number(s.xgE)] as [number, number]])
    );
  }
  return rencontres.map((m) => {
    const x = xg.get(Number(m.id));
    return {
      date: m.date,
      ligue: Number(m.ligue),
      dom: Number(m.dom),
      ext: Number(m.ext),
      bd: x ? x[0] : Number(m.bd),
      be: x ? x[1] : Number(m.be),
    };
  });
}
