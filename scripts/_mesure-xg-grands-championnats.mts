/**
 * LES BUTS ATTENDUS DU FOURNISSEUR (xG) LISENT-ILS MIEUX LES GRANDS
 * CHAMPIONNATS QUE LES TIRS ?
 *
 * Lecture seule. Rien n'est écrit, aucun réglage n'est touché.
 *
 * ── LA QUESTION ───────────────────────────────────────────────────────────
 *
 * Le relevé mesure une équipe à ses tirs cadrés et à ses tirs dans la
 * surface, comptés sans égard pour leur qualité : une frappe molle de vingt
 * mètres cadrée vaut autant qu'un face-à-face. Les xG du fournisseur pèsent
 * chaque tir selon sa probabilité de finir au fond. Ils sont présents sur
 * 92 à 96 % des fiches des sept grands championnats.
 *
 * Priorité fixée par le propriétaire le 11 septembre 2026 : les grands
 * championnats d'abord — et c'est là que le moteur est le plus faible quand
 * il est sûr de lui : Premier League 54,1 %, Ligue 1 58,2 %.
 *
 * ── LE MÊME CALCUL, UNE SEULE CHOSE QUI CHANGE ────────────────────────────
 *
 * Deux relevés, reconstruits la veille de chaque match par le VRAI calcul,
 * `forcesDepuisRencontres`, sur EXACTEMENT les mêmes rencontres — celles dont
 * les deux équipes ont leurs xG :
 *
 *   TIRS  les tirs cadrés et dans la surface, comme aujourd'hui ;
 *   XG    les xG, passés dans les deux champs de tirs.
 *
 * Pourquoi cela suffit : le calcul transforme les tirs en « occasions » par
 * `0,5 × (taux_cadré × cadrés + taux_surface × surface)`, où chaque taux vaut
 * le total des buts divisé par le total de ce champ. Les deux champs valant
 * l'xG, chaque occasion devient l'xG multiplié par une constante — et les
 * forces du relevé étant des RAPPORTS à l'étalon du championnat, cette
 * constante disparaît. On compare donc bien deux mesures, par le même code.
 *
 * Une troisième lecture, MOITIÉ-MOITIÉ, mélange les buts attendus des deux
 * relevés à la sortie.
 *
 * ── LE CONTRÔLE ───────────────────────────────────────────────────────────
 *
 * Matchs des sept grands championnats, coupés en deux dans le temps. Une
 * lecture ne part en ligne que si elle améliore le vainqueur annoncé dans les
 * DEUX moitiés sans dégrader le Brier.
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

const GRANDS: Record<number, string> = {
  39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga',
  61: 'Ligue 1', 94: 'Primeira Liga', 88: 'Eredivisie',
};
const nomDeLigue = new Map<number, string>(CHAMPIONNATS.map((c: any) => [Number(c.id), String(c.nom)]));

const FICHIER =
  'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
tout.sort((a, b) => a.date.localeCompare(b.date));
const quand = (x: any) => Date.parse(x.date);
const meta = new Map<number, any>(tout.map((x) => [Number(x.id), x]));

// ── LES FICHES EN RÉSERVE, LUES COMME LES LIT LA CONSTRUCTION ──────────────
const nombre = (stats: any[] | undefined, type: string): number | null => {
  const s = (stats ?? []).find((x) => x?.type === type);
  const v = s?.value;
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(String(v).replace('%', '')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const fiches: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
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
    const xgD = nombre(dd.statistics, 'expected_goals');
    const xgE = nombre(ee.statistics, 'expected_goals');
    // SEULES les rencontres qui ont leurs xG des DEUX côtés entrent : les deux
    // relevés doivent porter sur exactement la même matière.
    if (xgD === null || xgE === null) continue;
    fiches.push({
      ligue, date: quand(m), dom: m.nomDom, ext: m.nomExt,
      cadresD: nombre(dd.statistics, 'Shots on Goal') ?? 0, surfaceD: nombre(dd.statistics, 'Shots insidebox') ?? 0,
      cadresE: nombre(ee.statistics, 'Shots on Goal') ?? 0, surfaceE: nombre(ee.statistics, 'Shots insidebox') ?? 0,
      xgD, xgE, butsD: Number(m.bd ?? 0), butsE: Number(m.be ?? 0),
    });
  }
  if (!data || data.length < 1000) break;
}
const versTirs = (f: any) => ({ ligue: f.ligue, date: f.date, dom: f.dom, ext: f.ext, cadresD: f.cadresD, surfaceD: f.surfaceD, cadresE: f.cadresE, surfaceE: f.surfaceE, butsD: f.butsD, butsE: f.butsE });
const versXg = (f: any) => ({ ligue: f.ligue, date: f.date, dom: f.dom, ext: f.ext, cadresD: f.xgD, surfaceD: f.xgD, cadresE: f.xgE, surfaceE: f.xgE, butsD: f.butsD, butsE: f.butsE });
console.log(`${fiches.length} rencontres avec leurs xG des deux côtés, dans les compétitions du relevé\n`);

const releves = new Map<string, any>();
function releveLaVeille(mesure: 'tirs' | 'xg', jour: string) {
  const cle = `${mesure}|${jour}`;
  if (releves.has(cle)) return releves.get(cle);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const l = fiches.filter((f) => f.date >= fin - 240 * 86_400_000 && f.date < fin).map(mesure === 'tirs' ? versTirs : versXg);
  const r = l.length >= 100 ? forcesDepuisRencontres(l as any, undefined, new Date(fin).toISOString()) : null;
  releves.set(cle, r);
  return r;
}

// ── LE CALCUL CLASSIQUE, COMME LE PRÉ-CALCUL : LA SAISON DU CHAMPIONNAT ────
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
function pronostic(s1: any, s2: any, occ: any) {
  const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, 1, occ);
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)];
  const somme = p[0] + p[1] + p[2] || 1;
  return { parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2, probas: p.map((x) => x / somme) };
}
const reel = (m: any) => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);
const brier = (p: number[], r: number) => p.reduce((s, v, i) => s + (v - (i === r ? 1 : 0)) ** 2, 0);
const choix = (p: number[]) => p.indexOf(Math.max(...p));

type Ligne = { m: any; v: Record<string, { parScore: number; probas: number[] }> };
const lignes: Ligne[] = [];
let sansTirs = 0, sansXg = 0, sansStats = 0;
for (const m of tout) {
  if (!GRANDS[m.ligue] || m.date < '2026-01-15') continue;
  const s1 = statsAvant(m.dom, m), s2 = statsAvant(m.ext, m);
  if (s1.matchsJoues < 1 || s2.matchsJoues < 1) { sansStats++; continue; }
  const jour = m.date.slice(0, 10);
  const oT = butsAttendusOccasions(releveLaVeille('tirs', jour), m.nomDom, m.nomExt);
  const oX = butsAttendusOccasions(releveLaVeille('xg', jour), m.nomDom, m.nomExt);
  if (!oT) { sansTirs++; continue; }
  if (!oX) { sansXg++; continue; }
  const oM = { domicile: (oT.domicile + oX.domicile) / 2, exterieur: (oT.exterieur + oX.exterieur) / 2 };
  lignes.push({
    m,
    v: {
      'sans les tirs': pronostic(s1, s2, null),
      'TIRS (actuel)': pronostic(s1, s2, oT),
      'XG': pronostic(s1, s2, oX),
      'moitié-moitié': pronostic(s1, s2, oM),
    },
  });
}
console.log(`${lignes.length} matchs comparables (${sansStats} sans statistiques, ${sansTirs} sans relevé, ${sansXg} sans relevé xG)\n`);

function bilan(titre: string, l: Ligne[]) {
  const moitie = Math.floor(l.length / 2);
  console.log(`══ ${titre} ══`);
  for (const [nom, part] of [
    [`1re moitié ${l[0]?.m.date.slice(0, 10) ?? ''} → ${l[moitie - 1]?.m.date.slice(0, 10) ?? ''}`, l.slice(0, moitie)],
    [`2e moitié  ${l[moitie]?.m.date.slice(0, 10) ?? ''} → ${l[l.length - 1]?.m.date.slice(0, 10) ?? ''}`, l.slice(moitie)],
  ] as const) {
    if (!part.length) continue;
    console.log(`  ${nom}  (n=${part.length})`);
    const ref = part.filter((x) => x.v['TIRS (actuel)'].parScore === reel(x.m)).length;
    for (const variante of ['sans les tirs', 'TIRS (actuel)', 'XG', 'moitié-moitié']) {
      const j = part.filter((x) => x.v[variante].parScore === reel(x.m)).length;
      const b = part.reduce((s, x) => s + brier(x.v[variante].probas, reel(x.m)), 0) / part.length;
      const s60 = part.filter((x) => Math.max(...x.v[variante].probas) >= 0.6);
      const ok60 = s60.filter((x) => choix(x.v[variante].probas) === reel(x.m)).length;
      console.log(
        `    ${variante.padEnd(15)} vainqueur ${((100 * j) / part.length).toFixed(1).padStart(5)} %` +
          `${variante === 'TIRS (actuel)' ? '       ' : ` (${j - ref >= 0 ? '+' : ''}${j - ref})`.padEnd(7)}` +
          `   Brier ${b.toFixed(4)}   sûr ≥ 60 % : ${s60.length ? ((100 * ok60) / s60.length).toFixed(1) + ' %' : '—'} sur ${s60.length}`
      );
    }
  }
  console.log('');
}
bilan('LES SEPT GRANDS CHAMPIONNATS', lignes);
bilan('PREMIER LEAGUE seule', lignes.filter((x) => x.m.ligue === 39));
bilan('LIGUE 1 seule', lignes.filter((x) => x.m.ligue === 61));
