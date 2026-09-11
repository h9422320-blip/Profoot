/**
 * LES TIRS RENDENT-ILS LE MOTEUR PLUS JUSTE EN COUPE D'EUROPE ?
 * ET QUELS CHAMPIONNATS MANQUANTS L'EN PRIVENT LE PLUS SOUVENT ?
 *
 * Lecture seule. Rien n'est écrit, aucun réglage n'est touché.
 *
 * ── POURQUOI CETTE QUESTION ───────────────────────────────────────────────
 *
 * La moitié « occasions » a été validée sur les CHAMPIONNATS (1 544
 * rencontres hors échantillon, justesse et Brier meilleurs dans les deux
 * périodes de contrôle). Elle n'a jamais été mesurée seule sur les COUPES.
 *
 * Or `butsAttendusOccasions` rend `null` dès qu'UN des deux clubs manque au
 * relevé : le 10 septembre 2026, Sabah manquait, et Manchester United –
 * Sabah s'est joué sans les tirs. Mesuré sur les coupes depuis juillet 2026 :
 * 279 matchs sur 402 dans ce cas.
 *
 * Ajouter les championnats de ces clubs n'a de sens que si les tirs aident
 * AUSSI en coupe. D'où les deux parties de ce relevé.
 *
 * ── PARTIE 1 : AVEC OU SANS LES TIRS, MÊME MATCH ──────────────────────────
 *
 * Sur les matchs où les deux clubs sont au relevé, on compare le pré-calcul
 * tel qu'il tourne (tirs compris) au même calcul sans les tirs. Le relevé est
 * reconstruit la veille de chaque match par le VRAI calcul,
 * `forcesDepuisRencontres`, sur les seules rencontres connues à cette date.
 * Deux périodes séparées, comme toujours.
 *
 * ── PARTIE 2 : CE QUI BLOQUE ──────────────────────────────────────────────
 *
 * Pour chaque match privé de tirs, le championnat du ou des clubs absents.
 * Un championnat déjà suivi mais dont le club a trop peu de matchs n'est pas
 * compté comme « à ajouter » : il reviendra seul en cours de saison.
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

const FICHIER =
  'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
tout.sort((a, b) => a.date.localeCompare(b.date));
const quand = (x: any) => Date.parse(x.date);
const meta = new Map<number, any>(tout.map((x) => [Number(x.id), x]));
const nomDeLigue = new Map<number, string>(CHAMPIONNATS.map((c: any) => [Number(c.id), String(c.nom)]));
const COUPES = new Set([2, 3, 848, 531]);

// ── LES TIRS EN RÉSERVE, LUS COMME LES LIT LA CONSTRUCTION ─────────────────
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
console.log(`${tirs.length} rencontres avec leurs tirs\n`);

const releves = new Map<string, any>();
function releveLaVeille(jour: string) {
  if (releves.has(jour)) return releves.get(jour);
  const fin = Date.parse(`${jour}T00:00:00Z`);
  const l = tirs.filter((t) => t.date >= fin - 240 * 86_400_000 && t.date < fin).map((t) => ({ ...t }));
  const r = l.length >= 100 ? forcesDepuisRencontres(l, undefined, new Date(fin).toISOString()) : null;
  releves.set(jour, r);
  return r;
}

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
/** Le championnat où l'équipe a le plus joué, cette saison ou la précédente. */
function championnatDe(equipe: number, m: any): { id: number; nom: string } | null {
  for (const saison of [m.saison, m.saison - 1]) {
    const compte = new Map<number, { n: number; nom: string }>();
    for (const x of parEquipe.get(equipe) ?? []) {
      if (COUPES.has(x.ligue) || x.saison !== saison || quand(x) >= quand(m)) continue;
      const c = compte.get(x.ligue) ?? { n: 0, nom: x.nomLigue };
      c.n++;
      compte.set(x.ligue, c);
    }
    let best: { id: number; nom: string } | null = null, max = 0;
    for (const [id, c] of compte) if (c.n > max) { max = c.n; best = { id, nom: c.nom }; }
    if (best) return best;
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

const bloquants = new Map<string, { matchs: number; suivi: boolean; clubs: Set<string> }>();

function periode(titre: string, debut: string, fin: string) {
  const matchs = tout.filter((x) => [2, 3, 848].includes(x.ligue) && x.date >= debut && x.date < fin);
  const avec: any[] = [], sans: any[] = [];
  let prives = 0, sautes = 0;
  for (const m of matchs) {
    const c1 = coupeAvant(m.dom, m), c2 = coupeAvant(m.ext, m);
    if (c1.matchsJoues < 1 || c2.matchsJoues < 1) { sautes++; continue; }
    const rel = releveLaVeille(m.date.slice(0, 10));
    const occ = butsAttendusOccasions(rel, m.nomDom, m.nomExt);
    if (!occ) {
      prives++;
      for (const [equipe, nom] of [[m.dom, m.nomDom], [m.ext, m.nomExt]] as const) {
        if (rel?.clubs?.[nom]) continue;
        const ch = championnatDe(equipe, m);
        const cle = ch ? `${ch.nom} (${ch.id})` : '(championnat introuvable)';
        const b = bloquants.get(cle) ?? { matchs: 0, suivi: !!ch && nomDeLigue.has(ch.id), clubs: new Set<string>() };
        b.matchs++;
        b.clubs.add(nom);
        bloquants.set(cle, b);
      }
      continue;
    }
    avec.push({ m, ...pronostic(c1, c2, occ) });
    sans.push({ m, ...pronostic(c1, c2, null) });
  }
  console.log(`══ ${titre} ══`);
  console.log(`  ${matchs.length} matchs de coupe ; ${sautes} sautés par le pré-calcul, ${prives} privés de tirs, ${avec.length} comparables`);
  const ligne = (nom: string, l: any[]) => {
    const js = l.filter((x) => x.parScore === reel(x.m)).length;
    const br = l.reduce((s, x) => s + brier(x.probas, reel(x.m)), 0) / (l.length || 1);
    const s60 = l.filter((x) => Math.max(...x.probas) >= 0.6);
    const ok60 = s60.filter((x) => choix(x.probas) === reel(x.m)).length;
    console.log(
      `  ${nom.padEnd(14)} vainqueur ${l.length ? ((100 * js) / l.length).toFixed(1) : '—'} % (${js}/${l.length})   ` +
        `Brier ${br.toFixed(4)}   sûr ≥ 60 % : ${s60.length ? ((100 * ok60) / s60.length).toFixed(1) + ' %' : '—'} sur ${s60.length}`
    );
  };
  ligne('sans les tirs', sans);
  ligne('avec les tirs', avec);
  console.log('');
}

periode('P1 — coupes du 15 janvier au 30 juin 2026', '2026-01-15', '2026-07-01');
periode('P2 — coupes depuis le 1er juillet 2026', '2026-07-01', '2027-07-01');

console.log('══ Les championnats qui privent le plus de matchs de leurs tirs ══');
console.log('  (« suivi » : déjà au relevé, le club manque seulement de matchs — il reviendra seul)');
for (const [cle, b] of [...bloquants].sort((a, b) => b[1].matchs - a[1].matchs).slice(0, 20))
  console.log(
    `  ${String(b.matchs).padStart(4)} match(s)  ${cle.padEnd(38)} ${b.suivi ? 'suivi   ' : 'À AJOUTER'}  ${[...b.clubs].slice(0, 4).join(', ')}`
  );
