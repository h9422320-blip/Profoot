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
const CLE = 'forces:occasions-v2';

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
  // ── LA SECONDE VAGUE, MESUREE LE 6 SEPTEMBRE 2026 ──────────────────────
  //
  // Une fois les grandes compétitions couvertes, il restait 527 analyses
  // d'abonnés dans des compétitions d'au moins quinze analyses chacune, toutes
  // encore à l'ancien calcul. Les voici, par ordre de ce qui est analysé :
  //
  //     Ligue Europa Conference ... 48 analyses
  //     Segunda División .......... 24
  //     Serie B ................... 18
  //     Ligue 2 ................... 17
  //     Czech Liga ................ 14
  //     Allsvenskan ............... 13
  //     Premiership (Écosse) ...... 13
  //     Super League (Suisse) ..... 13
  //     Super League 1 (Grèce) .... 12
  //
  // Ce sont de petits volumes pris un par un, mais l'abonné qui analyse la
  // Segunda est un abonné comme un autre : il paie le même prix et juge
  // l'application sur SES rencontres.
  { id: 848, nom: 'Ligue Europa Conference' },
  { id: 141, nom: 'Segunda División' },
  { id: 136, nom: 'Serie B' },
  { id: 62, nom: 'Ligue 2' },
  { id: 345, nom: 'Czech Liga' },
  { id: 113, nom: 'Allsvenskan' },
  { id: 179, nom: 'Premiership' },
  { id: 207, nom: 'Super League' },
  { id: 197, nom: 'Super League 1' },
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

/**
 * ── COMBIEN DE JOURS DE CALENDRIER ON RELIT ──────────────────────────────
 *
 * ── CE QUI A ÉTÉ CONSTATÉ LE 6 SEPTEMBRE 2026 ───────────────────────────
 *
 * La fenêtre valait cent cinquante jours. Résultat dans le relevé : douze
 * clubs de Bundesliga sur dix-huit, et TOUS avec exactement huit rencontres —
 * pile le minimum. Les six autres en avaient sept et retombaient à l'ancien
 * calcul, sans que rien ne le signale.
 *
 * La raison n'est pas allemande, elle est calendaire : le championnat
 * d'Allemagne finit à la mi-mai et reprend à la mi-août. Sur cent cinquante
 * jours pris début septembre, ses clubs ont simplement moins joué que les
 * anglais, qui en comptaient neuf à onze.
 *
 * ── ET SURTOUT : LA MESURE PORTAIT SUR PLUS QUE ÇA ──────────────────────
 *
 * Le banc qui a valide ce moteur — 52,20 % de justesse, 74,36 % sur les
 * rencontres mises en avant — lisait TOUT l'historique disponible, sans
 * fenêtre. La production était donc plus restrictive que ce qui avait été
 * mesuré : on servait une version amputée de celle qu'on avait éprouvée.
 *
 * ── POURQUOI L'ÉLARGIR NE COÛTE RIEN ────────────────────────────────────
 *
 * Le poids d'une rencontre est divisé par deux toutes les huit rencontres.
 * La trentième en arrière ne pèse donc que sept centièmes de la dernière :
 * elle complète le tableau sans jamais le commander. Un effectif refait
 * pendant l'été est effacé par la décroissance bien avant de fausser quoi que
 * ce soit.
 *
 * Le coût est ailleurs — plus de rencontres à relire — mais il est absorbé :
 * la construction s'arrête à une frontière de compétition et le relevé
 * fusionne avec le précédent. Deux ou trois passages suffisent à tout couvrir.
 */
const JOURS_RELUS = 240;

const TERMINE = ['FT', 'AET', 'PEN'];

type ForceClub = {
  /** Occasions créées par rencontre, déjà lissées et rétrécies. */
  attaque: number;
  /** Occasions concédées par rencontre. */
  defense: number;
  /** Sur combien de rencontres, pour savoir si l'on peut s'y fier. */
  rencontres: number;
  /**
   * La compétition où ce club a été le plus vu.
   *
   * ── POURQUOI ELLE EST INDISPENSABLE ────────────────────────────────────
   *
   * Une équipe ne se compare qu'à SON championnat. Mesuré le 6 septembre
   * 2026 sur les seuls championnats européens, les occasions par équipe et
   * par rencontre vont de 1,320 en Serie A à 1,510 en Bundesliga — quatorze
   * pour cent d'écart. Avec la MLS, le Brésil et l'Argentine, l'éventail
   * s'élargit encore.
   *
   * Rapporter tout le monde à une moyenne MONDIALE ferait passer un club
   * allemand ordinaire pour une attaque au-dessus de la moyenne ET une
   * défense au-dessus de la moyenne. Les deux erreurs se multiplient : les
   * buts attendus d'une rencontre entre deux clubs allemands ressortaient
   * surestimés de sept pour cent, et ceux d'une rencontre italienne
   * sous-estimés d'autant.
   */
  ligue: string;
};

export type ReleveOccasions = {
  clubs: Record<string, ForceClub>;
  /** Occasions moyennes par équipe et par rencontre, toutes compétitions confondues. */
  moyenne: number;
  /** Et la même chose, compétition par compétition — c'est celle-là qui sert. */
  moyennesParLigue: Record<string, number>;
  /** Ce que vaut l'avantage du terrain, mesuré et non supposé. */
  avantageDomicile: number;
  avantageExterieur: number;
  construitLe: string;
  /**
   * Par quelle compétition le PROCHAIN passage commencera.
   *
   * Sans ce rang, la tâche repartait toujours du début de la liste : les
   * premières compétitions étaient relues à chaque fois et les dernières
   * JAMAIS atteintes, puisque le budget de temps s'épuisait avant. Vingt-quatre
   * compétitions déclarées, cinq servies, dix-neuf en attente éternelle.
   *
   * Le tour d'anneau règle cela sans rien coûter : chaque passage reprend là
   * où le précédent s'est arrêté, et la fusion conserve les compétitions qu'il
   * n'a pas relues. Toutes sont donc rafraîchies à leur tour.
   */
  prochainDepart?: number;
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
    ligue: string;
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

  // ── LE TOUR D'ANNEAU ──────────────────────────────────────────────────
  //
  // On reprend où le passage précédent s'est arrêté. La liste est parcourue
  // en anneau : arrivé au bout, on revient au début. Aucune compétition ne
  // reste en attente indéfiniment, et l'ordre de la liste garde son sens —
  // les plus analysées sont simplement servies plus tôt au premier passage.
  const releveConnu = await lireForces();
  const depart = Number(releveConnu?.prochainDepart ?? 0) % CHAMPIONNATS.length;
  const ordre = [...CHAMPIONNATS.slice(depart), ...CHAMPIONNATS.slice(0, depart)];
  let arreteA = depart;

  for (const champ of ordre) {
    if (Date.now() - DEBUT > BUDGET_MS) {
      laissees.push(champ.nom);
      continue;
    }
    // Le prochain passage commencera par celle-ci si elle est la première
    // qu'on n'a pas eu le temps de finir.
    arreteA = CHAMPIONNATS.findIndex((c) => c.nom === champ.nom);
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
          ligue: champ.nom,
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
      // Terminée : le prochain passage commencera par la SUIVANTE.
      arreteA = (CHAMPIONNATS.findIndex((c) => c.nom === champ.nom) + 1) % CHAMPIONNATS.length;
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
  /** Combien de fois chaque club a été vu dans chaque compétition. */
  const ligueDuClub = new Map<string, Map<string, number>>();
  const parLigue = new Map<string, { somme: number; n: number }>();
  let sommeOccasions = 0;
  let nbOccasions = 0;
  let occDom = 0;
  let occExt = 0;

  for (const r of rencontres) {
    const od = occasionsDe(r.cadresD, r.surfaceD, taux);
    const oe = occasionsDe(r.cadresE, r.surfaceE, taux);
    suites.set(r.dom, [...(suites.get(r.dom) ?? []), { pour: od, contre: oe }]);
    suites.set(r.ext, [...(suites.get(r.ext) ?? []), { pour: oe, contre: od }]);
    for (const club of [r.dom, r.ext]) {
      const compte = ligueDuClub.get(club) ?? new Map<string, number>();
      compte.set(r.ligue, (compte.get(r.ligue) ?? 0) + 1);
      ligueDuClub.set(club, compte);
    }
    const l = parLigue.get(r.ligue) ?? { somme: 0, n: 0 };
    l.somme += od + oe;
    l.n += 2;
    parLigue.set(r.ligue, l);
    sommeOccasions += od + oe;
    nbOccasions += 2;
    occDom += od;
    occExt += oe;
  }

  const moyenne = sommeOccasions / nbOccasions;
  if (!(moyenne > 0)) return null;

  // Une compétition n'a son propre étalon que si elle est assez fournie ;
  // sinon l'étalon décrirait vingt rencontres et non un championnat.
  const moyennesParLigue: Record<string, number> = {};
  for (const [nom, l] of parLigue) {
    if (l.n >= 40) moyennesParLigue[nom] = Math.round((l.somme / l.n) * 10_000) / 10_000;
  }

  /**
   * La compétition d'un club : celle où on l'a le plus vu.
   *
   * Les coupes d'Europe brouilleraient la lecture — un club allemand n'y joue
   * qu'une poignée de rencontres. On prend donc la compétition MAJORITAIRE,
   * qui est son championnat, jamais la coupe.
   */
  const ligueMajoritaire = (club: string): string => {
    const compte = ligueDuClub.get(club);
    if (!compte) return '';
    let meilleure = '';
    let vues = 0;
    for (const [nom, k] of compte) {
      if (k > vues && moyennesParLigue[nom] !== undefined) {
        vues = k;
        meilleure = nom;
      }
    }
    return meilleure;
  };

  const nbRencontres = rencontres.length;
  const avantageDomicile = occDom / nbRencontres / moyenne;
  const avantageExterieur = occExt / nbRencontres / moyenne;

  const lisser = (
    suite: { pour: number; contre: number }[],
    cle: 'pour' | 'contre',
    etalon: number
  ) => {
    let poids = 0;
    let somme = 0;
    for (let i = 0; i < suite.length; i++) {
      const w = Math.pow(0.5, (suite.length - 1 - i) / DEMI_VIE);
      poids += w;
      somme += w * suite[i][cle];
    }
    const brut = poids > 0 ? somme / poids : etalon;
    // Le rétrécissement : une équipe peu vue tire vers la moyenne de SON
    // championnat plutôt que vers le hasard de ses premiers adversaires.
    return (brut * poids + etalon * RETRAIT) / (poids + RETRAIT);
  };

  const clubs: Record<string, ForceClub> = {};
  for (const [nom, suite] of suites) {
    if (suite.length < MINIMUM_RENCONTRES) continue;
    const ligue = ligueMajoritaire(nom);
    // Sans compétition identifiée, on ne sait pas à quoi comparer ce club :
    // mieux vaut l'écarter que le mesurer au mauvais étalon.
    if (!ligue) continue;
    const etalon = moyennesParLigue[ligue];
    clubs[nom] = {
      attaque: Math.round(lisser(suite, 'pour', etalon) * 10_000) / 10_000,
      defense: Math.round(lisser(suite, 'contre', etalon) * 10_000) / 10_000,
      rencontres: suite.length,
      ligue,
    };
  }

  const releve: ReleveOccasions = {
    clubs,
    prochainDepart: arreteA,
    moyenne: Math.round(moyenne * 10_000) / 10_000,
    moyennesParLigue,
    avantageDomicile: Math.round(avantageDomicile * 10_000) / 10_000,
    avantageExterieur: Math.round(avantageExterieur * 10_000) / 10_000,
    construitLe: new Date().toISOString(),
  };

  /**
   * ── UN RELEVÉ NE REMPLACE JAMAIS UN PLUS RICHE ────────────────────────
   *
   * ── CE QUI S'EST PASSÉ LE 6 SEPTEMBRE 2026 À 3 H 12 ───────────────────
   *
   * Le premier passage avait lu huit compétitions et rangé 143 clubs. Le
   * deuxième, lancé quatre minutes plus tard, n'en a lu que cinq — la lecture
   * de la réserve est parfois plus lente — et il a ÉCRASÉ le relevé complet
   * par le sien : 100 clubs. Quarante-trois clubs venaient de disparaître, et
   * leurs analyses de repasser à l'ancien calcul, sans qu'aucune erreur ne le
   * signale.
   *
   * Le budget de temps, qui protège la tâche de l'hébergeur, produisait donc
   * un relevé qui pouvait REGRESSER d'un passage à l'autre.
   *
   * ── POURQUOI ON PEUT FUSIONNER SANS RIEN FAUSSER ──────────────────────
   *
   * Chaque club est jaugé à l'étalon de SON championnat, et les championnats
   * ne se parlent pas. Les clubs allemands d'un ancien passage restent donc
   * exacts même si ce passage-ci n'a pas relu la Bundesliga : rien dans leur
   * calcul ne dépend de ce qu'on a lu ailleurs.
   *
   * On garde donc, compétition par compétition, la lecture la plus récente —
   * et pour celles que ce passage n'a pas atteintes, celle d'avant. Le relevé
   * ne peut plus que s'enrichir.
   */
  const ancien = releveConnu;
  let fusionne = releve;

  if (ancien?.clubs) {
    const clubsFusionnes: Record<string, ForceClub> = { ...releve.clubs };
    const moyennesFusionnees: Record<string, number> = { ...moyennesParLigue };
    let repris = 0;

    for (const [nom, force] of Object.entries(ancien.clubs)) {
      // Une compétition relue à l'instant fait autorité : on ne remet pas
      // l'ancienne version de ses clubs par-dessus la neuve.
      if (moyennesParLigue[force.ligue] !== undefined) continue;
      if (ancien.moyennesParLigue?.[force.ligue] === undefined) continue;
      if (!clubsFusionnes[nom]) {
        clubsFusionnes[nom] = force;
        moyennesFusionnees[force.ligue] = ancien.moyennesParLigue[force.ligue];
        repris++;
      }
    }

    if (repris > 0) {
      console.log(
        `[OCCASIONS] ${repris} club(s) repris du relevé précédent, pour les compétitions que ce passage n'a pas atteintes.`
      );
      fusionne = { ...releve, clubs: clubsFusionnes, moyennesParLigue: moyennesFusionnees };
    }
  }

  await ecrireReserve(CLE, fusionne, TTL);
  return fusionne;
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

  /**
   * ── L'ÉTALON EST CELUI DE LA RENCONTRE, PAS CELUI DU MONDE ─────────────
   *
   * Chaque force a été calculée par rapport à la moyenne de SON championnat.
   * Il faut donc la ramener au niveau de la rencontre qui se joue.
   *
   * Deux clubs du même championnat : c'est le sien. Une coupe d'Europe entre
   * un Allemand et un Italien : la moyenne des deux, parce qu'aucun des deux
   * étalons n'a plus de titre que l'autre à décrire la rencontre.
   */
  const md = releve.moyennesParLigue?.[d.ligue];
  const me = releve.moyennesParLigue?.[e.ligue];
  const m = md && me ? (md + me) / 2 : md ?? me ?? releve.moyenne;
  if (!(m > 0)) return null;

  // Attaque de l'un contre défense de l'autre, rapportées à l'étalon de la
  // rencontre, puis l'avantage du terrain tel qu'il a été MESURÉ.
  const domicile = m * (d.attaque / m) * (e.defense / m) * releve.avantageDomicile;
  const exterieur = m * (e.attaque / m) * (d.defense / m) * releve.avantageExterieur;

  if (!Number.isFinite(domicile) || !Number.isFinite(exterieur)) return null;
  if (domicile <= 0 || exterieur <= 0) return null;

  return { domicile, exterieur };
}
