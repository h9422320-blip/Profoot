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
const CLE = 'forces:occasions-v5';

/**
 * ── LA VERSION PRÉCÉDENTE RESTE UN FILET ──────────────────────────────────
 *
 * ── CE QUI SE PASSAIT SANS ELLE ──────────────────────────────────────────
 *
 * Changer la façon de calculer les forces oblige à changer la clé du relevé —
 * une force ajustée et une force moyennée ne se mélangent pas. Mais le nouveau
 * relevé se construit une compétition par passage : plusieurs heures pour tout
 * couvrir.
 *
 * Pendant ces heures, un club présent dans l'ANCIEN relevé et pas encore dans
 * le nouveau perdait toute lecture par les occasions et retombait au calcul
 * d'avant. Un recul, même provisoire, sur des rencontres que des abonnés
 * payants analysent pendant ce temps-là.
 *
 * ── CE QUI SE PASSE MAINTENANT ───────────────────────────────────────────
 *
 * Le club est cherché dans le relevé neuf ; s'il n'y est pas encore, dans le
 * précédent. Une force moyennée vaut moins qu'une force ajustée, mais
 * infiniment mieux que pas de force du tout — c'était déjà elle qui tournait
 * hier, et elle a été mesurée.
 *
 * Le moteur ne peut donc plus reculer pendant une bascule de version : au
 * pire il n'avance pas encore.
 *
 * Cette clé se décale d'un cran à chaque nouvelle version : v3 lit v2, une
 * future v4 lira v3.
 */
const CLE_PRECEDENTE = 'forces:occasions-v4';

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
  { id: 2, nom: 'Ligue des champions', europeenne: true },
  { id: 3, nom: 'Ligue Europa', europeenne: true },
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
  { id: 848, nom: 'Ligue Europa Conference', europeenne: true },
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
 * ── UNE COUPE D'EUROPE N'EST LE CHAMPIONNAT DE PERSONNE ──────────────────
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 6 SEPTEMBRE 2026 ─────────────────────────────
 *
 * Le Bayern München était rangé dans « Ligue des champions », avec HUIT
 * rencontres. Le Paris Saint Germain aussi, avec onze. Lyon et Fribourg dans
 * « Ligue Europa ». Douze clubs en tout — et ce sont les plus analysés de
 * l'application.
 *
 * Conséquences, toutes silencieuses :
 *
 *   — leur force était rapportée à l'étalon de la coupe d'Europe et non à
 *     celui de leur championnat, deux niveaux de jeu très différents ;
 *   — elle ne reposait que sur leurs huit à onze matchs européens au lieu de
 *     leurs vingt et un matchs domestiques ;
 *   — et le Bayern manquait purement et simplement à la Bundesliga, qui
 *     n'affichait que seize clubs sur dix-huit.
 *
 * ── LA CAUSE ────────────────────────────────────────────────────────────
 *
 * La compétition d'un club est celle où on l'a le plus vu. Or la construction
 * avance une compétition par passage : lors du passage qui lisait la Ligue des
 * champions, le Bayern n'y était vu QUE là. Sa compétition majoritaire, pour
 * ce passage, devenait donc la coupe d'Europe.
 *
 * ── LA RÈGLE POSÉE ──────────────────────────────────────────────────────
 *
 * Une coupe d'Europe n'est le championnat de personne. Tous ses participants
 * en ont un, ailleurs. Elle ne peut donc jamais servir d'étalon à un club, et
 * un club vu seulement là au cours d'un passage n'est pas rangé du tout — la
 * fusion conserve alors ce que son passage domestique avait établi.
 */

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
 * Porté de 3 à 4 le 6 septembre 2026, après remesure — le réglage datait de
 * l ancienne méthode, quand la force était une simple moyenne. Cinq valeurs
 * essayées, contrôle coupé en deux :
 *
 *     lest   justesse    P1      P2     mis en avant
 *      3      52,72 %   52,72   52,72     70,96 %   (272 rencontres)
 *      4      52,72 %   52,72   52,72     71,98 %   (257 rencontres)
 *
 * La justesse ne bouge d aucun centième, dans aucune des deux périodes, et
 * les rencontres mises en avant gagnent un point sur un ensemble de taille
 * comparable. Le Brier recule de six dix-millièmes : c est le prix, et il est
 * payé sur une mesure de calibrage, pas sur le nombre de fois où le moteur a
 * raison.
 *
 * Au-delà de 4, le gain continue (73,59 % à 6) mais la justesse commence à
 * se dégrader en première période. On s arrête là.
 *
 * MINIMUM : en dessous, on ne se prononce pas du tout sur ce club.
 */
/**
 * Les compétitions qui ne sont le championnat de personne.
 *
 * Utilisé à trois endroits — le choix de la compétition d'un club, la fusion
 * avec le relevé précédent, et le filet de version. Les trois doivent appliquer
 * la même règle, sinon une porte fermée d'un côté se rouvre de l'autre : c'est
 * exactement ce qui s'est passé le 6 septembre 2026, où six clubs mal rangés
 * revenaient par la fusion après avoir été écartés à la construction.
 */
export const EUROPEENNES = new Set<string>(
  CHAMPIONNATS.filter((c) => (c as { europeenne?: boolean }).europeenne).map((c) => c.nom)
);

const DEMI_VIE = 8;
const RETRAIT = 4;
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
  /**
   * ── TRENTE-CINQ SECONDES, ET PAS DEUX CENT TRENTE ─────────────────────
   *
   * ── CE QUI A ÉTÉ COMPRIS LE 6 SEPTEMBRE 2026 AU MATIN ────────────────
   *
   * Le budget valait deux cent trente secondes, et la route déclarait
   * « maxDuration = 300 ». Or l'hébergeur coupe les fonctions de ce projet à
   * SOIXANTE SECONDES — la même limite qui contraint déjà l'Agent VIP.
   *
   * La construction était donc tuée en pleine lecture, toujours avant
   * d'atteindre l'écriture finale. Autrement dit : la tâche planifiée n'a
   * JAMAIS rien écrit. Le relevé servi en production n'existait que parce
   * qu'il avait été bâti à la main depuis un poste, sans limite de temps.
   *
   * Rien ne l'aurait signalé : ni erreur, ni trace. Le relevé aurait
   * simplement vieilli — et la lecture accepte un relevé périmé, à dessein —
   * donc l'application aurait servi des forces de plus en plus vieilles sans
   * que personne ne s'en aperçoive.
   *
   * Trente-cinq secondes laissent la place à la lecture d'une compétition ET
   * à l'écriture du relevé, sous la coupure. Une compétition par passage,
   * c'est peu — mais le tour d'anneau et la fusion font que chaque passage
   * AJOUTE, et les passages sont nombreux (voir `rafraichirSiNecessaire`).
   */
  const BUDGET_MS = 35_000;
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
        if (Date.now() - DEBUT > BUDGET_MS + 8_000) {
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
    } else {
      laissees.push(champ.nom);
    }

    /**
     * ── ON AVANCE TOUJOURS, MÊME QUAND ON N'A PAS FINI ────────────────────
     *
     * ── CE QUI A BLOQUÉ LE MOTEUR LE 6 SEPTEMBRE 2026 ───────────────────
     *
     * Le rang de reprise n'avançait que sur une compétition TERMINÉE. La Liga
     * Profesional Argentina compte 368 rencontres jouées : elle ne tient pas
     * dans le budget de temps d'un passage. Chaque passage la reprenait donc
     * depuis le début, échouait, et laissait le rang sur elle.
     *
     * Résultat vu en production : « 0 compétition(s) lues », les vingt-quatre
     * remises au passage suivant, et « matière insuffisante ». Le relevé était
     * GELÉ — plus aucune mise à jour des forces, indéfiniment, sans qu'aucune
     * erreur ne soit levée.
     *
     * ── LA RÈGLE ────────────────────────────────────────────────────────
     *
     * Le rang avance dans tous les cas. Une compétition trop grosse pour un
     * passage est simplement retentée au tour suivant — et elle finit par
     * passer : chaque tentative met en réserve les rencontres qu'elle a eu le
     * temps de lire, si bien que la fois d'après elle démarre déjà chaude.
     *
     * Une compétition ne peut plus prendre l'anneau en otage.
     */
    arreteA = (CHAMPIONNATS.findIndex((c) => c.nom === champ.nom) + 1) % CHAMPIONNATS.length;
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
  const suites = new Map<
    string,
    { pour: number; contre: number; adv: string; chezSoi: boolean }[]
  >();
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
    suites.set(r.dom, [
      ...(suites.get(r.dom) ?? []),
      { pour: od, contre: oe, adv: r.ext, chezSoi: true },
    ]);
    suites.set(r.ext, [
      ...(suites.get(r.ext) ?? []),
      { pour: oe, contre: od, adv: r.dom, chezSoi: false },
    ]);
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
      // Une coupe d'Europe ne peut jamais devenir le championnat d'un club :
      // voir la note en tête de fichier.
      if (EUROPEENNES.has(nom)) continue;
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

  /**
   * ── LES FORCES S'ESTIMENT ENSEMBLE, PLUS CHACUNE DANS SON COIN ─────────
   *
   * ── CE QUE FAISAIT LA VERSION PRÉCÉDENTE ─────────────────────────────
   *
   * Une moyenne pondérée des occasions créées, divisée par la moyenne du
   * championnat. Simple, et grossier : elle ignore QUI l'équipe a affronté.
   * Une moyenne réalisée contre les trois meilleures défenses du championnat
   * y valait exactement autant que la même moyenne contre les trois pires.
   *
   * Elle ignorait aussi que les équipes se contraignent MUTUELLEMENT : la
   * force de l'une se déduit en partie de celle des autres, et une moyenne
   * prise équipe par équipe ne peut pas le voir.
   *
   * ── CE QUI SE FAIT MAINTENANT ────────────────────────────────────────
   *
   * L'ajustement de Poisson classique : à chaque tour, l'attaque d'une équipe
   * est le rapport entre ce qu'elle a RÉELLEMENT produit et ce qu'elle AURAIT
   * DÛ produire compte tenu des défenses rencontrées et du terrain. Idem pour
   * la défense. On recommence, chaque force tenant compte des forces révisées
   * de tous les adversaires, jusqu'à stabilité.
   *
   * C'est la méthode standard du domaine, résolue par point fixe — le même
   * résultat qu'un maximum de vraisemblance sur ce modèle, sans matrice à
   * inverser.
   *
   * ── CE QUE ÇA A DONNÉ, MESURÉ LE 6 SEPTEMBRE 2026 ────────────────────
   *
   * Sur 1 544 rencontres hors échantillon, contrôle coupé en deux :
   *
   *                        justesse    P1      P2     mises en avant
   *     moyenne             52,20 %   52,20   52,20      69,81 %
   *     ajustement          52,53 %   52,33   52,72      70,86 %
   *
   * La justesse monte DANS LES DEUX moitiés du contrôle, et sur les
   * rencontres mises en avant — celles que l'abonné ouvre en premier.
   *
   * Cinq tours suffisent : au-delà les forces ne bougent plus.
   */
  const TOURS = 5;

  const forces = new Map<string, { att: number; def: number }>();
  for (const [nom, suite] of suites) {
    if (suite.length >= MINIMUM_RENCONTRES) forces.set(nom, { att: 1, def: 1 });
  }

  for (let tour = 0; tour < TOURS; tour++) {
    const neuf = new Map<string, { att: number; def: number }>();
    for (const [nom, suite] of suites) {
      if (!forces.has(nom)) continue;
      const etalon = moyennesParLigue[ligueMajoritaire(nom)] ?? moyenne;

      let produitA = 0, attenduA = 0, produitD = 0, attenduD = 0;
      for (let i = 0; i < suite.length; i++) {
        const m = suite[i];
        const w = Math.pow(0.5, (suite.length - 1 - i) / DEMI_VIE);
        const adv = forces.get(m.adv);
        const terrain = m.chezSoi ? avantageDomicile : avantageExterieur;
        const terrainAdv = m.chezSoi ? avantageExterieur : avantageDomicile;
        produitA += w * m.pour;
        attenduA += w * etalon * (adv ? adv.def : 1) * terrain;
        produitD += w * m.contre;
        attenduD += w * etalon * (adv ? adv.att : 1) * terrainAdv;
      }

      // Le rétrécissement vers 1 : une équipe peu vue reste proche de la
      // moyenne de son championnat plutôt que du hasard de ses adversaires.
      const lest = etalon * RETRAIT;
      neuf.set(nom, {
        att: attenduA > 0 ? (produitA + lest) / (attenduA + lest) : 1,
        def: attenduD > 0 ? (produitD + lest) / (attenduD + lest) : 1,
      });
    }

    // On recentre. Sans cela, toutes les forces dérivent ensemble vers le haut
    // ou vers le bas d'un tour à l'autre, et l'échelle se perd.
    const moyA = [...neuf.values()].reduce((t, x) => t + x.att, 0) / Math.max(1, neuf.size);
    const moyD = [...neuf.values()].reduce((t, x) => t + x.def, 0) / Math.max(1, neuf.size);
    for (const [k, v] of neuf) {
      forces.set(k, { att: v.att / (moyA || 1), def: v.def / (moyD || 1) });
    }
  }

  const clubs: Record<string, ForceClub> = {};
  for (const [nom, suite] of suites) {
    if (suite.length < MINIMUM_RENCONTRES) continue;
    const ligue = ligueMajoritaire(nom);
    // Sans compétition identifiée, on ne sait pas à quoi comparer ce club :
    // mieux vaut l'écarter que le mesurer au mauvais étalon.
    if (!ligue) continue;
    const f = forces.get(nom);
    if (!f) continue;
    const etalon = moyennesParLigue[ligue];
    // Les forces sont des RAPPORTS ; le relevé, lui, garde des occasions par
    // rencontre, pour que la lecture ne change pas d'unité.
    clubs[nom] = {
      attaque: Math.round(f.att * etalon * 10_000) / 10_000,
      defense: Math.round(f.def * etalon * 10_000) / 10_000,
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
      // ── LA PORTE FERMEE A LA CONSTRUCTION RESTE FERMEE ICI ─────────────
      //
      // Six clubs -- Qarabag, Fenerbahçe, Dinamo Zagreb, Bodo/Glimt, Rijeka,
      // Ferencvaros -- revenaient rangés dans une coupe d'Europe alors que la
      // construction venait de les écarter. Ils étaient repris tels quels du
      // relevé précédent, avec l'étalon de la coupe : 0,93 pour la Ligue Europa
      // là où un championnat vaut 1,4. Leur force en sortait fausse de moitié.
      if (EUROPEENNES.has(force.ligue)) continue;
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

/** Le verrou : deux visiteurs simultanés ne construisent pas deux fois. */
const CLE_VERROU = 'forces:occasions-verrou';

/** Au-delà, on considère que la construction précédente est morte. */
const VERROU_MS = 3 * 60 * 1000;

/** En dessous de cet âge, le relevé est jugé assez frais pour ne rien faire. */
const FRAICHEUR_MS = 90 * 60 * 1000;

/**
 * ── LE RELEVÉ SE TIENT À JOUR PAR LE PASSAGE DES VISITEURS ───────────────
 *
 * ── POURQUOI PAS SIMPLEMENT UNE TÂCHE PLANIFIÉE ─────────────────────────
 *
 * Parce qu'elles ne partent pas. Le fait est déjà consigné ailleurs dans ce
 * dépôt : trois tâches de courriels déclarées le 1er septembre 2026 n'avaient
 * toujours rien envoyé le lendemain soir, et l'envoi a dû être raccroché au
 * passage des visiteurs. La même chose vaut ici.
 *
 * S'y ajoute la coupure à soixante secondes : même partie, une tâche n'a le
 * temps de lire qu'une seule compétition.
 *
 * ── COMMENT ÇA TIENT ────────────────────────────────────────────────────
 *
 * Chaque passage ne fait qu'un petit pas — une compétition, trente-cinq
 * secondes — mais le tour d'anneau reprend là où le précédent s'est arrêté et
 * la fusion conserve tout le reste. Le relevé ne recule jamais : il avance par
 * petits bouts, et vingt-quatre pas suffisent à faire le tour complet.
 *
 * Le verrou empêche deux visiteurs simultanés de bâtir en double. La fraîcheur
 * d'une heure et demie empêche de reconstruire à chaque visite : la
 * construction part une quinzaine de fois par jour, ce qui fait tourner
 * l'anneau à peu près une fois par jour et demi.
 *
 * NE LÈVE JAMAIS : appelée depuis `after()`, une exception y serait perdue, et
 * une page ne doit pas échouer parce qu'un relevé n'a pas pu se mettre à jour.
 */
export async function rafraichirSiNecessaire(): Promise<{ lance: boolean; raison: string }> {
  try {
    const actuel = await lireReserve<ReleveOccasions>(CLE).catch(() => null);
    const construitLe = actuel?.contenu?.construitLe
      ? new Date(actuel.contenu.construitLe).getTime()
      : 0;
    const age = Date.now() - construitLe;
    if (construitLe && age < FRAICHEUR_MS) {
      return { lance: false, raison: `frais, bâti il y a ${Math.round(age / 60000)} min` };
    }

    const verrou = await lireReserve<string>(CLE_VERROU).catch(() => null);
    if (verrou?.contenu && !verrou.expiree) {
      return { lance: false, raison: 'une construction est déjà en cours' };
    }
    await ecrireReserve(CLE_VERROU, new Date().toISOString(), VERROU_MS);

    const releve = await construireForces();
    // Le verrou tombe aussitôt : le passage suivant peut enchaîner sur la
    // compétition d'après sans attendre trois minutes.
    await ecrireReserve(CLE_VERROU, '', 1).catch(() => {});

    return releve
      ? { lance: true, raison: `${Object.keys(releve.clubs).length} club(s)` }
      : { lance: true, raison: 'matière insuffisante' };
  } catch (e: any) {
    console.warn(`[OCCASIONS] Rafraîchissement impossible : ${e?.message}`);
    return { lance: false, raison: 'erreur' };
  }
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
    const neuf = cache?.contenu?.clubs ? cache.contenu : null;

    // Le relevé neuf couvre-t-il déjà tout ? Alors rien d'autre à faire.
    // Sinon on complète avec le précédent, pour les clubs qu'il n'a pas encore
    // atteints — jamais pour ceux qu'il a, sa lecture faisant autorité.
    const ancien = await lireReserve<ReleveOccasions>(CLE_PRECEDENTE).catch(() => null);
    const clubsAnciens = ancien?.contenu?.clubs;
    if (!clubsAnciens) return neuf;

    if (!neuf) {
      // Le neuf n'existe pas encore du tout : on sert l'ancien tel quel plutôt
      // que de priver tout le monde.
      return ancien!.contenu;
    }

    const clubs = { ...neuf.clubs };
    const moyennes = { ...(neuf.moyennesParLigue ?? {}) };
    let repris = 0;
    for (const [nom, force] of Object.entries(clubsAnciens)) {
      if (clubs[nom]) continue;
      // Même règle que la fusion : un club rangé dans une coupe d'Europe ne
      // revient pas par le filet. Sans lecture, le moteur applique son propre
      // calcul — ce qui vaut mieux qu'une force mesurée au mauvais étalon.
      if (EUROPEENNES.has(force.ligue)) continue;
      const etalon = ancien!.contenu.moyennesParLigue?.[force.ligue];
      if (etalon === undefined) continue;
      clubs[nom] = force;
      if (moyennes[force.ligue] === undefined) moyennes[force.ligue] = etalon;
      repris++;
    }
    if (!repris) return neuf;

    return { ...neuf, clubs, moyennesParLigue: moyennes };
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
