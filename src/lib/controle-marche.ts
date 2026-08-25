import { createAdminClient } from '@/lib/supabase-admin';
import { lireCotesEntre, type CoteMatch } from '@/lib/cotes-marche';

/**
 * LE MOTEUR CONTRE LE MARCHÉ, MESURÉ SUR NOS PROPRES PRONOSTICS.
 *
 * ── CE QU'IL RÉPOND, ET POURQUOI CE N'EST PAS LE BACKTEST ─────────────────
 *
 * Le banc d'essai compare un modèle RECONSTRUIT au marché, sur des milliers de
 * rencontres. C'est ce qui permet de trancher vite. Mais il ne mesure pas la
 * production : le moteur en service a ses forces ajustées à l'adversaire, son
 * calibrage par championnat, ses classements de fin de saison.
 *
 * Ce fichier-ci compare ce que le moteur a RÉELLEMENT annoncé à ce que le
 * marché annonçait le même jour, sur les mêmes matchs. C'est plus lent à
 * accumuler — il faut qu'un abonné ait demandé l'analyse — mais c'est la seule
 * mesure qui décrive le produit tel qu'il tourne.
 *
 * ── LES TROIS CONDITIONS POUR LIVRER ──────────────────────────────────────
 *
 * Fixées par le propriétaire le 24 août 2026, toutes nécessaires :
 *
 *   1. assez de rencontres pour que le chiffre veuille dire quelque chose ;
 *   2. le meilleur dosage gagne sur les DEUX moitiés de l'échantillon ;
 *   3. le marché seul est COHÉRENT — au moins aussi bon que le moteur. Tant
 *      qu'il ressort en dessous, l'échantillon est trop petit : les
 *      bookmakers ne perdent pas contre un modèle maison sur un vrai
 *      échantillon, et prétendre le contraire serait se mentir.
 *
 * La troisième condition est la plus importante, et c'est celle qu'on serait
 * tenté d'oublier. Mesuré le 24 août 2026 sur 241 rencontres : le marché seul
 * tombait à 50,2 % contre 51,5 % pour le moteur, et sa calibration partait
 * dans tous les sens. Ce n'était pas le marché qui était mauvais.
 */

/** En dessous, on n'affiche aucun verdict : le chiffre décrirait le hasard. */
const MINIMUM = 60;

/** Le seuil que le propriétaire a fixé pour livrer. */
export const RENCONTRES_POUR_LIVRER = 1000;

/** Les dosages essayés. 0 = moteur seul, 1 = marché seul. */
const DOSAGES = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1];

export interface BilanDosage {
  /** Part du marché dans le mélange, en pourcentage. */
  part: number;
  libelle: string;
  vainqueur: number;
  logloss: number;
  /** Gain contre le moteur seul, sur chaque moitié. */
  gainMoitie1: number;
  gainMoitie2: number;
  tient: boolean;
}

export interface ControleMarche {
  vide: boolean;
  rencontres: number;
  /** Rencontres analysées ET cotées ET jouées. */
  dosages: BilanDosage[];
  /** Le meilleur dosage qui tient sur les deux moitiés, s'il en existe un. */
  meilleur: BilanDosage | null;
  /** Le marché seul fait-il au moins aussi bien que le moteur ? */
  marcheCoherent: boolean;
  /** Verdict lisible, en français. */
  verdict: string;
  pretALivrer: boolean;
}

const vide = (message: string): ControleMarche => ({
  vide: true,
  rencontres: 0,
  dosages: [],
  meilleur: null,
  marcheCoherent: false,
  verdict: message,
  pretALivrer: false,
});

const borner = (v: number) => Math.min(0.999, Math.max(0.001, v));

function normaliser(p: { dom: number; nul: number; ext: number }) {
  const s = p.dom + p.nul + p.ext || 1;
  return { dom: borner(p.dom / s), nul: borner(p.nul / s), ext: borner(p.ext / s) };
}

const issuePredite = (p: { dom: number; nul: number; ext: number }) =>
  p.nul >= p.dom && p.nul >= p.ext ? 'draw' : p.dom >= p.ext ? 'team1' : 'team2';

interface Observation {
  date: string;
  /** Ce que le moteur a annoncé, dans l'ordre où l'analyse nomme les équipes. */
  moteur: { dom: number; nul: number; ext: number };
  /** Ce que le marché annonçait, redressé dans le même ordre. */
  marche: { dom: number; nul: number; ext: number };
  reel: 'team1' | 'draw' | 'team2';
}

/**
 * Le calcul, séparé de la lecture pour être vérifiable.
 *
 * `moteur` et `marche` doivent déjà être dans le MÊME ordre d'équipes. Le
 * redressement se fait à la lecture : l'analyse peut nommer les équipes dans
 * l'ordre inverse de celui du fournisseur, et mélanger deux avis exprimés à
 * l'envers l'un de l'autre donnerait n'importe quoi.
 */
export function calculerControle(observations: Observation[]): ControleMarche {
  if (observations.length < MINIMUM) {
    return vide(
      `${observations.length} rencontre${observations.length > 1 ? 's' : ''} analysée${
        observations.length > 1 ? 's' : ''
      } et cotée${observations.length > 1 ? 's' : ''} — il en faut au moins ${MINIMUM} ` +
        `pour qu'un pourcentage veuille dire quelque chose.`
    );
  }

  const tries = [...observations].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const milieu = Math.floor(tries.length / 2);

  const mesurer = (liste: Observation[], part: number) => {
    let justes = 0;
    let logloss = 0;
    for (const o of liste) {
      const p = normaliser({
        dom: Math.pow(o.moteur.dom, 1 - part) * Math.pow(o.marche.dom, part),
        nul: Math.pow(o.moteur.nul, 1 - part) * Math.pow(o.marche.nul, part),
        ext: Math.pow(o.moteur.ext, 1 - part) * Math.pow(o.marche.ext, part),
      });
      if (issuePredite(p) === o.reel) justes++;
      const cle = o.reel === 'team1' ? 'dom' : o.reel === 'draw' ? 'nul' : 'ext';
      logloss += -Math.log(p[cle]);
    }
    return {
      vainqueur: Math.round((justes / liste.length) * 1000) / 10,
      logloss: Math.round((logloss / liste.length) * 10000) / 10000,
    };
  };

  const referenceA = mesurer(tries.slice(0, milieu), 0).vainqueur;
  const referenceB = mesurer(tries.slice(milieu), 0).vainqueur;

  const dosages: BilanDosage[] = DOSAGES.map((part) => {
    const total = mesurer(tries, part);
    const a = mesurer(tries.slice(0, milieu), part).vainqueur;
    const b = mesurer(tries.slice(milieu), part).vainqueur;
    const g1 = Math.round((a - referenceA) * 10) / 10;
    const g2 = Math.round((b - referenceB) * 10) / 10;
    return {
      part: Math.round(part * 100),
      libelle:
        part === 0 ? 'Moteur seul' : part === 1 ? 'Marché seul' : `Mélange ${Math.round(part * 100)} % marché`,
      vainqueur: total.vainqueur,
      logloss: total.logloss,
      gainMoitie1: g1,
      gainMoitie2: g2,
      tient: part > 0 && part < 1 && g1 > 0 && g2 > 0,
    };
  });

  const moteurSeul = dosages[0];
  const marcheSeul = dosages[dosages.length - 1];
  const marcheCoherent = marcheSeul.vainqueur >= moteurSeul.vainqueur;

  const candidats = dosages.filter((d) => d.tient);
  const meilleur = candidats.length
    ? candidats.reduce((a, b) => (b.logloss < a.logloss ? b : a))
    : null;

  const assez = tries.length >= RENCONTRES_POUR_LIVRER;
  const pretALivrer = assez && !!meilleur && marcheCoherent;

  let verdict: string;
  if (pretALivrer) {
    verdict =
      `Concluant : le mélange à ${meilleur!.part} % de marché gagne ` +
      `${meilleur!.gainMoitie1} et ${meilleur!.gainMoitie2} points sur les deux moitiés, ` +
      `et le marché seul se tient. Il peut être livré.`;
  } else if (!marcheCoherent) {
    verdict =
      `Pas encore. Le marché seul tombe à ${marcheSeul.vainqueur} % contre ` +
      `${moteurSeul.vainqueur} % pour le moteur — les bookmakers ne perdent pas contre ` +
      `un modèle maison sur un vrai échantillon. Le nôtre est encore trop petit ` +
      `(${tries.length} rencontres).`;
  } else if (!assez) {
    verdict =
      `Sur la bonne voie : le marché se tient, mais ${tries.length} rencontres sur les ` +
      `${RENCONTRES_POUR_LIVRER} demandées. Il en manque ${RENCONTRES_POUR_LIVRER - tries.length}.`;
  } else {
    verdict = `Aucun dosage ne gagne sur les deux moitiés. Le mélange n'apporte rien pour l'instant.`;
  }

  return {
    vide: false,
    rencontres: tries.length,
    dosages,
    meilleur,
    marcheCoherent,
    verdict,
    pretALivrer,
  };
}

type LigneAnalyse = {
  fixture_id: number | null;
  win_prob: number | null;
  draw_prob: number | null;
  lose_prob: number | null;
  real_winner: string | null;
  verified_at: string;
  team1_logo: string | null;
};

/** L'identifiant du fournisseur, seule trace fiable dans l'URL du logo. */
const identifiantEquipe = (logo: string | null): string | null =>
  String(logo ?? '').match(/teams\/(\d+)\.png/)?.[1] ?? null;

export async function lireControleMarche(): Promise<ControleMarche> {
  let analyses: LigneAnalyse[] = [];
  let cotes: Map<number, CoteMatch>;

  try {
    const admin = createAdminClient();
    const tout: LigneAnalyse[] = [];
    for (let de = 0; de < 40000; de += 1000) {
      const { data, error } = await admin
        .from('analysis_history')
        .select('fixture_id, win_prob, draw_prob, lose_prob, real_winner, verified_at, team1_logo')
        .not('verified_at', 'is', null)
        .not('real_winner', 'is', null)
        .not('fixture_id', 'is', null)
        .order('verified_at', { ascending: true })
        .range(de, de + 999);
      if (error) throw error;
      if (!data?.length) break;
      tout.push(...(data as unknown as LigneAnalyse[]));
      if (data.length < 1000) break;
    }
    analyses = tout;

    const fin = new Date();
    // ── QUARANTE-CINQ JOURS, ET NON CENT VINGT ──────────────────────────
    //
    // Chaque journee est une lecture separee en reserve. Cent vingt journees
    // demandaient donc cent vingt lectures — dont la quasi-totalite ne
    // rendaient rien, le releve des cotes n ayant commence que le 17 aout
    // 2026. Mesure : 9,4 secondes pour ce seul panneau.
    //
    // Quarante-cinq jours couvrent largement les mille rencontres visees, et
    // divisent le cout par trois.
    const debut = new Date(fin.getTime() - 45 * 86400000);
    cotes = await lireCotesEntre(debut, fin);
  } catch (e: any) {
    console.error('[CONTROLE-MARCHE] Lecture impossible :', e?.message);
    return vide('Mesure indisponible : la base n’a pas répondu.');
  }

  // Une rencontre, une observation : la première analyse fait foi.
  const vues = new Set<number>();
  const observations: Observation[] = [];

  for (const a of analyses) {
    const id = Number(a.fixture_id);
    if (!Number.isFinite(id) || vues.has(id)) continue;

    const cote = cotes.get(id);
    if (!cote) continue;

    // Une cote relevée avant que les équipes soient renseignées ne permet
    // aucun redressement : la prendre quand même reviendrait à mélanger un
    // avis avec son contraire une fois sur deux. Voir `cotes-marche.ts`.
    if (!cote.dom || !cote.ext) continue;

    const t = Number(a.win_prob);
    const n = Number(a.draw_prob);
    const e = Number(a.lose_prob);
    if (!Number.isFinite(t) || !Number.isFinite(n) || !Number.isFinite(e)) continue;
    const somme = t + n + e;
    if (somme <= 0) continue;

    // ── LE REDRESSEMENT, SANS LEQUEL TOUT EST FAUX ────────────────────────
    //
    // L'analyse nomme « équipe 1 » celle que l'abonné a saisie en premier, qui
    // n'est pas toujours celle qui reçoit. Le marché, lui, cote toujours le
    // receveur en premier. Mélanger les deux sans les remettre dans le même
    // ordre reviendrait à moyenner un avis avec son contraire.
    const id1 = identifiantEquipe(a.team1_logo);
    if (!id1) continue;
    const inverse = String(cote.dom) !== String(id1);

    const moteur = inverse
      ? { dom: e / somme, nul: n / somme, ext: t / somme }
      : { dom: t / somme, nul: n / somme, ext: e / somme };

    // Le résultat est stocké du point de vue de l'analyse : on le remet lui
    // aussi du côté du receveur.
    const reelBrut = a.real_winner as 'team1' | 'draw' | 'team2';
    const reel: 'team1' | 'draw' | 'team2' = inverse
      ? reelBrut === 'team1' ? 'team2' : reelBrut === 'team2' ? 'team1' : 'draw'
      : reelBrut;

    vues.add(id);
    observations.push({
      date: cote.date,
      moteur,
      marche: { dom: cote.proba.dom, nul: cote.proba.nul, ext: cote.proba.ext },
      reel,
    });
  }

  return calculerControle(observations);
}
