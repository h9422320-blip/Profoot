/**
 * LA MOITIÉ « OCCASIONS » DOIT-ELLE, ELLE AUSSI, PASSER PAR LE RAPPORT ENTRE
 * CHAMPIONNATS ?
 *
 * Lecture seule. Rien n'est écrit, aucun réglage n'est touché.
 *
 * ── LA QUESTION ───────────────────────────────────────────────────────────
 *
 * Chaque club du relevé des tirs est mesuré par rapport à SON championnat.
 * Le 10 septembre 2026 : Bayern 1,50 contre Bodø/Glimt 1,61 ; Slavia 1,79
 * contre Lens 1,25 — Slavia annoncé à 78 % dans « les mieux cernés », battu
 * 2-3. Or cette moitié pèse 60 % du calcul, et le rapport entre championnats
 * ne touche que les 40 % restants.
 *
 * ── LES QUATRE LECTURES ───────────────────────────────────────────────────
 *
 *   V0  pré-calcul actuel : rapport 1 partout, occasions telles quelles
 *   V1  le rapport sur les seules occasions
 *   V2  le rapport partout — occasions et calcul classique
 *   V3  la route d'analyse actuelle : rapport sur le calcul classique seul
 *
 * Toutes passent par le VRAI `calculerScoreProbable` et le VRAI calcul des
 * forces, `forcesDepuisRencontres`, rejoué la veille de chaque match sur les
 * seules rencontres connues à cette date.
 *
 * ── DEUX PÉRIODES, JAMAIS MÉLANGÉES ───────────────────────────────────────
 *
 *   P1  coupes du 15 janvier au 30 juin 2026, rapport appris avant le 15 janvier
 *   P2  coupes depuis le 1er juillet 2026, rapport appris avant le 1er juillet
 *
 * Une lecture ne part en ligne que si elle gagne sur LES DEUX, au critère du
 * propriétaire : le vainqueur annoncé.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { calculerScoreProbable } = await import('../src/lib/score-probable.js');
const { apprendre, rapportEntreChampionnats } = await import('../src/lib/forces-championnats.js');
const { forcesDepuisRencontres, butsAttendusOccasions, CHAMPIONNATS } = await import('../src/lib/forme-occasions.js');
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const FICHIER =
  'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
tout.sort((a, b) => a.date.localeCompare(b.date));
const quand = (x: any) => Date.parse(x.date);
const meta = new Map<number, any>(tout.map((x) => [Number(x.id), x]));
const nomDeLigue = new Map<number, string>(CHAMPIONNATS.map((c: any) => [Number(c.id), String(c.nom)]));
const idDeLigue = new Map<string, number>(CHAMPIONNATS.map((c: any) => [String(c.nom), Number(c.id)]));

// ── LES TIRS, MATCH PAR MATCH, TELS QU'ILS DORMENT EN RÉSERVE ──────────────
//
// Même lecture que `construireForces` : le bloc de chaque équipe se retrouve
// par son NOM, et les deux nombres retenus sont les tirs cadrés et les tirs
// dans la surface.
const nombre = (stats: any[] | undefined, type: string): number => {
  const s = (stats ?? []).find((x) => x?.type === type);
  const v = s?.value;
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? Number(String(v).replace('%', '')) || 0 : Number(v) || 0;
};
const tirs: any[] = [];
for (let de = 0; de < 40000; de += 1000) {
  const { data, error } = await sb
    .from('cache_api')
    .select('cle, contenu')
    .ilike('cle', 'apifb:/fixtures/statistics?fixture=%')
    .range(de, de + 999);
  if (error) { console.log('lecture impossible : ' + error.message); process.exit(1); }
  for (const d of data ?? []) {
    const m = meta.get(Number(String(d.cle).split('=').pop()));
    if (!m) continue;
    const ligue = nomDeLigue.get(Number(m.ligue));
    if (!ligue) continue;
    const c: any = d.contenu;
    const rep = Array.isArray(c) ? c : c?.response ?? [];
    if (rep.length < 2) continue;
    const bloc = (nom: string) => rep.find((x: any) => x?.team?.name === nom);
    const dd = bloc(m.nomDom), ee = bloc(m.nomExt);
    if (!dd || !ee) continue;
    tirs.push({
      ligue, date: quand(m), dom: m.nomDom, ext: m.nomExt,
      cadresD: nombre(dd.statistics, 'Shots on Goal'), surfaceD: nombre(dd.statistics, 'Shots insidebox'),
      cadresE: nombre(ee.statistics, 'Shots on Goal'), surfaceE: nombre(ee.statistics, 'Shots insidebox'),
      butsD: Number(m.bd ?? 0), butsE: Number(m.be ?? 0),
    });
  }
  if (!data || data.length < 1000) break;
}
console.log(`${tirs.length} rencontres avec leurs tirs, rattachées à une compétition du relevé`);

// ── LE RELEVÉ, TEL QU'IL AURAIT ÉTÉ LA VEILLE ──────────────────────────────
const JOURS_RELUS = 240;
const releves = new Map<string, any>();
function releveLaVeille(jour: string) {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const debut = fin - JOURS_RELUS * 86_400_000;
  // Une COPIE : le calcul trie sur place.
  const l = tirs.filter((t) => t.date >= debut && t.date < fin).map((t) => ({ ...t }));
  // La construction de production ne calcule rien sous cent rencontres.
  const r = l.length >= 100 ? forcesDepuisRencontres(l, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
  return r;
}

// ── LE CALCUL CLASSIQUE, COMME LE PRÉ-CALCUL : LA COUPE SEULE ──────────────
const parEquipe = new Map<number, any[]>();
for (const m of tout)
  for (const e of [m.dom, m.ext]) {
    if (!parEquipe.has(e)) parEquipe.set(e, []);
    parEquipe.get(e)!.push(m);
  }
function coupeAvant(equipe: number, m: any) {
  let bm = 0, be = 0, n = 0;
  for (const x of parEquipe.get(equipe) ?? []) {
    if (x.ligue !== m.ligue || x.saison !== m.saison || quand(x) >= quand(m)) continue;
    n++;
    if (x.dom === equipe) { bm += x.bd; be += x.be; } else { bm += x.be; be += x.bd; }
  }
  return { butsMarques: bm, butsEncaisses: be, matchsJoues: n };
}

function pronostic(s1: any, s2: any, rapport: number, occ: { domicile: number; exterieur: number } | null) {
  const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, rapport, occ);
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)];
  const somme = p[0] + p[1] + p[2] || 1;
  return { parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2, probas: p.map((x) => x / somme) };
}
const reel = (m: any) => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);
const brier = (p: number[], r: number) => p.reduce((s, v, i) => s + (v - (i === r ? 1 : 0)) ** 2, 0);
const choix = (p: number[]) => p.indexOf(Math.max(...p));

function periode(titre: string, coupure: string, debut: string, fin: string) {
  const forces = apprendre(
    tout.filter((x) => x.date < coupure).map((x) => ({ date: x.date, ligue: x.ligue, dom: x.dom, ext: x.ext, butsDom: x.bd, butsExt: x.be }))
  );
  const matchs = tout.filter((x) => [2, 3, 848].includes(x.ligue) && x.date >= debut && x.date < fin);
  const lectures: Record<string, { m: any; parScore: number; probas: number[]; r: number }[]> = { V0: [], V1: [], V2: [], V3: [] };
  let sansOcc = 0, sansCoupe = 0;

  for (const m of matchs) {
    const rel = releveLaVeille(m.date.slice(0, 10));
    const occ = butsAttendusOccasions(rel, m.nomDom, m.nomExt);
    if (!occ) { sansOcc++; continue; }
    const c1 = coupeAvant(m.dom, m), c2 = coupeAvant(m.ext, m);
    if (c1.matchsJoues < 1 || c2.matchsJoues < 1) { sansCoupe++; continue; }
    const r = rapportEntreChampionnats(forces, idDeLigue.get(rel.clubs[m.nomDom].ligue), idDeLigue.get(rel.clubs[m.nomExt].ligue));
    const occR = { domicile: occ.domicile * r, exterieur: occ.exterieur / r };
    lectures.V0.push({ m, r, ...pronostic(c1, c2, 1, occ) });
    lectures.V1.push({ m, r, ...pronostic(c1, c2, 1, occR) });
    lectures.V2.push({ m, r, ...pronostic(c1, c2, r, occR) });
    lectures.V3.push({ m, r, ...pronostic(c1, c2, r, occ) });
  }

  console.log(`\n══ ${titre} ══`);
  console.log(`  ${matchs.length} matchs de coupe ; ${sansOcc} sans lecture des occasions, ${sansCoupe} que le pré-calcul sauterait`);
  const ligne = (nom: string, l: any[], ref: any[]) => {
    if (!l.length) return console.log(`  ${nom.padEnd(22)} —`);
    const js = l.filter((x) => x.parScore === reel(x.m)).length;
    const jr = ref.filter((x) => x.parScore === reel(x.m)).length;
    const br = l.reduce((s, x) => s + brier(x.probas, reel(x.m)), 0) / l.length;
    const s60 = l.filter((x) => Math.max(...x.probas) >= 0.6), s70 = l.filter((x) => Math.max(...x.probas) >= 0.7);
    const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
    const ok = (l2: any[]) => l2.filter((x) => choix(x.probas) === reel(x.m)).length;
    console.log(
      `  ${nom.padEnd(22)} n=${String(l.length).padStart(3)}  vainqueur ${pc(js, l.length).padStart(7)}` +
        `${l === ref ? '        ' : ` (${js - jr >= 0 ? '+' : ''}${js - jr})`.padEnd(8)}` +
        `  Brier ${br.toFixed(4)}   ≥60 % : ${pc(ok(s60), s60.length)} sur ${s60.length}   ≥70 % : ${pc(ok(s70), s70.length)} sur ${s70.length}`
    );
  };
  for (const [sous, filtre] of [['toutes', (_: any) => true], ['championnats différents', (x: any) => x.r !== 1]] as const) {
    console.log(`  — ${sous} —`);
    const ref = lectures.V0.filter(filtre as any);
    ligne('V0 pré-calcul actuel', ref, ref);
    ligne('V1 rapport occasions', lectures.V1.filter(filtre as any), ref);
    ligne('V2 rapport partout', lectures.V2.filter(filtre as any), ref);
    ligne('V3 route actuelle', lectures.V3.filter(filtre as any), ref);
  }
  const lib = ['dom', 'nul', 'ext'];
  const bascules = lectures.V0.map((x, i) => [x, lectures.V2[i]] as const).filter(([a, b]) => a.parScore !== b.parScore);
  console.log(`  verdicts qui changent entre V0 et V2 : ${bascules.length}`);
  for (const [a, b] of bascules.slice(0, 14))
    console.log(
      `    ${a.m.date.slice(0, 10)}  ${String(a.m.nomDom).slice(0, 18).padEnd(19)} ${String(a.m.nomExt).slice(0, 18).padEnd(19)} rapport ${a.r.toFixed(2)}  ` +
        `${lib[a.parScore]} ${a.parScore === reel(a.m) ? 'juste' : 'faux '} -> ${lib[b.parScore]} ${b.parScore === reel(b.m) ? 'juste' : 'faux '}   réel ${a.m.bd}-${a.m.be}`
    );
}

periode('P1 — coupes du 15 janvier au 30 juin 2026', '2026-01-15', '2026-01-15', '2026-07-01');
periode('P2 — coupes depuis le 1er juillet 2026', '2026-07-01', '2026-07-01', '2027-07-01');
