import { createAdminClient } from '@/lib/supabase-admin';

/**
 * LE SUIVI DE PRÉCISION, SEMAINE PAR SEMAINE ET SEGMENT PAR SEGMENT.
 *
 * ── POURQUOI UN CHIFFRE GLOBAL NE SUFFIT PAS ──────────────────────────────
 *
 * « 53 % de réussite » ne dit pas si le moteur progresse ni où il souffre. Le
 * 24 août 2026, ce 53 % moyen cachait 57 % entre équipes d'un même
 * championnat et 43 % entre championnats différents — quatorze points d'écart
 * qui appelaient un correctif précis, invisibles dans la moyenne.
 *
 * Ce fichier découpe donc la mesure en deux : le temps, et le segment.
 *
 * ── LE DÉDOUBLONNAGE EST INDISPENSABLE ────────────────────────────────────
 *
 * Dix-sept abonnés analysent la même affiche. Compter les analyses au lieu des
 * matchs donnerait dix-sept fois le même verdict et ferait passer une seule
 * rencontre pour un échantillon. On ne compte donc qu'une fois chaque match,
 * en retenant la PREMIÈRE analyse : les suivantes relisent une prédiction
 * déjà figée.
 *
 * ── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * Il ne recalcule rien et ne prédit rien. Il lit ce qui a été annoncé avant le
 * match et ce qui est arrivé après, et compte. Toute autre méthode reviendrait
 * à se noter soi-même.
 */

/** Au-delà, on arrête de lire : le panneau doit rester rapide. */
const PLAFOND = 40000;

/** En dessous, un pourcentage décrit le hasard et non une performance. */
const MINIMUM_POUR_UN_TAUX = 8;

export interface SegmentPrecision {
  /** Matchs distincts, jamais analyses. */
  matchs: number;
  /** Pourcentage, `null` tant que l'échantillon est trop maigre. */
  vainqueur: number | null;
  scoreExact: number | null;
  /** Confiance moyenne affichée, pour la confronter à la réussite réelle. */
  confiance: number | null;
  /** Écart entre ce qui est promis et ce qui est tenu. Positif = trop sûr. */
  ecartConfiance: number | null;
}

export interface SemainePrecision extends SegmentPrecision {
  /** Lundi de la semaine, en ISO court. */
  debut: string;
}

export interface SuiviPrecision {
  vide: boolean;
  ensemble: SegmentPrecision;
  memeChampionnat: SegmentPrecision;
  championnatsCroises: SegmentPrecision;
  semaines: SemainePrecision[];
  /** Analyses lues, avant dédoublonnage — pour expliquer l'écart des chiffres. */
  analysesLues: number;
}

const vide = (): SegmentPrecision => ({
  matchs: 0, vainqueur: null, scoreExact: null, confiance: null, ecartConfiance: null,
});

type Ligne = {
  fixture_id: number | null;
  team1_name: string | null;
  team2_name: string | null;
  team1_league: string | null;
  team2_league: string | null;
  competition: string | null;
  confidence: number | null;
  score: string | null;
  real_score: string | null;
  real_winner: string | null;
  winner_correct: boolean | null;
  verified_at: string;
};

const lireScore = (s: string | null): [number, number] | null => {
  const m = String(s ?? '').replace(/\s/g, '').match(/^(\d+)-(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

function mesurer(liste: Ligne[]): SegmentPrecision {
  if (!liste.length) return vide();

  let justes = 0;
  let exacts = 0;
  let avecScore = 0;
  let confiances = 0;
  let sommeConfiance = 0;

  for (const a of liste) {
    if (a.winner_correct) justes++;
    const p = lireScore(a.score);
    const r = lireScore(a.real_score);
    if (p && r) {
      avecScore++;
      if (p[0] === r[0] && p[1] === r[1]) exacts++;
    }
    const c = Number(a.confidence);
    if (Number.isFinite(c) && c > 0) { confiances++; sommeConfiance += c; }
  }

  const arrondi = (v: number) => Math.round(v * 10) / 10;
  const assez = liste.length >= MINIMUM_POUR_UN_TAUX;
  const vainqueur = assez ? arrondi((justes / liste.length) * 100) : null;
  const confiance = confiances ? arrondi(sommeConfiance / confiances) : null;

  return {
    matchs: liste.length,
    vainqueur,
    scoreExact: assez && avecScore ? arrondi((exacts / avecScore) * 100) : null,
    confiance,
    // Positif : le moteur promet plus qu'il ne tient. C'est le chiffre qui
    // dit si la confiance affichée mérite d'être crue.
    ecartConfiance: vainqueur !== null && confiance !== null ? arrondi(confiance - vainqueur) : null,
  };
}

/** Le lundi de la semaine d'une date, en ISO court. */
export function lundiDe(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const jour = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - jour))
    .toISOString()
    .slice(0, 10);
}

/**
 * Le calcul, séparé de la lecture pour être vérifiable.
 *
 * Les épreuves lui donnent des analyses fabriquées et contrôlent que le
 * dédoublonnage et la segmentation tiennent.
 */
export function calculerSuivi(analyses: Ligne[]): SuiviPrecision {
  if (!analyses.length) {
    return {
      vide: true, ensemble: vide(), memeChampionnat: vide(), championnatsCroises: vide(),
      semaines: [], analysesLues: 0,
    };
  }

  // ── UN MATCH, UNE OBSERVATION ───────────────────────────────────────────
  const parMatch = new Map<string, Ligne>();
  for (const a of analyses) {
    const cle = a.fixture_id
      ? `f${a.fixture_id}`
      : [a.team1_name, a.team2_name].sort().join('|') + '|' + a.competition;
    if (!parMatch.has(cle)) parMatch.set(cle, a);
  }
  const matchs = [...parMatch.values()];

  const connus = matchs.filter((a) => a.team1_league && a.team2_league);
  const memes = connus.filter((a) => String(a.team1_league) === String(a.team2_league));
  const croises = connus.filter((a) => String(a.team1_league) !== String(a.team2_league));

  // ── SEMAINE PAR SEMAINE ─────────────────────────────────────────────────
  const parSemaine = new Map<string, Ligne[]>();
  for (const a of matchs) {
    const lundi = lundiDe(a.verified_at);
    if (!lundi) continue;
    const l = parSemaine.get(lundi);
    if (l) l.push(a); else parSemaine.set(lundi, [a]);
  }

  const semaines: SemainePrecision[] = [...parSemaine.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([debut, l]) => ({ debut, ...mesurer(l) }));

  return {
    vide: false,
    ensemble: mesurer(matchs),
    memeChampionnat: mesurer(memes),
    championnatsCroises: mesurer(croises),
    semaines,
    analysesLues: analyses.length,
  };
}

/** Lit l'historique vérifié et en tire le suivi. */
export async function lireSuiviPrecision(): Promise<SuiviPrecision> {
  const admin = createAdminClient();
  const analyses: Ligne[] = [];

  try {
    for (let de = 0; de < PLAFOND; de += 1000) {
      const { data, error } = await admin
        .from('analysis_history')
        .select(
          'fixture_id, team1_name, team2_name, team1_league, team2_league, competition, ' +
          'confidence, score, real_score, real_winner, winner_correct, verified_at'
        )
        .not('verified_at', 'is', null)
        .not('real_winner', 'is', null)
        .order('verified_at', { ascending: true })
        .range(de, de + 999);

      if (error) throw error;
      if (!data?.length) break;
      analyses.push(...(data as unknown as Ligne[]));
      if (data.length < 1000) break;
    }
  } catch (e: any) {
    console.error('[SUIVI] Lecture impossible :', e?.message);
    return calculerSuivi([]);
  }

  return calculerSuivi(analyses);
}
