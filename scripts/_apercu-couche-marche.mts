/**
 * APERÇU — LA COUCHE DU MARCHÉ PREND-ELLE LE BON CHEMIN ?
 * Lecture seule, sur les matchs à la fois cotés et jugés. Le propriétaire a
 * fixé 1 000 matchs avant toute décision : ceci n'est qu'un aperçu.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

// Les cotes, rangees par jour dans la reserve.
const cotes = new Map<number, { dom: number; nul: number; ext: number }>();
for (let de = 0; de < 5000; de += 200) {
  const { data } = await sb.from('cache_api').select('cle, contenu').ilike('cle', 'cotes:%').range(de, de + 199);
  for (const r of data ?? []) {
    const c: any = r.contenu;
    const liste: any[] = Array.isArray(c) ? c : Array.isArray(c?.matchs) ? c.matchs : Array.isArray(c?.cotes) ? c.cotes : Object.values(c ?? {}).flatMap((v: any) => (Array.isArray(v) ? v : []));
    for (const m of liste) if (m?.id && m?.proba) cotes.set(Number(m.id), { dom: Number(m.proba.dom), nul: Number(m.proba.nul), ext: Number(m.proba.ext) });
  }
  if (!data || data.length < 200) break;
}
const jug: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  jug.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const lignes = jug
  .filter((j) => cotes.has(Number(j.fixture_id)))
  .map((j) => {
    const m = cotes.get(Number(j.fixture_id))!;
    const reel = j.buts_reels_domicile > j.buts_reels_exterieur ? 0 : j.buts_reels_domicile === j.buts_reels_exterieur ? 1 : 2;
    const annonce = j.buts_prevus_domicile > j.buts_prevus_exterieur ? 0 : j.buts_prevus_domicile === j.buts_prevus_exterieur ? 1 : 2;
    const moteur = [Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur)].map((x) => x / 100);
    const marche = [m.dom, m.nul, m.ext];
    return { date: String(j.date_match), reel, annonce, moteur, marche };
  })
  .sort((a, b) => a.date.localeCompare(b.date));
const choix = (p: number[]) => p.indexOf(Math.max(...p));
const moities = [lignes.slice(0, Math.floor(lignes.length / 2)), lignes.slice(Math.floor(lignes.length / 2))];
console.log(`${cotes.size} matchs cotes en reserve ; ${lignes.length} a la fois cotes et juges\n`);
console.log('                                   1re moitie        2e moitie');
const ligne = (nom: string, f: (x: any) => number) =>
  console.log(`  ${nom.padEnd(32)} ${moities.map((l) => `${l.filter((x) => f(x) === x.reel).length}/${l.length} (${(100 * l.filter((x) => f(x) === x.reel).length / l.length).toFixed(1)} %)`).join('   ')}`);
ligne('vainqueur annonce par le moteur', (x) => x.annonce);
ligne('issue la plus probable (moteur)', (x) => choix(x.moteur));
ligne('marche seul', (x) => choix(x.marche));
for (const w of [0.25, 0.5, 0.75])
  ligne(`melange, part du marche ${w}`, (x) => choix(x.moteur.map((p: number, i: number) => (1 - w) * p + w * x.marche[i])));
