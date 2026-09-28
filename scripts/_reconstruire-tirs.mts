/**
 * RECONSTRUIT LE RELEVÉ DES TIRS DU BANC À PARTIR DE LA RÉSERVE.
 *
 * Le 28 septembre 2026, une collecte vide a écrasé `.challenger/tirs.json` :
 * 7 317 rencontres effacées, et le banc a rejoué la nuit entière sur un moteur
 * aveugle aux tirs. Le garde-fou est posé (`ecrireReleve`) ; ce script remet
 * le relevé en place, avec EXACTEMENT la lecture de `donnees.mts`.
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES, FICHIER_TIRS, TIRS_EN_PLUS, ecrireReleve } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const sb = createAdminClient();

const nombre = (stats: any[], nom: string): number => {
  const v = (stats ?? []).find((s: any) => s?.type === nom)?.value;
  const n = typeof v === 'string' ? Number(v.replace('%', '')) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const rencontres: any[] = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const parId = new Map<number, any>(rencontres.map((m) => [Number(m.id), m]));
const nomDe = new Map<number, string>((CHAMPIONNATS as any).map((c: any) => [Number(c.id), String(c.nom)]));
for (const [id, nom] of Object.entries(TIRS_EN_PLUS)) nomDe.set(Number(id), nom as string);

const tirs: any[] = [];
for (let de = 0; de < 200_000; de += 1000) {
  const { data, error } = await sb
    .from('cache_api')
    .select('cle, contenu')
    .ilike('cle', 'apifb:/fixtures/statistics?fixture=%')
    .range(de, de + 999);
  if (error) throw new Error(error.message);
  for (const d of data ?? []) {
    const m = parId.get(Number(String(d.cle).split('=').pop()));
    if (!m) continue;
    const ligue = nomDe.get(m.ligue);
    if (!ligue) continue;
    const c: any = d.contenu;
    const rep = Array.isArray(c) ? c : c?.response ?? [];
    if (rep.length < 2) continue;
    const bloc = (nom: string) => rep.find((x: any) => x?.team?.name === nom);
    const dd = bloc(m.nomDom);
    const ee = bloc(m.nomExt);
    if (!dd || !ee) continue;
    tirs.push({
      ligue, date: Date.parse(m.date), dom: m.nomDom, ext: m.nomExt,
      cadresD: nombre(dd.statistics, 'Shots on Goal'),
      surfaceD: nombre(dd.statistics, 'Shots insidebox'),
      cadresE: nombre(ee.statistics, 'Shots on Goal'),
      surfaceE: nombre(ee.statistics, 'Shots insidebox'),
      xgD: nombre(dd.statistics, 'expected_goals'),
      xgE: nombre(ee.statistics, 'expected_goals'),
      butsD: m.bd, butsE: m.be,
    });
  }
  if (!data || data.length < 1000) break;
}
console.log(`${tirs.length} rencontres avec leurs tirs reconstruites.`);
console.log(ecrireReleve(FICHIER_TIRS, tirs, 'Relevé des tirs') ? '→ écrit.' : '→ refusé (relevé existant plus fourni).');
