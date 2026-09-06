/**
 * LA FORME DES ÉQUIPES MESURÉE EN OCCASIONS, ET NON EN BUTS.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────
 *
 * Le moteur estime la force d'une équipe sur ses BUTS marqués et encaissés.
 * Or un but est un événement rare — deux ou trois par rencontre — et très
 * bruité : une frappe déviée, un penalty discutable, et la « force » d'une
 * équipe change pour dix matchs.
 *
 * Ce qui décrit vraiment une équipe, c'est la QUALITÉ DES OCCASIONS qu'elle
 * crée et qu'elle concède. Elles sont dix fois plus nombreuses que les buts,
 * donc dix fois moins bruitées.
 *
 * ── LA MESURE QUI L'A DÉCIDÉ, LE 6 SEPTEMBRE 2026 ────────────────────────
 *
 * 3 632 rencontres des cinq grands championnats, saisons 2024 à 2026. Question
 * posée seule, sans aucune mécanique autour : ce qu'une équipe a produit sur
 * ses dix dernières rencontres prédit-il mieux ses buts à venir ? Erreur
 * absolue moyenne, sur 3 483 observations JAMAIS VUES pendant l'apprentissage :
 *
 *     buts marqués ............................ 0,9570
 *     tirs cadrés ............................. 0,9393
 *     moitié cadrés, moitié tirs en surface ... 0,9366   (+2,12 %)
 *
 * Ce gain de 2 % à l'entrée devient huit points à la sortie sur les rencontres
 * que l'application met en avant, parce qu'il ne se contente pas de déplacer
 * les pronostics : il fait mieux SÉPARER les matchs lisibles des autres.
 *
 * ── CE QUE LE MÉLANGE DONNE, SUR 1 544 RENCONTRES COMMUNES ───────────────
 *
 *                            moteur seul     avec les occasions
 *     toutes rencontres        51,04 %            52,07 %
 *     confiance ≥ 55 %         62,32 %            72,69 %
 *     confiance ≥ 60 %         67,39 %            75,51 %
 *     Brier                     0,6051             0,5984
 *
 * Douze réglages essayés, DOUZE qui améliorent à la fois la justesse et le
 * Brier DANS LES DEUX MOITIÉS de la période de contrôle — l'épreuve qui avait
 * écarté huit pistes précédentes (voir `profoot-plafond-prediction`).
 *
 * ── LA CONTREPARTIE, ASSUMÉE ─────────────────────────────────────────────
 *
 * Le mélange est plus SÉLECTIF : il n'annonce une forte confiance que lorsque
 * les deux façons de lire la rencontre s'accordent. À seuil 60 %, il retient
 * 196 rencontres là où le moteur seul en retenait 322. Moins de « matchs les
 * mieux cernés » chaque jour, mais nettement plus sûrs — ce qui est
 * exactement l'échange que demandent les deux règles absolues du propriétaire.
 *
 * ── CE QUI SE PASSE QUAND LA DONNÉE MANQUE ───────────────────────────────
 *
 * Rien. `butsAttendusOccasions` rend `null` dès qu'un des deux clubs est
 * inconnu ou trop peu vu, et le moteur rend alors exactement ce qu'il rendait
 * avant. Aucun championnat non couvert ne perd quoi que ce soit.
 */

import { apiFootball, CACHE_TTL, lireReserve, ecrireReserve } from './api-football';

/** La réserve où vit le relevé. Le suffixe change à chaque évolution de forme. */
const CLE = 'forces:occasions-v1';

/** Six heures : le relevé bouge à chaque journée de championnat, pas plus. */
const TTL = 6 * 60 * 60 * 1000;

/**
 * Les compétitions couvertes, DANS L'ORDRE DE CE QUE LES ABONNÉS ANALYSENT.
 *
 * ── CE QUE LE RELEVÉ DU 6 SEPTEMBRE 2026 A MONTRÉ ────────────────────────
 *
 * Sur les 3 467 analyses déjà confrontées à leur résultat, réparties en
 * soixante-sept compétitions :
 *
 *     Major League Soccer .......... 464 analyses
 *     Premier League ............... 392
 *     La Liga ...................... 355
 *     Serie A ...................... 355
 *     Jupiler Pro League ........... 287
 *     Bundesliga ................... 282
 *     Eredivisie ................... 278
 *     Ligue 1 ...................... 278
 *     Primeira Liga ................ 277
 *
 * La compétition LA PLUS ANALYSÉE n'était pas un des cinq grands championnats :
 * c'était la MLS. Et la Jupiler, l'Eredivisie et la Primeira Liga pèsent
 * chacune autant qu'une Bundesliga. En s'en tenant aux cinq grands, on laissait
 * la moitié des analyses de nos abonnés à l'ancien calcul.
 *
 * Contrôlé le même jour sur quinze compétitions : le fournisseur donne les
 * statistiques de tirs pour TOUTES, quatre rencontres sur quatre. Rien
 * n'obligeait à se limiter.
 *
 * ── POURQUOI L'ORDRE COMPTE ──────────────────────────────────────────────
 *
 * La construction s'arrête proprement quand le temps manque (voir
 * `construireForces`), à une frontière de compétition. Celles du haut sont
 * donc servies en premier, et ce sont celles qui pèsent le plus.
 */
export const CHAMPIONNATS = [
  { id: 253, nom: 'Major League Soccer' },
  { id: 39, nom: 'Premier League' },
  { id: 140, nom: 'La Liga' },
  { id: 135, nom: 'Serie A' },
  { id: 144, nom: 'Jupiler Pro League' },
  { id: 78, nom: 'Bundesliga' },
  { id: 88, nom: 'Eredivisie' },
  { id: 61, nom: 'Ligue 1' },
  { id: 94, nom: 'Primeira Liga' },
  { id: 71, nom: 'Serie A brésilienne' },
  { id: 40, nom: 'Championship' },
  { id: 203, nom: 'Süper Lig' },
  { id: 128, nom: 'Liga Profesional Argentina' },
  { id: 2, nom: 'Ligue des champions' },
  { id: 3, nom: 'Ligue Europa' },
] as const;

/**
 * ── LES RÉGLAGES, ET LA MESURE QUI LES A CHOISIS ─────────────────────────
 *
 * DEMI_VIE : au bout de combien de rencontres le poids d'un match est divisé
 * par deux. Douze combinaisons essayées ; 8 donne le résultat le plus STABLE
 * entre les deux moitiés du contrôle (52,3 % puis 52,3 %), et c'est la
 * stabilité qu'on retient, pas le chiffre le plus haut.
 *
 * RETRAIT : de combien de rencontres fictives à la moyenne du championnat on
 * leste une équipe. Sans lui, un club vu six fois affiche des forces extrêmes
 * qui ne décrivent que le hasard de ses adversaires.
 *
 * MINIMUM : en dessous, on ne se prononce pas du tout sur ce club.
 */
const DEMI_VIE = 8;
const RETRAIT = 3;
const MINIMUM_RENCONTRES = 8;

/** Combien de jours de calendrier on relit pour bâtir la forme. */
const JOURS_RELUS = 150;

const TERMINE = ['FT', 'AET', 'PEN'];

type ForceClub = {
  /** Occasions créées par rencontre, déjà lissées et rétrécies. */
  attaque: number;
  /** Occasions concédées par rencontre. */
  defense: number;
  /** Sur combien de rencontres, pour savoir si l'on peut s'y fier. */
  rencontres: number;
};

export type ReleveOccasions = {
  clubs: Record<string, ForceClub>;
  /** Occasions moyennes par équipe et par rencontre, toutes équipes confondues. */
  moyenne: number;
  /** Ce que vaut l'avantage du terrain, mesuré et non supposé. */
  avantageDomicile: number;
  avantageExterieur: number;
  construitLe: string;
};

/** Un tir cadré vaut ce nombre de buts. Mesuré, puis recalculé à chaque relevé. */
type Taux = { cadre: number; surface: number };

const nombre = (stats: any[] | undefined, type: string): number => {
  const s = (stats ?? []).find((x) => x?.type === type);
  const v = s?.value;
  if (v === null || v === undefined) return 0;
  return typeof v === 'string' ? Number(String(v).replace('%', '')) || 0 : Number(v) || 0;
};

/**
 * La valeur en buts des occasions d'une équipe sur une rencontre.
 *
 * Moitié tirs cadrés, moitié tirs dans la surface : c'est ce mélange qui a
 * donné la plus petite erreur des cinq mesures essayées. Les deux disent la
 * même chose de deux façons — l'un compte ce qui a inquiété le gardien,
 * l'autre ce qui s'est construit dans la zone dangereuse — et leur moyenne
 * est plus stable que chacun pris seul.
 */
const occasionsDe = (cadres: number, surface: number, taux: Taux): number =>
  0.5 * (taux.cadre * cadres + taux.surface * surface);

/**
 * Construit le relevé et le range dans la réserve.
 *
 * Appelé par la tâche planifiée, jamais par une analyse : bâtir ceci demande
 * quelques centaines d'appels au fournisseur, ce qu'un abonné qui attend son
 * analyse ne doit jamais payer.
 */
export async function construireForces(): Promise<ReleveOccasions | null> {
  const depuis = Date.now() - JOURS_RELUS * 86_400_000;
  const saisonsAVoir = [new Date().getUTCFullYear() - 1, new Date().getUTCFullYear()];

  type Rencontre = {
    date: number;
    dom: string;
    ext: string;
    cadresD: number;
    surfaceD: number;
    cadresE: number;
    surfaceE: number;
    butsD: number;
    butsE: number;
  };
  const rencontres: Rencontre[] = [];

  /**
   * ── LE BUDGET DE TEMPS, ET POURQUOI ON S'ARRÊTE À UNE FRONTIÈRE ────────
   *
   * L'hébergeur coupe la tâche à cinq minutes. Quinze compétitions demandent,
   * la toute première fois, plusieurs milliers d'appels — bien au-delà.
   *
   * On s'arrête donc proprement, et TOUJOURS entre deux compétitions, jamais
   * au milieu de l'une d'elles : une compétition à moitié lue donnerait des
   * forces FAUSSES, pas incomplètes. Une équipe dont on aurait lu six matchs
   * sur douze aurait l'air de valoir ce que valent ces six-là.
   *
   * Les passages suivants coûtent une poignée d'appels : les statistiques
   * d'une rencontre terminée ne changent plus jamais et restent un an en
   * réserve. La couverture se remplit donc d'elle-même en deux ou trois jours,
   * en commençant par les compétitions les plus analysées.
   */
  const DEBUT = Date.now();
  const BUDGET_MS = 230_000;
  const couvertes: string[] = [];
  const laissees: string[] = [];

  for (const champ of CHAMPIONNATS) {
    if (Date.now() - DEBUT > BUDGET_MS) {
      laissees.push(champ.nom);
      continue;
    }
    // Ce que cette compétition apporte n'entre dans le relevé QUE si elle a
    // été lue en entier.
    const apport: Rencontre[] = [];
    let complete = true;

    for (const saison of saisonsAVoir) {
      const liste = await apiFootball<any>(
        `/fixtures?league=${champ.id}&season=${saison}`,
        CACHE_TTL.TEAM_INFO
      );
      const jouees = (liste?.response ?? []).filter(
        (f: any) =>
          TERMINE.includes(f?.fixture?.status?.short) &&
          new Date(f?.fixture?.date ?? 0).getTime() >= depuis
      );

      for (const f of jouees) {
        if (Date.now() - DEBUT > BUDGET_MS + 40_000) {
          // Dépassement franc : on abandonne CETTE compétition entière.
          complete = false;
          break;
        }
        // Les statistiques d'une rencontre TERMINÉE ne changent plus jamais :
        // on les garde très longtemps, et le relevé suivant ne les redemande
        // pas. C'est ce qui fait tomber le coût à quelques dizaines d'appels
        // une fois la réserve chaude.
        const st = await apiFootball<any>(
          `/fixtures/statistics?fixture=${f.fixture.id}`,
          365 * 86_400_000
        );
        const rep = st?.response ?? [];
        if (rep.length < 2) continue;

        const bloc = (nom: string) => rep.find((x: any) => x?.team?.name === nom);
        const d = bloc(f.teams?.home?.name);
        const e = bloc(f.teams?.away?.name);
        if (!d || !e) continue;

        apport.push({
          date: new Date(f.fixture.date).getTime(),
          dom: f.teams.home.name,
          ext: f.teams.away.name,
          cadresD: nombre(d.statistics, 'Shots on Goal'),
          surfaceD: nombre(d.statistics, 'Shots insidebox'),
          cadresE: nombre(e.statistics, 'Shots on Goal'),
          surfaceE: nombre(e.statistics, 'Shots insidebox'),
          butsD: Number(f.goals?.home ?? 0),
          butsE: Number(f.goals?.away ?? 0),
        });
      }
      if (!complete) break;
    }

    if (complete) {
      rencontres.push(...apport);
      couvertes.push(champ.nom);
    } else {
      laissees.push(champ.nom);
    }
  }

  console.log(
    `[OCCASIONS] ${couvertes.length} compétition(s) lues : ${couvertes.join(', ')}.` +
      (laissees.length ? ` Remises au prochain passage : ${laissees.join(', ')}.` : '')
  );

  if (rencontres.length < 100) return null;

  // ── CE QUE VAUT UN TIR, RECALCULÉ À CHAQUE RELEVÉ ──────────────────────
  //
  // Figer 0,325 et 0,170 serait figer le football de septembre 2026. Les taux
  // se déduisent de la matière du moment : total des buts divisé par total des
  // tirs. Deux divisions, et le relevé reste juste quand le jeu change.
  let buts = 0;
  let cadres = 0;
  let surface = 0;
  for (const r of rencontres) {
    buts += r.butsD + r.butsE;
    cadres += r.cadresD + r.cadresE;
    surface += r.surfaceD + r.surfaceE;
  }
  if (!cadres || !surface) return null;
  const taux: Taux = { cadre: buts / cadres, surface: buts / surface };

  rencontres.sort((a, b) => a.date - b.date);

  // ── LES FORCES, À POIDS DÉCROISSANTS ──────────────────────────────────
  const suites = new Map<string, { pour: number; contre: number }[]>();
  let sommeOccasions = 0;
  let nbOccasions = 0;
  let occDom = 0;
  let occExt = 0;

  for (const r of rencontres) {
    const od = occasionsDe(r.cadresD, r.surfaceD, taux);
    const oe = occasionsDe(r.cadresE, r.surfaceE, taux);
    suites.set(r.dom, [...(suites.get(r.dom) ?? []), { pour: od, contre: oe }]);
    suites.set(r.ext, [...(suites.get(r.ext) ?? []), { pour: oe, contre: od }]);
    sommeOccasions += od + oe;
    nbOccasions += 2;
    occDom += od;
    occExt += oe;
  }

  const moyenne = sommeOccasions / nbOccasions;
  if (!(moyenne > 0)) return null;

  const nbRencontres = rencontres.length;
  const avantageDomicile = occDom / nbRencontres / moyenne;
  const avantageExterieur = occExt / nbRencontres / moyenne;

  const lisser = (suite: { pour: number; contre: number }[], cle: 'pour' | 'contre') => {
    let poids = 0;
    let somme = 0;
    for (let i = 0; i < suite.length; i++) {
      const w = Math.pow(0.5, (suite.length - 1 - i) / DEMI_VIE);
      poids += w;
      somme += w * suite[i][cle];
    }
    const brut = poids > 0 ? somme / poids : moyenne;
    // Le rétrécissement : une équipe peu vue tire vers la moyenne du
    // championnat plutôt que vers le hasard de ses premiers adversaires.
    return (brut * poids + moyenne * RETRAIT) / (poids + RETRAIT);
  };

  const clubs: Record<string, ForceClub> = {};
  for (const [nom, suite] of suites) {
    if (suite.length < MINIMUM_RENCONTRES) continue;
    clubs[nom] = {
      attaque: Math.round(lisser(suite, 'pour') * 10_000) / 10_000,
      defense: Math.round(lisser(suite, 'contre') * 10_000) / 10_000,
      rencontres: suite.length,
    };
  }

  const releve: ReleveOccasions = {
    clubs,
    moyenne: Math.round(moyenne * 10_000) / 10_000,
    avantageDomicile: Math.round(avantageDomicile * 10_000) / 10_000,
    avantageExterieur: Math.round(avantageExterieur * 10_000) / 10_000,
    construitLe: new Date().toISOString(),
  };

  await ecrireReserve(CLE, releve, TTL);
  return releve;
}

/**
 * Le relevé, depuis la réserve.
 *
 * On accepte un relevé PÉRIMÉ plutôt que rien : la forme d'une équipe ne se
 * retourne pas en six heures, et servir le moteur d'hier vaut mieux que de le
 * priver de sa moitié.
 */
export async function lireForces(): Promise<ReleveOccasions | null> {
  try {
    const cache = await lireReserve<ReleveOccasions>(CLE);
    return cache?.contenu?.clubs ? cache.contenu : null;
  } catch {
    return null;
  }
}

/**
 * Les buts attendus de la rencontre, vus par les occasions seules.
 *
 * Rend `null` dès qu'un des deux clubs manque : le moteur garde alors son
 * propre calcul, au centième près.
 */
export function butsAttendusOccasions(
  releve: ReleveOccasions | null,
  nomDomicile: string | null | undefined,
  nomExterieur: string | null | undefined
): { domicile: number; exterieur: number } | null {
  if (!releve?.clubs) return null;
  const d = nomDomicile ? releve.clubs[nomDomicile] : undefined;
  const e = nomExterieur ? releve.clubs[nomExterieur] : undefined;
  if (!d || !e) return null;

  const m = releve.moyenne;
  if (!(m > 0)) return null;

  // Attaque de l'un contre défense de l'autre, rapportées à la moyenne du
  // championnat, puis l'avantage du terrain tel qu'il a été MESURÉ.
  const domicile = m * (d.attaque / m) * (e.defense / m) * releve.avantageDomicile;
  const exterieur = m * (e.attaque / m) * (d.defense / m) * releve.avantageExterieur;

  if (!Number.isFinite(domicile) || !Number.isFinite(exterieur)) return null;
  if (domicile <= 0 || exterieur <= 0) return null;

  return { domicile, exterieur };
}
