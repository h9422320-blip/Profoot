/**
 * Modèles Gemini, essayés dans cet ordre.
 *
 * En formule gratuite, le quota journalier n'est pas global : il est compté
 * PAR MODÈLE (`GenerateRequestsPerDayPerProjectPerModel`). Vérifié sur la clé
 * du projet : un modèle renvoyait 429 pendant que les deux autres répondaient
 * normalement.
 *
 * Quand le premier modèle est à court, on bascule donc sur le suivant plutôt
 * que de servir un texte de secours générique. Les modèles sont classés du
 * plus capable au plus léger : la qualité ne baisse qu'une fois le quota du
 * précédent réellement épuisé.
 *
 * Cette liste reste utile une fois la facturation activée : elle sert alors
 * de filet en cas d'incident sur un modèle.
 */
export const MODELES_GEMINI = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
];

/**
 * L'échec vient-il du modèle lui-même, auquel cas un autre peut réussir ?
 *
 * Le quota n'est pas le seul cas. Sur vingt-quatre heures, trois analyses ont
 * échoué sur un « 503 — this model is currently experiencing high demand »
 * renvoyé par gemini-3.6-flash. Cette erreur ne contenait ni 429 ni le mot
 * quota : aucune bascule n'était déclenchée, et l'analyse était abandonnée
 * alors que DEUX AUTRES MODÈLES étaient disponibles et en bonne santé.
 *
 * Un modèle saturé et un modèle à court de quota sont pourtant la même
 * situation vue de l'appelant : cette instance-là ne répondra pas, une autre
 * le fera. Les erreurs de passerelle (502, 504) relèvent du même cas.
 *
 * Ce qui reste exclu : un prompt invalide, une clé refusée, un JSON malformé.
 * Ces erreurs se reproduiraient à l'identique sur les autres modèles, et les
 * réessayer ne ferait que retarder l'échec en consommant le budget de temps.
 */
export function modeleIndisponible(erreur: any): boolean {
  const message = String(erreur?.message ?? erreur ?? '');
  const code = Number(erreur?.status ?? erreur?.code ?? 0);

  // Quota épuisé.
  if (code === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || /quota/i.test(message))
    return true;

  // Modèle saturé ou passerelle en défaut : transitoire, propre à ce modèle.
  if ([500, 502, 503, 504].includes(code)) return true;
  if (/\b(502|503|504)\b/.test(message)) return true;
  if (/UNAVAILABLE|overloaded|high demand|Service Unavailable|try again later/i.test(message))
    return true;

  // ── UN JSON ILLISIBLE EST UN DÉFAUT DE CE MODÈLE ────────────────────────
  //
  // Il ne dit rien des autres : un modèle qui rend du charabia n'empêche pas
  // le suivant de répondre correctement. Mesuré sur vingt-quatre heures, 36 %
  // des échecs venaient de là — et l'analyse s'arrêtait sans jamais redemander
  // à personne.
  if (erreur?.jsonInvalide === true) return true;

  // ── UN REFUS PORTE SUR UN MODÈLE, PAS SUR LA CLÉ ────────────────────────
  //
  // 403 signifie « ce modèle-ci vous est refusé » — un réglage de routage, une
  // politique de données. Les autres modèles restent parfaitement accessibles.
  //
  // Ce code n'était pas dans la liste : un 403 sur le PREMIER modèle arrêtait
  // donc toute la cascade, alors que quatre autres attendaient. On ne l'a pas
  // vu parce que les modèles refusés étaient les derniers de la liste — le
  // jour où l'ordre change, la panne devient totale.
  //
  // 401 reste exclu, et c'est voulu : une clé invalide l'est pour tout le
  // monde, réessayer ne ferait que perdre du temps.
  if (code === 403) return true;

  return false;
}

/** Conservé sous son ancien nom : le quota reste un cas de bascule. */
export const estQuotaEpuise = modeleIndisponible;

/**
 * Exécute `action` avec chaque modèle jusqu'à ce que l'un réponde.
 *
 * CHAQUE TENTATIVE A SON PROPRE DÉLAI.
 *
 * L'appelant créait un unique `AbortController` avant la boucle. Il continuait
 * de courir d'une tentative à l'autre : si le premier modèle échouait au bout
 * de trente-cinq secondes, le second démarrait avec cinq secondes — et si le
 * premier avait expiré, le signal était déjà avorté, donc TOUTES les tentatives
 * suivantes échouaient instantanément. La bascule existait sans jamais pouvoir
 * aboutir.
 *
 * Ici, le budget total est réparti : chaque tentative reçoit ce qui reste,
 * plafonné pour qu'il en reste toujours pour la suivante. Un modèle saturé
 * répond en quelques secondes, ce qui laisse presque tout le budget au suivant.
 *
 * @param budgetMs   Temps total accordé à l'ensemble des tentatives.
 * @param plafondMs  Durée maximale d'une seule tentative.
 * @param minimumMs  En dessous, on ne tente plus : mieux vaut échouer tout de
 *                   suite que consommer le reste du budget pour rien.
 */
export async function avecBasculeDeModele<T>(
  action: (modele: string, signal: AbortSignal) => Promise<T>,
  {
    budgetMs = 40000,
    /**
     * Temps accordé à UNE tentative.
     *
     * ── POURQUOI 26 SECONDES ÉTAIT TROP COURT ─────────────────────────────
     *
     * Relevé sur les échecs du 20 et 21 août : douze analyses de suite
     * interrompues, dix d'entre elles à 48 000 ms précisément. Ce nombre n'a
     * rien d'un hasard — c'est 26 secondes pour le premier modèle, puis les
     * 22 qui restaient pour le second. Les deux étaient coupés en pleine
     * rédaction.
     *
     * L'analyse complète demande sept sections, trois scénarios et les
     * comparaisons : aucun modèle ne rédige tout cela en vingt-six secondes.
     * Résultat, l'ABONNÉ recevait le texte de secours — une phrase sèche et un
     * scénario générique — pendant qu'un visiteur gratuit, lui, lisait une
     * vraie bande-annonce. Celui qui payait recevait moins que celui qui ne
     * payait pas.
     *
     * Trente-six secondes laissent au premier modèle le temps de finir, et
     * gardent de quoi tenter un repli court. Mieux vaut une tentative qui
     * aboutit que deux qui échouent.
     */
    /**
     * ── TRENTE-SIX SECONDES DONNAIENT UNE SEULE VRAIE TENTATIVE ───────────
     *
     * Relevé le 21 août au soir : le premier modèle prenait ses trente-six
     * secondes entières sans aboutir, le second héritait des quatorze restantes
     * et tombait à son tour. Deux tentatives, dont une seule avait le temps de
     * réussir — et c'était toujours la même qui échouait.
     *
     * Vingt-deux secondes en autorisent DEUX complètes, plus une troisième sur
     * le reliquat. Un modèle « flash » rend une analyse en dix à quinze
     * secondes ; celui qui n'a pas fini en vingt-deux ne finira pas en
     * trente-six non plus — il est lent, pas en retard.
     *
     * Mieux vaut trois modèles qui ont leur chance qu'un seul qu'on attend.
     */
    plafondMs = 22000,
    minimumMs = 8000,
    modeles = MODELES_GEMINI,
    surEchec,
  }: {
    budgetMs?: number;
    plafondMs?: number;
    minimumMs?: number;
    /** Liste à parcourir. Diffère selon la passerelle employée. */
    modeles?: string[];
    /**
     * Appelé à CHAQUE modèle qui échoue, avec sa cause et sa durée.
     *
     * ── POURQUOI CE RAPPEL EXISTE ─────────────────────────────────────────
     *
     * Seule la DERNIÈRE erreur remontait à l'appelant. Sur une cascade de cinq
     * modèles, les quatre premiers échouaient donc en silence, et le journal
     * n'accusait que le cinquième.
     *
     * Conséquence mesurée le 21 août : 91 % des échecs enregistrés portaient
     * « [OpenRouter 403] google/gemini-3.5-flash » — le dernier de la liste.
     * On a cru à un problème Google, alors que ce message signifiait seulement
     * que les quatre modèles précédents avaient déjà renoncé, pour des raisons
     * qu'on ne voyait pas.
     *
     * Diagnostiquer une cascade en ne regardant que son dernier maillon, c'est
     * chercher la panne à l'endroit où elle finit, jamais où elle commence.
     */
    surEchec?: (modele: string, erreur: any, dureeMs: number, expire: boolean) => void;
  } = {}
): Promise<T> {
  const echeance = Date.now() + budgetMs;
  let derniereErreur: any;

  for (const modele of modeles) {
    const restant = echeance - Date.now();
    if (restant < minimumMs) break;

    const controleur = new AbortController();
    const delai = setTimeout(() => controleur.abort(), Math.min(restant, plafondMs));
    const debutTentative = Date.now();

    try {
      return await action(modele, controleur.signal);
    } catch (erreur: any) {
      derniereErreur = erreur;

      // Une tentative interrompue par NOTRE délai est un modèle trop lent :
      // c'est un motif de bascule, pas une erreur de fond.
      const expiree = controleur.signal.aborted;
      const duree = Date.now() - debutTentative;

      // Signalé AVANT le `throw` éventuel : une erreur de fond mérite d'être
      // tracée autant qu'une bascule, et c'est même la plus intéressante.
      try {
        surEchec?.(modele, erreur, duree, expiree);
      } catch {
        /* un rapport défaillant ne doit jamais interrompre la cascade */
      }

      if (!expiree && !modeleIndisponible(erreur)) throw erreur;

      console.warn(
        `[CASCADE] ${modele} ${expiree ? `trop lent (${duree} ms)` : `indisponible : ${String(erreur?.message ?? erreur).slice(0, 120)}`} — bascule.`
      );
    } finally {
      clearTimeout(delai);
    }
  }

  throw derniereErreur;
}
