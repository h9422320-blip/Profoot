import { apiFootball, CACHE_TTL, LEAGUE_IDS, lireReserve, ecrireReserve } from './api-football';

/**
 * LE RELEVÉ QUOTIDIEN DES COTES DU MARCHÉ.
 *
 * ── POURQUOI CE FICHIER EXISTE, ET POURQUOI MAINTENANT ────────────────────
 *
 * Les cotes des bookmakers sont le meilleur prédicteur public du football :
 * elles agrègent l'argent de milliers de parieurs et l'analyse de maisons qui
 * en vivent. Les comparer à nos pronostics dirait, sans discussion possible,
 * où le moteur est en avance et où il se trompe.
 *
 * Le 24 août 2026, elles ont dû être ÉCARTÉES de la mise au point du moteur,
 * pour une raison simple : le fournisseur ne les garde pas. Vérifié ce
 * jour-là — les cotes du 23 août rendaient dix matchs, celles du 16 août plus
 * rien. Impossible de valider quoi que ce soit sur l'historique, donc
 * impossible de livrer sans mentir sur ce qu'on a mesuré.
 *
 * D'où ce relevé. Il ne sert à RIEN aujourd'hui : il constitue la matière qui
 * manquera dans trois semaines. Chaque jour qui passe sans relever est un jour
 * de mesure perdu pour toujours.
 *
 * ── CE QUI EST GARDÉ, ET CE QUI EST JETÉ ──────────────────────────────────
 *
 * Treize bookmakers cotent chaque match, avec des écarts minimes. On garde la
 * MÉDIANE : elle résiste à un opérateur qui décale sa ligne pour équilibrer
 * ses paris, là où la moyenne se laisserait tirer.
 *
 * Et on garde la probabilité, pas seulement la cote. Une cote de 2,00 ne veut
 * pas dire « 50 % » : la somme des probabilités implicites d'un match dépasse
 * toujours 100 %, et l'excédent est la marge du bookmaker. On la retire, sinon
 * toute comparaison avec nos propres probabilités serait faussée du même
 * excédent.
 *
 * ── POURQUOI AUCUNE NOUVELLE TABLE ────────────────────────────────────────
 *
 * Une table demanderait une manipulation dans Supabase. Le relevé tient dans
 * la réserve, une ligne par journée : quelques centaines de rencontres par
 * jour, et une lecture par intervalle de dates quand viendra le moment de
 * mesurer.
 */

/** Le fournisseur rend dix rencontres par page. */
const PAR_PAGE = 10;

/**
 * Combien de pages lire par championnat.
 *
 * ── POURQUOI PAR CHAMPIONNAT, ET NON PAR DATE ─────────────────────────────
 *
 * Le premier relevé interrogeait le fournisseur date par date. Il rend alors
 * dix rencontres par page, prises dans le monde entier : sur quatre journées
 * et quatre-vingts appels, soixante-sept rencontres seulement concernaient nos
 * championnats — le reste partait à la poubelle après avoir coûté un appel.
 * Cent vingt et une secondes pour presque rien.
 *
 * Interrogé championnat par championnat, le fournisseur rend deux à trois
 * pages, et TOUT ce qu'il rend nous intéresse. Le même quota rapporte quinze
 * fois plus de matière.
 */
const PAGES_PAR_LIGUE = 6;

/** Combien de championnats interroger de front. Au-delà, le fournisseur ralentit. */
const DE_FRONT = 12;

/**
 * Temps maximal accordé au relevé, en millisecondes.
 *
 * ── POURQUOI UN BUDGET, ET NON UNE PROMESSE DE TOUT FAIRE ─────────────────
 *
 * La tâche quotidienne dispose de trois cents secondes pour TOUT : vérifier
 * les pronostics, refaire la hiérarchie des championnats, reconstruire le mur
 * de preuves, rattraper les ventes perdues. Mesuré le 24 août 2026, un relevé
 * complet des soixante-trois championnats demandait deux cent dix secondes à
 * lui seul — de quoi faire tomber tout le reste.
 *
 * Le relevé s'arrête donc quand son budget est épuisé, et reprend le
 * lendemain là où il se trouve. Ce n'est pas une perte : les cotes d'un match
 * restent lisibles plusieurs jours avant le coup d'envoi, et le relevé est
 * quotidien. Un championnat manqué aujourd'hui est relevé demain.
 */
const BUDGET_MS = 90_000;

/**
 * Combien de temps garder un relevé.
 *
 * Quatre mois : de quoi couvrir une demi-saison, donc plusieurs centaines de
 * rencontres analysées par nos abonnés — le volume nécessaire pour trancher.
 */
const CONSERVATION = 120 * 24 * 60 * 60 * 1000;

const cleDuJour = (jour: string) => `cotes:${jour}`;

export interface CoteMatch {
  /** Identifiant de la rencontre chez le fournisseur — la clé de rapprochement. */
  id: number;
  /** Date et heure du coup d'envoi. */
  date: string;
  ligue: number;
  dom: number;
  ext: number;
  /** Cotes médianes des bookmakers, telles qu'affichées. */
  cote: { dom: number; nul: number; ext: number };
  /** Probabilités implicites, marge du bookmaker retirée. Somme = 1. */
  proba: { dom: number; nul: number; ext: number };
  /** Combien de bookmakers ont servi à la médiane. */
  maisons: number;
  /** Marge retirée, en pourcentage. Élevée = cotes peu fiables. */
  marge: number;
}

export interface ReleveDuJour {
  jour: string;
  releveLe: string;
  matchs: CoteMatch[];
}

/** La médiane résiste à l'opérateur qui décale sa ligne ; la moyenne non. */
function mediane(valeurs: number[]): number {
  if (!valeurs.length) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

/**
 * D'un jeu de cotes vers des probabilités qui somment à 1.
 *
 * L'inverse d'une cote est une probabilité implicite. Leur somme dépasse
 * toujours 100 % — de 5 à 8 % en général — et cet excédent est la marge du
 * bookmaker. Sans la retirer, comparer ses probabilités aux nôtres reviendrait
 * à lui prêter une assurance qu'il n'a pas.
 */
export function probabilitesDepuisCotes(cote: { dom: number; nul: number; ext: number }): {
  proba: { dom: number; nul: number; ext: number };
  marge: number;
} {
  const brut = { dom: 1 / cote.dom, nul: 1 / cote.nul, ext: 1 / cote.ext };
  const somme = brut.dom + brut.nul + brut.ext;
  if (!Number.isFinite(somme) || somme <= 0) {
    return { proba: { dom: 1 / 3, nul: 1 / 3, ext: 1 / 3 }, marge: 0 };
  }
  return {
    proba: {
      dom: brut.dom / somme,
      nul: brut.nul / somme,
      ext: brut.ext / somme,
    },
    marge: Math.round((somme - 1) * 1000) / 10,
  };
}

/** Les compétitions qui nous intéressent : celles que nos abonnés analysent. */
const NOS_LIGUES = new Set<number>([...Object.values(LEAGUE_IDS), 2, 3, 848, 531]);

/**
 * Extrait ce qui compte d'une réponse du fournisseur.
 *
 * Isolé pour être vérifiable sans réseau : les épreuves lui donnent une
 * réponse fabriquée et contrôlent la médiane et le retrait de la marge.
 */
export function extraireCotes(reponse: any[]): CoteMatch[] {
  const matchs: CoteMatch[] = [];

  for (const x of reponse ?? []) {
    const ligue = Number(x?.league?.id);
    if (!Number.isFinite(ligue) || !NOS_LIGUES.has(ligue)) continue;

    const dom: number[] = [];
    const nul: number[] = [];
    const ext: number[] = [];

    for (const maison of x?.bookmakers ?? []) {
      const pari = (maison?.bets ?? []).find((b: any) => b?.name === 'Match Winner');
      if (!pari) continue;
      const valeur = (nom: string) => {
        const v = (pari.values ?? []).find((y: any) => String(y?.value) === nom);
        const n = Number(v?.odd);
        return Number.isFinite(n) && n > 1 ? n : null;
      };
      const d = valeur('Home');
      const n = valeur('Draw');
      const e = valeur('Away');
      // Les trois ou rien : deux cotes sur trois ne permettent pas de retirer
      // la marge, donc ne permettent aucune comparaison honnête.
      if (d === null || n === null || e === null) continue;
      dom.push(d); nul.push(n); ext.push(e);
    }

    if (!dom.length) continue;

    const cote = {
      dom: Math.round(mediane(dom) * 100) / 100,
      nul: Math.round(mediane(nul) * 100) / 100,
      ext: Math.round(mediane(ext) * 100) / 100,
    };
    const { proba, marge } = probabilitesDepuisCotes(cote);

    matchs.push({
      id: Number(x.fixture.id),
      date: String(x.fixture.date),
      ligue,
      // ── LES ÉQUIPES NE SONT PAS DANS LA RÉPONSE DES COTES ────────────
      //
      // `/odds` rend `league`, `fixture`, `update` et `bookmakers`. Pas
      // `teams`. Les lire ici donnait zéro pour les 661 rencontres du premier
      // relevé — et comme le rapprochement compare cet identifiant à celui de
      // l'équipe analysée, TOUS les matchs étaient déclarés inversés : la
      // probabilité de victoire à domicile allait à l'équipe qui se déplace.
      // Le marché ressortait alors à 25 % de réussite, sous le hasard pur.
      //
      // Ils sont remplis juste après, depuis la fiche du match.
      dom: 0,
      ext: 0,
      cote,
      proba: {
        dom: Math.round(proba.dom * 10000) / 10000,
        nul: Math.round(proba.nul * 10000) / 10000,
        ext: Math.round(proba.ext * 10000) / 10000,
      },
      maisons: dom.length,
      marge,
    });
  }

  return matchs;
}

/** La saison en cours, au sens du fournisseur. */
function saisonCourante(maintenant = new Date()): number {
  const an = maintenant.getUTCFullYear();
  return maintenant.getUTCMonth() >= 6 ? an : an - 1;
}

/** Toutes les cotes à venir d'un championnat, page après page. */
async function coterUnChampionnat(ligue: number, saison: number): Promise<CoteMatch[]> {
  const trouves: CoteMatch[] = [];

  for (let page = 1; page <= PAGES_PAR_LIGUE; page++) {
    let reponse: any = null;
    try {
      reponse = await apiFootball<any>(
        `/odds?league=${ligue}&season=${saison}&page=${page}`,
        // Les cotes bougent : une réserve longue servirait des valeurs
        // périmées et fausserait le relevé du lendemain.
        CACHE_TTL.FIXTURES_TODAY
      );
    } catch (e: any) {
      console.warn(`[COTES] Ligue ${ligue} page ${page} illisible : ${e?.message}`);
      break;
    }

    trouves.push(...extraireCotes(reponse?.response ?? []));

    const total = Number(reponse?.paging?.total);
    if (!reponse?.response?.length) break;
    if (Number.isFinite(total) && page >= total) break;
    if (reponse.response.length < PAR_PAGE) break;
  }

  return trouves;
}

/**
 * Le relevé complet, championnat par championnat.
 *
 * ── CE QU'IL FAIT, ET POURQUOI IL RANGE PAR JOURNÉE ───────────────────────
 *
 * Il demande à chaque championnat toutes ses rencontres cotées à venir, puis
 * les range dans la journée de leur coup d'envoi. Une rencontre du 30 août
 * relevée le 24 va donc dans la case du 30 : quand viendra le moment de
 * mesurer, on cherchera par date de match, pas par date de relevé.
 *
 * Un relevé existant est COMPLÉTÉ, jamais écrasé. Les cotes d'un match
 * n'apparaissent parfois que la veille, et un relevé fait une semaine à
 * l'avance ne doit pas effacer celui d'hier — ni l'inverse.
 *
 * Un échec sur un championnat n'arrête pas les autres : une case vide vaut
 * mieux qu'un relevé interrompu.
 */
export async function releverCotes(
  maintenant = new Date()
): Promise<{ jours: number; matchs: number; ligues: number; detail: { jour: string; matchs: number }[] }> {
  const saison = saisonCourante(maintenant);
  const ligues = [...NOS_LIGUES];

  // ── LES CHAMPIONNATS SONT INTERROGÉS PAR PAQUETS ────────────────────────
  //
  // Un par un, cinquante-sept championnats à trois pages chacun demandaient
  // deux minutes — sur les cinq que la plateforme accorde à toute la tâche
  // quotidienne. Huit de front ramènent cela à une vingtaine de secondes sans
  // brusquer le fournisseur.
  const debut = Date.now();
  const tous: CoteMatch[] = [];
  let interroges = 0;

  for (let i = 0; i < ligues.length; i += DE_FRONT) {
    if (Date.now() - debut > BUDGET_MS) {
      console.warn(
        `[COTES] Budget épuisé après ${interroges} championnats sur ${ligues.length} : ` +
          'le reste sera relevé demain.'
      );
      break;
    }
    const paquet = ligues.slice(i, i + DE_FRONT);
    const resultats = await Promise.all(paquet.map((l) => coterUnChampionnat(l, saison)));
    for (const r of resultats) tous.push(...r);
    interroges += paquet.length;
  }

  // ── ON VA CHERCHER LES ÉQUIPES DANS LA FICHE DU MATCH ───────────────────
  //
  // Sans elles, impossible de savoir qui reçoit — donc impossible de rapprocher
  // la cote d'une analyse, dont l'abonné a pu nommer les équipes dans l'autre
  // sens. Le fournisseur accepte vingt identifiants par appel : six cents
  // rencontres coûtent trente appels.
  const parId = new Map<number, CoteMatch>();
  for (const m of tous) parId.set(m.id, m);

  const identifiants = [...parId.keys()];
  const paquets: number[][] = [];
  for (let i = 0; i < identifiants.length; i += 20) paquets.push(identifiants.slice(i, i + 20));

  for (let i = 0; i < paquets.length; i += DE_FRONT) {
    // Le budget couvre AUSSI cette étape. Sans cela, le relevé du 24 août 2026
    // a duré trois cent trente et une secondes — au-delà des trois cents que
    // la plateforme accorde à toute la tâche quotidienne, qui serait tombée.
    if (Date.now() - debut > BUDGET_MS * 1.5) {
      console.warn('[COTES] Budget épuisé pendant la lecture des fiches : le reste attendra demain.');
      break;
    }
    const lot = paquets.slice(i, i + DE_FRONT);
    const reponses = await Promise.all(
      lot.map((p) =>
        apiFootball<any>(`/fixtures?ids=${p.join('-')}`, CACHE_TTL.FIXTURES_UPCOMING).catch((e: any) => {
          console.warn(`[COTES] Fiches de match illisibles : ${e?.message}`);
          return null;
        })
      )
    );
    for (const r of reponses) {
      for (const f of r?.response ?? []) {
        const m = parId.get(Number(f?.fixture?.id));
        if (!m) continue;
        m.dom = Number(f?.teams?.home?.id ?? 0);
        m.ext = Number(f?.teams?.away?.id ?? 0);
      }
    }
  }

  // Une cote sans équipes ne sert à rien : elle ne peut être rapprochée
  // d'aucune analyse. Mieux vaut ne pas l'enregistrer que la voir compter plus
  // tard comme une mesure.
  const complets = [...parId.values()].filter((m) => m.dom > 0 && m.ext > 0);
  const perdus = parId.size - complets.length;
  if (perdus) console.warn(`[COTES] ${perdus} rencontres écartées : équipes introuvables.`);

  // ── RANGEMENT PAR JOURNÉE DE MATCH ──────────────────────────────────────
  const parJour = new Map<string, CoteMatch[]>();
  for (const m of complets) {
    const jour = String(m.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) continue;
    const l = parJour.get(jour);
    if (l) l.push(m); else parJour.set(jour, [m]);
  }

  const detail: { jour: string; matchs: number }[] = [];
  let total = 0;

  for (const [jour, matchs] of [...parJour].sort((a, b) => a[0].localeCompare(b[0]))) {
    const fusion = new Map<number, CoteMatch>();

    try {
      const ancien = await lireReserve<ReleveDuJour>(cleDuJour(jour));
      for (const m of ancien?.contenu?.matchs ?? []) fusion.set(m.id, m);
    } catch {
      // Rien en réserve : on part de zéro, ce n'est pas une anomalie.
    }

    for (const m of matchs) fusion.set(m.id, m);

    const releve: ReleveDuJour = {
      jour,
      releveLe: new Date().toISOString(),
      matchs: [...fusion.values()],
    };

    try {
      await ecrireReserve(cleDuJour(jour), releve, CONSERVATION);
      detail.push({ jour, matchs: releve.matchs.length });
      total += releve.matchs.length;
    } catch (e: any) {
      console.warn(`[COTES] Écriture impossible pour ${jour} : ${e?.message}`);
    }
  }

  return { jours: detail.length, matchs: total, ligues: interroges, detail };
}

/** Relit les cotes d'une rencontre, si elles ont été relevées avant le match. */
export async function lireCotesDuJour(jour: string): Promise<ReleveDuJour | null> {
  try {
    const r = await lireReserve<ReleveDuJour>(cleDuJour(jour));
    return r?.contenu ?? null;
  } catch (e: any) {
    // Un échec de lecture n'est PAS la même chose qu'une journée sans cotes.
    // Le confondre avec un silence a coûté une demi-heure le 24 août 2026 :
    // trente et une lectures simultanées échouaient toutes, et la fonction
    // rendait « rien trouvé » avec la même sérénité qu'une journée vide.
    console.warn(`[COTES] Lecture de ${jour} impossible : ${e?.message}`);
    return null;
  }
}

/**
 * Toutes les cotes relevées entre deux dates, par identifiant de rencontre.
 *
 * C'est la lecture qui servira dans trois semaines : pour chaque analyse
 * vérifiée, on retrouvera ce que le marché annonçait avant le coup d'envoi.
 */
export async function lireCotesEntre(debut: Date, fin: Date): Promise<Map<number, CoteMatch>> {
  const par: Map<number, CoteMatch> = new Map();
  const jours: string[] = [];

  for (let t = debut.getTime(); t <= fin.getTime(); t += 86400000) {
    jours.push(new Date(t).toISOString().slice(0, 10));
  }

  // ── PAR PETITS PAQUETS, ET NON TOUTES D'UN COUP ─────────────────────────
  //
  // Trente et une lectures lancées ensemble comme tout premier accès à la
  // base échouaient TOUTES, et le silence de `lireCotesDuJour` les faisait
  // passer pour trente et une journées vides. Le même appel, précédé d'une
  // seule lecture isolée, rendait trois cent cinquante-cinq rencontres.
  //
  // Six à la fois suffisent à aller vite sans ouvrir trente connexions
  // simultanées sur un client qui vient de démarrer.
  const DE_FRONT_LECTURE = 6;
  for (let i = 0; i < jours.length; i += DE_FRONT_LECTURE) {
    const paquet = jours.slice(i, i + DE_FRONT_LECTURE);
    const releves = await Promise.all(paquet.map((j) => lireCotesDuJour(j)));
    for (const r of releves) {
      for (const m of r?.matchs ?? []) par.set(m.id, m);
    }
  }

  return par;
}
