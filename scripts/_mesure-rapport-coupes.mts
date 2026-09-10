/**
 * LE RAPPORT ENTRE CHAMPIONNATS AURAIT-IL SAUVÉ LES MATCHS DE COUPE ?
 *
 * Lecture seule. Le pré-calcul passe `1` comme rapport entre championnats :
 * les pronostics figés des coupes d'Europe n'ont jamais reçu l'ajustement que
 * la route d'analyse applique. On rejoue ici, sur les matchs de coupe déjà
 * jugés, ce que ce rapport aurait changé.
 *
 * ── LA MÊME GRILLE DES DEUX CÔTÉS ─────────────────────────────────────────
 *
 * Référence et variante sont recalculées par la MÊME loi de Poisson à partir
 * des buts attendus figés. La seule différence entre les deux est le rapport :
 * ce qui bouge, c'est lui, et rien d'autre.
 *
 * ── HORS ÉCHANTILLON ──────────────────────────────────────────────────────
 *
 * Les coefficients ont été appris le 24 août 2026 sur les matchs de coupe
 * connus à cette date. Les rencontres antérieures peuvent donc avoir servi à
 * les apprendre : le verdict qui compte porte sur les rencontres jouées APRÈS.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { apiFootball, CACHE_TTL } = await import('../src/lib/api-football.js');
const { rapportEntreChampionnats } = await import('../src/lib/forces-championnats.js');
const sb = createAdminClient();

// ── LES COEFFICIENTS, LUS SANS LE GARDE-TEMPS DE 1,5 s ─────────────────────
const { data: rel } = await sb.from('cache_api').select('contenu').eq('cle', 'forces-championnats:v1').maybeSingle();
const forces: any = rel?.contenu ?? null;
if (!forces?.coefficients) { console.log('hiérarchie introuvable'); process.exit(1); }
const APPRIS_LE = String(forces.calculeLe ?? '2026-08-24').slice(0, 10);
console.log(`hiérarchie apprise le ${APPRIS_LE}, ${Object.keys(forces.coefficients).length} championnats\n`);

// ── LES MATCHS DE COUPE JUGÉS ──────────────────────────────────────────────
const jug: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  jug.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const coupes = jug.filter((j) => /champions league|europa|conference/i.test(String(j.ligue)));
const ids = coupes.map((j) => Number(j.fixture_id));
const { data: pron } = await sb.from('predictions_match').select('fixture_id, domicile_id, exterieur_id, xg_domicile, xg_exterieur').in('fixture_id', ids);
const parFixture = new Map<number, any>();
for (const p of pron ?? []) parFixture.set(Number(p.fixture_id), p);

// ── LE CHAMPIONNAT NATIONAL DE CHAQUE CLUB ─────────────────────────────────
const cacheLigue = new Map<number, number | null>();
async function championnatDe(equipe: number): Promise<number | null> {
  if (cacheLigue.has(equipe)) return cacheLigue.get(equipe)!;
  let trouve: number | null = null;
  for (const s of [2026, 2025]) {
    const r: any = await apiFootball(`/leagues?team=${equipe}&season=${s}`, CACHE_TTL.TEAM_INFO);
    const c = (r?.response ?? []).find((x: any) => x?.league?.type === 'League');
    if (c?.league?.id) { trouve = Number(c.league.id); break; }
    await new Promise((res) => setTimeout(res, 350));
  }
  cacheLigue.set(equipe, trouve);
  return trouve;
}

// ── POISSON + DIXON-COLES, LA MÊME POUR LES DEUX ───────────────────────────
const RHO = -0.1;
const pois = (k: number, l: number) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return Math.exp(-l) * Math.pow(l, k) / f; };
function issues(l1: number, l2: number) {
  let v1 = 0, n = 0, v2 = 0;
  for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) {
    let t = 1;
    if (i === 0 && j === 0) t = 1 - l1 * l2 * RHO;
    else if (i === 0 && j === 1) t = 1 + l1 * RHO;
    else if (i === 1 && j === 0) t = 1 + l2 * RHO;
    else if (i === 1 && j === 1) t = 1 - RHO;
    const p = pois(i, l1) * pois(j, l2) * t;
    if (i > j) v1 += p; else if (i === j) n += p; else v2 += p;
  }
  const s = v1 + n + v2;
  return [v1 / s, n / s, v2 / s];
}
const borne = (x: number) => Math.min(4, Math.max(0.25, x));
const reel = (j: any) => (j.buts_reels_domicile > j.buts_reels_exterieur ? 0 : j.buts_reels_domicile === j.buts_reels_exterieur ? 1 : 2);
const choix = (p: number[]) => p.indexOf(Math.max(...p));
const brier = (p: number[], r: number) => p.reduce((s, v, i) => s + (v - (i === r ? 1 : 0)) ** 2, 0);

type Ligne = { j: any; r: number; base: number[]; ajuste: number[]; apres: boolean };
const lignes: Ligne[] = [];
let sansDonnees = 0;
for (const j of coupes) {
  const p = parFixture.get(Number(j.fixture_id));
  const x1 = Number(p?.xg_domicile ?? j.buts_attendus_domicile);
  const x2 = Number(p?.xg_exterieur ?? j.buts_attendus_exterieur);
  if (!p || !Number.isFinite(x1) || !Number.isFinite(x2) || x1 <= 0 || x2 <= 0) { sansDonnees++; continue; }
  const [l1, l2] = [await championnatDe(Number(p.domicile_id)), await championnatDe(Number(p.exterieur_id))];
  const r = rapportEntreChampionnats(forces, l1, l2);
  lignes.push({
    j, r,
    base: issues(x1, x2),
    ajuste: issues(borne(x1 * r), borne(x2 / r)),
    apres: String(j.date_match).slice(0, 10) > APPRIS_LE,
  });
}

function bilan(titre: string, l: Ligne[]) {
  if (!l.length) { console.log(`  ${titre.padEnd(44)} —`); return; }
  const jb = l.filter((x) => choix(x.base) === reel(x.j)).length;
  const ja = l.filter((x) => choix(x.ajuste) === reel(x.j)).length;
  const bb = l.reduce((s, x) => s + brier(x.base, reel(x.j)), 0) / l.length;
  const ba = l.reduce((s, x) => s + brier(x.ajuste, reel(x.j)), 0) / l.length;
  const pct = (a: number) => `${((100 * a) / l.length).toFixed(1)} %`;
  console.log(
    `  ${titre.padEnd(44)} n=${String(l.length).padStart(3)}   sans ${pct(jb).padStart(7)}   avec ${pct(ja).padStart(7)}   ` +
      `Brier ${bb.toFixed(4)} -> ${ba.toFixed(4)} ${ba < bb ? '(mieux)' : '(pire)'}`
  );
}

console.log(`${lignes.length} matchs de coupe rejoués (${sansDonnees} sans buts attendus)\n`);
const croises = lignes.filter((x) => x.r !== 1);
bilan('toutes les coupes', lignes);
bilan('  dont championnats différents (rapport ≠ 1)', croises);
bilan('HORS ÉCHANTILLON — après le ' + APPRIS_LE, lignes.filter((x) => x.apres));
bilan('  dont championnats différents', croises.filter((x) => x.apres));
bilan('DANS L’ÉCHANTILLON — avant', lignes.filter((x) => !x.apres));

console.log('\n=== les verdicts qui changent ===');
for (const x of lignes.filter((x) => choix(x.base) !== choix(x.ajuste))) {
  const lib = ['dom', 'nul', 'ext'];
  const ok = (p: number[]) => (choix(p) === reel(x.j) ? 'juste' : 'faux ');
  console.log(
    `  ${String(x.j.date_match).slice(0, 10)} ${x.apres ? 'HORS' : 'dans'}  ${String(x.j.equipe_domicile).slice(0, 18).padEnd(19)} ${String(x.j.equipe_exterieur).slice(0, 18).padEnd(19)} ` +
      `rapport ${x.r.toFixed(2)}  ${lib[choix(x.base)]} ${ok(x.base)} -> ${lib[choix(x.ajuste)]} ${ok(x.ajuste)}   réel ${x.j.buts_reels_domicile}-${x.j.buts_reels_exterieur}`
  );
}
console.log(`\n${[...cacheLigue.values()].filter((v) => v == null).length} club(s) sans championnat retrouvé, sur ${cacheLigue.size}`);
