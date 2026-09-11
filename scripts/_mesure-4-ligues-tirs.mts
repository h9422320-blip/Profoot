/**
 * FAUT-IL AJOUTER LA ROUMANIE, LA SERBIE, L'IRLANDE ET LA FINLANDE AU
 * RELEVÉ DES TIRS ?
 *
 * Lecture seule. Rien n'est écrit, aucun réglage n'est touché.
 *
 * ── CE QUI EST DÉJÀ ÉTABLI ────────────────────────────────────────────────
 *
 * Mesuré le 11 septembre 2026 sur les matchs de coupe dont les deux clubs
 * sont au relevé : avec les tirs, 58,5 % de vainqueurs justes contre 52,4 %
 * sans (janv.–juin 2026), 47,0 contre 45,5 (depuis juillet). Le Brier
 * s'améliore dans les deux périodes.
 *
 * Mais ces matchs opposent surtout des grands clubs, suivis de longue date.
 * Rien ne dit que le gain tienne pour Étoile rouge, Shamrock Rovers ou KuPS :
 * les données de tirs des petits championnats peuvent être plus pauvres. Sur
 * les quatorze championnats qui privent le plus de matchs de coupe de leurs
 * tirs, seuls ces quatre-là sont couverts par le fournisseur.
 *
 * ── LES DEUX POPULATIONS À CONVAINCRE ─────────────────────────────────────
 *
 *   COUPES    les matchs de coupe d'Europe de leurs clubs ;
 *   NATIONAL  leurs matchs de championnat — car un championnat appris entre
 *             aussi dans la préparation des « matchs les mieux cernés ».
 *
 * Pour chacune : le pronostic tel qu'il tourne aujourd'hui (ces clubs absents
 * du relevé, donc sans tirs) contre le même pronostic avec leurs tirs. Le
 * relevé est reconstruit la veille de chaque match par le VRAI calcul,
 * `forcesDepuisRencontres`, sur les seules rencontres connues à cette date.
 *
 * ── LE CONTRÔLE ───────────────────────────────────────────────────────────
 *
 * Chaque population est coupée en deux dans le temps. L'ajout ne part en
 * ligne que s'il améliore le vainqueur annoncé dans les deux moitiés, sur les
 * DEUX populations, sans dégrader le Brier.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { calculerScoreProbable } = await import('../src/lib/score-probable.js');
const { forcesDepuisRencontres, butsAttendusOccasions, CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const NOUVELLES: Record<number, string> = {
  244: 'Veikkausliiga',
  283: 'Liga I',
  286: 'Super Liga serbe',
  357: 'Premier Division irlandaise',
};
const nomActuel = new Map<number, string>(CHAMPIONNATS.map((c: any) => [Number(c.id), String(c.nom)]));
const nomElargi = new Map<number, string>([
  ...nomActuel,
  ...Object.entries(NOUVELLES).map(([k, v]) => [Number(k), v] as [number, string]),
]);
const IDS_NOUVEAUX = new Set(Object.keys(NOUVELLES).map(Number));
const COUPES = new Set([2, 3, 848, 531]);

const FICHIER =
  'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
tout.sort((a, b) => a.date.localeCompare(b.date));
const quand = (x: any) => Date.parse(x.date);
const meta = new Map<number, any>(tout.map((x) => [Number(x.id), x]));

// ── LES TIRS EN RÉSERVE, LUS COMME LES LIT LA CONSTRUCTION ─────────────────
const nombre = (stats: any[] | undefined, type: string): number => {
  const s = (stats ?? []).find((x) => x?.type === type);
  const v = s?.value;
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? Number(String(v).replace('%', '')) || 0 : Number(v) || 0;
};
const tirsTous: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data, error } = await sb
    .from('cache_api')
    .select('cle, contenu')
    .ilike('cle', 'apifb:/fixtures/statistics?fixture=%')
    .range(de, de + 999);
  if (error) { console.log('lecture impossible : ' + error.message); process.exit(1); }
  for (const d of data ?? []) {
    const m = meta.get(Number(String(d.cle).split('=').pop()));
    if (!m || !nomElargi.has(Number(m.ligue))) continue;
    const c: any = d.contenu;
    const rep = Array.isArray(c) ? c : c?.response ?? [];
    if (rep.length < 2) continue;
    const bloc = (nom: string) => rep.find((x: any) => x?.team?.name === nom);
    const dd = bloc(m.nomDom), ee = bloc(m.nomExt);
    if (!dd || !ee) continue;
    tirsTous.push({
      ligueId: Number(m.ligue), date: quand(m), dom: m.nomDom, ext: m.nomExt,
      cadresD: nombre(dd.statistics, 'Shots on Goal'), surfaceD: nombre(dd.statistics, 'Shots insidebox'),
      cadresE: nombre(ee.statistics, 'Shots on Goal'), surfaceE: nombre(ee.statistics, 'Shots insidebox'),
      butsD: Number(m.bd ?? 0), butsE: Number(m.be ?? 0),
    });
  }
  if (!data || data.length < 1000) break;
}
const versRelevé = (noms: Map<number, string>) =>
  tirsTous.filter((t) => noms.has(t.ligueId)).map((t) => ({ ...t, ligue: noms.get(t.ligueId)! }));
const tirsActuels = versRelevé(nomActuel);
const tirsElargis = versRelevé(nomElargi);
console.log(
  `${tirsActuels.length} rencontres avec tirs dans le relevé actuel, ${tirsElargis.length} avec les quatre championnats ` +
    `(${tirsElargis.length - tirsActuels.length} de plus)\n`
);

const releves = new Map<string, any>();
function releveLaVeille(variante: 'actuel' | 'elargi', jour: string) {
  const cle = `${variante}|${jour}`;
  if (releves.has(cle)) return releves.get(cle);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const source = variante === 'actuel' ? tirsActuels : tirsElargis;
  const l = source.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  const r = l.length >= 100 ? forcesDepuisRencontres(l as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(cle, r);
  return r;
}

// ── LE CALCUL CLASSIQUE, COMME LE PRÉ-CALCUL : LA COMPÉTITION DU MATCH ─────
const parEquipe = new Map<number, any[]>();
for (const m of tout)
  for (const e of [m.dom, m.ext]) {
    if (!parEquipe.has(e)) parEquipe.set(e, []);
    parEquipe.get(e)!.push(m);
  }
function statsAvant(equipe: number, m: any) {
  let bm = 0, be = 0, n = 0;
  for (const x of parEquipe.get(equipe) ?? []) {
    if (x.ligue !== m.ligue || x.saison !== m.saison || quand(x) >= quand(m)) continue;
    n++;
    if (x.dom === equipe) { bm += x.bd; be += x.be; } else { bm += x.be; be += x.bd; }
  }
  return { butsMarques: bm, butsEncaisses: be, matchsJoues: n };
}
function championnatDe(equipe: number, m: any): number | null {
  for (const saison of [m.saison, m.saison - 1]) {
    const compte = new Map<number, number>();
    for (const x of parEquipe.get(equipe) ?? [])
      if (!COUPES.has(x.ligue) && x.saison === saison && quand(x) < quand(m)) compte.set(x.ligue, (compte.get(x.ligue) ?? 0) + 1);
    let best: number | null = null, max = 0;
    for (const [id, n] of compte) if (n > max) { max = n; best = id; }
    if (best !== null) return best;
  }
  return null;
}

function pronostic(s1: any, s2: any, occ: any) {
  const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ);
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)];
  const somme = p[0] + p[1] + p[2] || 1;
  return { parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2, probas: p.map((x) => x / somme) };
}
const reel = (m: any) => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);
const brier = (p: number[], r: number) => p.reduce((s, v, i) => s + (v - (i === r ? 1 : 0)) ** 2, 0);
const choix = (p: number[]) => p.indexOf(Math.max(...p));

type Paire = { m: any; avant: { parScore: number; probas: number[] }; apres: { parScore: number; probas: number[] } };

function bilan(titre: string, paires: Paire[]) {
  const moitie = Math.floor(paires.length / 2);
  console.log(`══ ${titre} — ${paires.length} matchs comparables ══`);
  for (const [nom, l] of [
    [`1re moitié (${paires[0]?.m.date.slice(0, 10) ?? '—'} → ${paires[moitie - 1]?.m.date.slice(0, 10) ?? '—'})`, paires.slice(0, moitie)],
    [`2e moitié  (${paires[moitie]?.m.date.slice(0, 10) ?? '—'} → ${paires[paires.length - 1]?.m.date.slice(0, 10) ?? '—'})`, paires.slice(moitie)],
    ['ensemble', paires],
  ] as const) {
    if (!l.length) { console.log(`  ${nom} : —`); continue; }
    const j = (k: 'avant' | 'apres') => l.filter((x) => x[k].parScore === reel(x.m)).length;
    const b = (k: 'avant' | 'apres') => l.reduce((s, x) => s + brier(x[k].probas, reel(x.m)), 0) / l.length;
    const s60 = (k: 'avant' | 'apres') => {
      const s = l.filter((x) => Math.max(...x[k].probas) >= 0.6);
      return s.length ? `${((100 * s.filter((x) => choix(x[k].probas) === reel(x.m)).length) / s.length).toFixed(1)} % sur ${s.length}` : '—';
    };
    const pc = (a: number) => `${((100 * a) / l.length).toFixed(1)} %`;
    console.log(
      `  ${nom.padEnd(40)} n=${String(l.length).padStart(4)}   vainqueur ${pc(j('avant'))} → ${pc(j('apres'))} ` +
        `(${j('apres') - j('avant') >= 0 ? '+' : ''}${j('apres') - j('avant')})   Brier ${b('avant').toFixed(4)} → ${b('apres').toFixed(4)}   ` +
        `sûr ≥ 60 % : ${s60('avant')} → ${s60('apres')}`
    );
  }
  console.log('');
}

// ── POPULATION 1 : LES COUPES D'EUROPE DE LEURS CLUBS ──────────────────────
const coupes: Paire[] = [];
for (const m of tout) {
  if (![2, 3, 848].includes(m.ligue) || m.date < '2025-08-01') continue;
  const l1 = championnatDe(m.dom, m), l2 = championnatDe(m.ext, m);
  if (!(l1 !== null && IDS_NOUVEAUX.has(l1)) && !(l2 !== null && IDS_NOUVEAUX.has(l2))) continue;
  const c1 = statsAvant(m.dom, m), c2 = statsAvant(m.ext, m);
  if (c1.matchsJoues < 1 || c2.matchsJoues < 1) continue;
  const jour = m.date.slice(0, 10);
  const occE = butsAttendusOccasions(releveLaVeille('elargi', jour), m.nomDom, m.nomExt);
  if (!occE) continue;
  const occA = butsAttendusOccasions(releveLaVeille('actuel', jour), m.nomDom, m.nomExt);
  coupes.push({ m, avant: pronostic(c1, c2, occA), apres: pronostic(c1, c2, occE) });
}

// ── POPULATION 2 : LEURS MATCHS DE CHAMPIONNAT ─────────────────────────────
const national: Paire[] = [];
for (const m of tout) {
  if (!IDS_NOUVEAUX.has(m.ligue) || m.date < '2025-08-01') continue;
  const c1 = statsAvant(m.dom, m), c2 = statsAvant(m.ext, m);
  if (c1.matchsJoues < 1 || c2.matchsJoues < 1) continue;
  const occE = butsAttendusOccasions(releveLaVeille('elargi', m.date.slice(0, 10)), m.nomDom, m.nomExt);
  if (!occE) continue;
  // Aujourd'hui, ces championnats ne sont pas au relevé : pas de tirs.
  national.push({ m, avant: pronostic(c1, c2, null), apres: pronostic(c1, c2, occE) });
}

bilan('COUPES — matchs européens des clubs roumains, serbes, irlandais et finlandais', coupes);
bilan('NATIONAL — leurs matchs de championnat', national);
for (const id of IDS_NOUVEAUX) bilan(`  dont ${NOUVELLES[id]}`, national.filter((x) => x.m.ligue === id));
