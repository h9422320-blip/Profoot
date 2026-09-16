/**
 * QUAND LE SITE CHANGE SOUS LES PIEDS DE QUELQU'UN.
 *
 * ── LA CAUSE, TROUVÉE LE 16 SEPTEMBRE 2026 ────────────────────────────────
 *
 * Trois jours de suite, le propriétaire a vu « Cette page n'a pas pu
 * s'afficher » au bout d'une analyse — et ses ventes ont baissé ces jours-là.
 * Le 15 au soir, après une première réparation, elles sont remontées. Le 16 au
 * matin, le plantage est revenu : ce matin-là, plusieurs mises en ligne s'étaient
 * succédé.
 *
 * Chaque mise en ligne RENOMME les morceaux de code qui ont changé : ils sont
 * nommés d'après leur contenu (`_next/static/immutable/chunks/0666khkr2mnoq.js`),
 * et l'ancien nom cesse d'exister. Quelqu'un qui a ouvert la page AVANT la mise
 * en ligne garde en mémoire la liste des anciens noms. Tant qu'il n'a pas
 * besoin d'un morceau qu'il n'a pas encore chargé, rien ne se voit.
 *
 * Mais une analyse dure une minute et demie, et c'est à sa FIN que la page
 * réclame des morceaux nouveaux : la sélection et les matchs du jour, retirés
 * pendant le calcul et remis ensuite ; la notice de paiement ; les sections du
 * résultat. Le serveur répond que le fichier n'existe plus, et le moteur de
 * rendu lève, mot pour mot :
 *
 *     ChunkLoadError — Failed to load chunk … from module …
 *
 * La réparation du 15 septembre ne reconnaissait qu'UNE autre forme de la même
 * panne (`An unexpected response was received from the server`, E394). Celle-ci
 * passait à travers et tombait sur l'écran d'erreur ordinaire. C'est exactement
 * la capture envoyée le 16 au matin.
 *
 * ── CE QUI EST FAIT ───────────────────────────────────────────────────────
 *
 * Toutes les formes connues de cette panne sont reconnues ici, à UN SEUL
 * endroit, et entraînent UN rechargement : la page repart sur la nouvelle
 * version, et l'analyse en cours est relancée d'elle-même (voir
 * `reprendreAnalyse`, appelée par la page d'analyse).
 *
 * Un seul rechargement par demi-minute : si le serveur était réellement en
 * panne, recharger en boucle ferait clignoter la page à l'infini.
 */

/** Les formes connues de « la version a changé pendant que la page était ouverte ». */
const MESSAGES_DE_VERSION = [
  // Le moteur de rendu ne sait plus lire la réponse du serveur (Next, E394).
  /unexpected response was received from the server/i,
  // Un morceau de code a disparu : forme de ce cadre (Turbopack).
  /failed to load chunk/i,
  // Les mêmes, sous d'autres noms selon le navigateur et l'outil de construction.
  /loading chunk [\w-]+ failed/i,
  /loading css chunk/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

/**
 * La panne de VERSION, et elle seule.
 *
 * ── LE DÉFAUT QUI A FAIT DURER LE BUG TROIS JOURS ─────────────────────────
 *
 * `RecuperationChargement`, écrit le 3 septembre 2026 exactement pour cette
 * panne, lisait `message ?? name` — donc le message DÈS QU'IL EXISTE, et jamais
 * le nom. Et sa liste de signes était celle de Webpack : « Loading chunk 123
 * failed ». Le projet se construit aujourd'hui avec Turbopack, qui lève :
 *
 *     name    ChunkLoadError
 *     message Failed to load chunk /_next/static/immutable/chunks/… from module …
 *
 * Aucun signe ne correspondait au message, et le nom — le seul qui aurait
 * correspondu — n'était jamais lu. Le rattrapage ne s'est donc JAMAIS déclenché.
 * Démontré le 16 septembre 2026 en rejouant l'erreur exacte sur l'ancien code.
 *
 * On lit donc ici le nom ET le message, séparément, et les formulations des deux
 * outils de construction.
 */
export function estErreurDeVersion(erreur: unknown): boolean {
  const e = erreur as { message?: unknown; name?: unknown; __NEXT_ERROR_CODE?: unknown } | null;
  if (!e) return false;
  if (String(e.__NEXT_ERROR_CODE ?? '') === 'E394') return true;
  if (String(e.name ?? '') === 'ChunkLoadError') return true;
  const message = typeof erreur === 'string' ? erreur : String(e.message ?? '');
  return MESSAGES_DE_VERSION.some((motif) => motif.test(message));
}

/**
 * Les coupures RÉSEAU, qu'un rechargement répare aussi.
 *
 * Reprises de `global-error.tsx`, où elles avaient été ajoutées le
 * 10 septembre 2026 : sur un téléphone en 3G, ce n'est pas toujours le morceau
 * qui manque, c'est la requête qui n'aboutit pas. Chrome dit « Failed to fetch »,
 * Safari « Load failed », Firefox « NetworkError ».
 */
const MESSAGES_DE_COUPURE = [
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /network error/i,
  /connection (closed|terminated)/i,
];

/**
 * Tout ce qu'un rechargement répare : la version ET les coupures réseau.
 *
 * ── À N'EMPLOYER QUE LÀ OÙ LA PAGE EST DÉJÀ TOMBÉE ────────────────────────
 *
 * Dans une barrière d'erreur, la page a déjà échoué : recharger ne peut que
 * l'aider, quelle qu'en soit la cause. Mais dans l'écoute de la FENÊTRE, où
 * passent aussi les échecs d'appels secondaires, reconnaître « Failed to fetch »
 * rechargerait la page en pleine analyse dès qu'un simple compteur de visites
 * n'aboutit pas. Là-bas, seule `estErreurDeVersion` doit servir.
 */
export function estErreurReparableParRechargement(erreur: unknown): boolean {
  if (estErreurDeVersion(erreur)) return true;
  const e = erreur as { message?: unknown } | null;
  const message = typeof erreur === 'string' ? erreur : String(e?.message ?? '');
  return MESSAGES_DE_COUPURE.some((motif) => motif.test(message));
}

/** Un fichier de code ou de style du site qui n'a pas pu être chargé. */
export function estFichierDuSite(url: unknown): boolean {
  return /\/_next\/static\//.test(String(url ?? ''));
}

const CLE_RECHARGEMENT = 'profoot_rechargement_version';
export const ENTRE_DEUX_RECHARGEMENTS_MS = 30_000;

/**
 * Recharge la page, une fois par demi-minute au plus.
 *
 * Rend `true` si le rechargement est parti, `false` s'il a été retenu — et
 * dans ce cas l'appelant montre l'écran normal, qui laisse la main.
 */
export function rechargerUneFois(): boolean {
  try {
    const dernier = Number(sessionStorage.getItem(CLE_RECHARGEMENT) ?? 0);
    if (Number.isFinite(dernier) && Date.now() - dernier < ENTRE_DEUX_RECHARGEMENTS_MS) return false;
    sessionStorage.setItem(CLE_RECHARGEMENT, String(Date.now()));
    // CE rechargement-là, et lui seul, autorise la reprise de l'analyse. Un
    // rechargement ordinaire de l'abonné ne doit JAMAIS relancer un calcul :
    // il consommerait une analyse de son quota sans qu'il l'ait demandé.
    sessionStorage.setItem(CLE_REPRISE_AUTORISEE, String(Date.now()));
  } catch {
    // Stockage refusé (navigation privée) : on recharge quand même une fois.
    // Le pire cas est un second rechargement, jamais une boucle — la panne de
    // version disparaît dès que la nouvelle version est chargée.
  }
  try {
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

// ── L'ANALYSE EN COURS SURVIT AU RECHARGEMENT ───────────────────────────────
//
// Recharger répare la page, mais fait perdre l'analyse que l'abonné attendait
// depuis une minute et demie. Quelqu'un qui découvre l'application et retombe
// sur un formulaire vide s'en va presque aussi sûrement que devant une erreur.
//
// Les deux clubs de l'analyse lancée sont donc notés dans l'onglet ; après un
// rechargement, la page d'analyse les relit et relance le calcul — que le
// serveur a gardé en réserve, et qui revient alors en quelques secondes.
//
// Les clubs sont notés ENTIERS, et pas seulement leur identifiant : un club
// trouvé par la recherche hors des championnats préchargés s'afficherait sinon
// « Inconnu », comme le FC Bâle le jour de Bâle–Barcelone.

const CLE_REPRISE = 'profoot_analyse_a_reprendre';
/** Posée par `rechargerUneFois`, et par personne d'autre. */
const CLE_REPRISE_AUTORISEE = 'profoot_reprise_autorisee';
/** Au-delà, ce n'est plus l'analyse qu'on attendait : on ne la relance pas. */
const REPRISE_VALABLE_MS = 10 * 60 * 1000;
/** Le rechargement de version doit être tout récent pour autoriser la reprise. */
const AUTORISATION_VALABLE_MS = 60 * 1000;

export interface ClubAReprendre {
  id: string;
  [cle: string]: unknown;
}

export function noterAnalyseEnCours(club1: ClubAReprendre, club2: ClubAReprendre): void {
  try {
    sessionStorage.setItem(CLE_REPRISE, JSON.stringify({ club1, club2, quand: Date.now() }));
  } catch {
    // Sans stockage, l'abonné relancera à la main : rien ne casse.
  }
}

export function oublierAnalyseEnCours(): void {
  try {
    sessionStorage.removeItem(CLE_REPRISE);
  } catch {
    /* rien */
  }
}

/**
 * Lit l'analyse à reprendre, et l'efface : une reprise n'a lieu qu'une fois.
 *
 * DEUX conditions, et il faut les deux : une analyse notée il y a moins de dix
 * minutes, ET un rechargement de version survenu il y a moins d'une minute.
 * Sans la seconde, un simple rechargement de page relancerait un calcul.
 */
export function reprendreAnalyse(): { club1: ClubAReprendre; club2: ClubAReprendre } | null {
  try {
    const brut = sessionStorage.getItem(CLE_REPRISE);
    const autorisation = Number(sessionStorage.getItem(CLE_REPRISE_AUTORISEE) ?? 0);
    sessionStorage.removeItem(CLE_REPRISE);
    sessionStorage.removeItem(CLE_REPRISE_AUTORISEE);
    if (!brut) return null;
    if (!(Number.isFinite(autorisation) && Date.now() - autorisation < AUTORISATION_VALABLE_MS)) return null;
    const lu = JSON.parse(brut);
    if (!lu?.club1?.id || !lu?.club2?.id) return null;
    if (!(Date.now() - Number(lu.quand) < REPRISE_VALABLE_MS)) return null;
    return { club1: lu.club1, club2: lu.club2 };
  } catch {
    return null;
  }
}
