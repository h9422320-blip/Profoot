import { NextResponse } from "next/server";
import { absencesRetenues, ligneAbsences } from "@/lib/absences";
import { MODELES_GEMINI } from "@/lib/gemini-models";
import { genererAnalyseJSON } from "@/lib/analyse-modele";
import { compterTentative, messageAttente } from "@/lib/limite-partagee";
import { PRIX_MATCH_UNIQUE, matchDebloque, matchUniqueDisponible } from "@/lib/match-unique";
import { openRouterDisponible } from "@/lib/openrouter";
import { requireUser } from "@/lib/subscription";
import { consumeAnalysis, buildMatchKey, rembourserAnalyse, type QuotaState } from "@/lib/analysis-quota";
import { toTeaser } from "@/lib/analysis-teaser";
import { lireReserve, ecrireReserve } from "@/lib/api-football";
import { lireCalibrages, facteursPour } from "@/lib/calibrage";
import { composerApercu as composerApercuVendeur } from "@/lib/apercu-vendeur";
import { scenarioGabarit } from "@/lib/apercu-ia";
import { clubs } from "@/lib/data";
import { findLiveTeam } from "@/lib/teams-live";
import { calculerScoreProbable, bornerConfiance, predireIssueFinale, competitionPeuFiable, melangerStatistiques, estMatchDePreparation, type ForcesDuMatch } from "@/lib/score-probable";
import { lireForcesLigue } from "@/lib/forces-equipes";
import { lirePredictionFigee, figerPrediction } from "@/lib/prediction-figee";
import { normaliserMatchDirect, trouverRencontreEnDirect, estEnDirect, type MatchDirect } from "@/lib/match-direct";
import { enregistrerEchecAnalyse } from "@/lib/echecs-analyse";
import { enregistrerAnalyse } from "@/lib/enregistrer-analyse";

// ============================================================================
// ProFoot ANALYSE ENGINE v6.0 — FULL AI DELEGATION
// ============================================================================

const analysisCache = new Map<string, { data: any; timestamp: number }>();
const apiFootballCache = new Map<string, { data: any; timestamp: number }>();

const CACHE_TTL = {
  ANALYSIS: 5 * 60 * 1000,
  API_DATA: 60 * 60 * 1000,
  TEAM_STATS: 6 * 60 * 60 * 1000,
};

/**
 * Appel a l API de donnees.
 *
 * `delaiMs` existe pour les appels de RATTRAPAGE : ceux qui ameliorent l analyse
 * sans lui etre indispensables. La requete entiere doit tenir sous les 60 s de
 * l hebergeur, modele de langage compris ; un rattrapage qui attendrait quinze
 * secondes ferait tuer la requete et l abonne verrait « Analyse interrompue »
 * pour un detail dont il se serait passe.
 */
/**
 * ── POURQUOI HUIT SECONDES ET NON QUINZE ──────────────────────────────────
 *
 * Une analyse fait VINGT-QUATRE appels à ce fournisseur avant même de
 * s'adresser au modèle, dont plusieurs en série. À quinze secondes chacun, la
 * collecte peut à elle seule consommer la moitié du budget de la requête.
 *
 * Or le budget accordé au modèle est ce qui RESTE : `55 000 ms moins le temps
 * déjà écoulé`. Mesuré sur trente-quatre échecs, toutes les coupures tombent
 * entre 47,7 et 50,4 secondes — c'est le budget total qui s'épuise, jamais un
 * modèle isolé. Chaque seconde rendue ici est une seconde de plus pour que
 * l'analyse aboutisse.
 *
 * Huit secondes suffisent : un appel de statistiques qui n'a pas répondu en
 * huit secondes ne répondra pas utilement — et la réserve en base couvre déjà
 * le cas où il ne répond pas du tout. Les appels de rattrapage, eux, gardent
 * leur propre délai plus court, passé explicitement.
 */
async function fetchApiFootball(endpoint: string, ttl: number = CACHE_TTL.API_DATA, delaiMs = 8000) {
  const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "MA_CLE_API" || API_FOOTBALL_KEY === "") {
    console.error("[BACKEND_ANALYZE] API Key missing!");
    return null;
  }
  
  const cacheKey = endpoint;
  const cached = apiFootballCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) return cached.data;

  // ── LA RÉSERVE EN BASE, AVANT D'APPELER LE FOURNISSEUR ───────────────────
  //
  // Ce cache-ci ne vit qu'en mémoire du serveur, et cette mémoire disparaît à
  // chaque démarrage à froid — plusieurs fois par heure. C'est LA route la plus
  // appelée du site : chaque redémarrage redemandait au fournisseur des
  // classements et des statistiques déjà connus.
  //
  // Le 16 août 2026, le quota journalier a atteint 98 %. À 100 %, plus aucune
  // analyse ne fonctionne pour personne — y compris pour un abonné qui vient
  // de payer.
  /**
   * UNE RÉPONSE VIDE N'EST PAS UNE DONNÉE.
   *
   * `{ response: [] }` arrive avec un code 200 et sans erreur : le fournisseur
   * dit poliment « je n'ai rien ». Mise en réserve, cette absence devenait une
   * vérité conservée six heures, resservie à chaque analyse sans que le
   * fournisseur soit jamais rappelé. La panne ne pouvait donc plus se réparer
   * d'elle-même.
   *
   * Constaté le 20 août 2026 : toutes les analyses annonçaient 2-1 — exactement
   * ce que le moteur produit quand il ne reçoit AUCUNE statistique — en moins de
   * deux secondes et sans consommer un centime d'IA. Deux cent deux entrées
   * vides dormaient en réserve.
   *
   * Une absence n'est donc plus ni servie, ni écrite. Au pire, on redemande.
   */
  const vraimentVide = (d: any) =>
    !d || (Array.isArray(d.response) ? d.response.length === 0 : d.response == null);

  const enReserve = await lireReserve(`apifb:${endpoint}`);
  if (enReserve && !enReserve.expiree && !vraimentVide(enReserve.contenu)) {
    setBounded(apiFootballCache, cacheKey, { data: enReserve.contenu, timestamp: Date.now() });
    return enReserve.contenu;
  }

  /**
   * Dernier recours quand le fournisseur ne répond pas.
   *
   * Une donnée d'il y a deux heures vaut infiniment mieux qu'une analyse
   * refusée à quelqu'un qui vient de payer. En revanche, sans rien en réserve,
   * on renvoie null : le moteur sait travailler avec moins de données, il ne
   * saurait pas travailler avec des données fausses.
   */
  const secours = (raison: string) => {
    // Une réserve vide ne secourt personne : mieux vaut renvoyer null, ce que
    // le moteur sait interpréter, qu'un « zéro match joué » qu'il prendra pour
    // une mesure.
    if (!enReserve || vraimentVide(enReserve.contenu)) return null;
    console.warn(`[BACKEND_ANALYZE] ${raison} sur ${endpoint} — donnée conservée servie.`);
    setBounded(apiFootballCache, cacheKey, { data: enReserve.contenu, timestamp: Date.now() });
    return enReserve.contenu;
  };

  const url = `https://v3.football.api-sports.io${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), delaiMs);
    const res = await fetch(url, {
      method: 'GET',
      headers: { "x-apisports-key": API_FOOTBALL_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[BACKEND_ANALYZE] API-Football error on ${endpoint}: ${res.status}`);
      return secours(`HTTP ${res.status}`);
    }
    const data = await res.json();

    // Le fournisseur répond parfois 200 avec une erreur dans le corps. Mettre
    // cette réponse vide en réserve rendrait la panne durable : chaque appel
    // suivant lirait un vide considéré comme valide.
    const erreurs = (data as any)?.errors;
    const enErreur = Array.isArray(erreurs)
      ? erreurs.length > 0
      : !!erreurs && Object.keys(erreurs).length > 0;
    if (enErreur) {
      console.error(
        `[BACKEND_ANALYZE] Erreur du fournisseur sur ${endpoint} :`,
        JSON.stringify(erreurs).slice(0, 200)
      );
      return secours('erreur du fournisseur');
    }

    setBounded(apiFootballCache, cacheKey, { data, timestamp: Date.now() });
    // Une absence n'est jamais mise en réserve : elle se figerait pour des
    // heures et l'application resservirait ce vide sans plus rien demander.
    if (!vraimentVide(data)) void ecrireReserve(`apifb:${endpoint}`, data, ttl);
    return data;
  } catch (e: any) {
    console.error(`[BACKEND_ANALYZE] Exception on ${endpoint}:`, e.message);
    return secours(e.name === 'AbortError' ? 'délai dépassé' : 'erreur réseau');
  }
}

async function getTeamApiId(team: any) {
  if (team.logo && team.logo.includes("api-sports.io/football/teams/")) {
    const match = team.logo.match(/teams\/(\d+)\.png/);
    if (match) return match[1];
  }
  
  let searchName = team.name;
  const translations: Record<string, string> = {
    // French -> English
    "espagne": "Spain", "allemagne": "Germany", "angleterre": "England", 
    "brésil": "Brazil", "bresil": "Brazil", "brasil": "Brazil",
    "france": "France", "argentine": "Argentina", "argentina": "Argentina",
    "maroc": "Morocco", "sénégal": "Senegal", "senegal": "Senegal", 
    "algérie": "Algeria", "algerie": "Algeria",
    "côte d'ivoire": "Ivory Coast", "cote d'ivoire": "Ivory Coast", "cote divoire": "Ivory Coast",
    "égypte": "Egypt", "egypte": "Egypt",
    "cameroun": "Cameroon", "rd congo": "Congo DR", "pays de galles": "Wales", 
    "croatie": "Croatia", "italie": "Italy", "danemark": "Denmark",
    "pays-bas": "Netherlands", "belgique": "Belgium", "portugal": "Portugal",
    "etats-unis": "USA", "usa": "USA", "suisse": "Switzerland", "uruguay": "Uruguay",
    "colombie": "Colombia", "mexique": "Mexico", "mexico": "Mexico",
    "ghana": "Ghana", "nigeria": "Nigeria", "tunisie": "Tunisia",
    "mali": "Mali", "guinée": "Guinea", "guinee": "Guinea", "burkina faso": "Burkina Faso",
    "japon": "Japan", "corée du sud": "South Korea", "australie": "Australia",
    "hollande": "Netherlands",
    "serbie": "Serbia", "pologne": "Poland", "roumanie": "Romania",
    "suède": "Sweden", "suede": "Sweden",
    "norvège": "Norway", "norvege": "Norway", "finlande": "Finland",
    "russie": "Russia", "turquie": "Turkey", "grèce": "Greece", "grece": "Greece",
    "chine": "China", "inde": "India", "arabie saoudite": "Saudi Arabia",
    "iran": "Iran", "irak": "Iraq", "émirats arabes unis": "United Arab Emirates",
    "angola": "Angola", "mozambique": "Mozambique", "zimbabwe": "Zimbabwe",
    "afrique du sud": "South Africa", "zambie": "Zambia", "kenya": "Kenya",
    "tanzanie": "Tanzania", "ethiopie": "Ethiopia",
    "venezuela": "Venezuela", "pérou": "Peru", "perou": "Peru", "chili": "Chile",
    "bolivie": "Bolivia", "équateur": "Ecuador", "equateur": "Ecuador", "paraguay": "Paraguay",
  };

  if (translations[team.name.toLowerCase()]) {
    searchName = translations[team.name.toLowerCase()];
  } else if (team.id) {
    const cleanId = team.id.replace("_can", "").replace("_spl", "").replace("_sl", "").replace(/_/g, " ");
    if (translations[cleanId.toLowerCase()]) {
      searchName = translations[cleanId.toLowerCase()];
    }
  }

  const search = await fetchApiFootball(`/teams?name=${encodeURIComponent(searchName)}`);
  if (search?.response?.length > 0) {
    const isNat = team.country === team.name || team.country === "Monde" || team.country === "Afrique" || team.region === "international" || team.region === "africa";
    if (isNat) {
        const nat = search.response.find((t: any) => t.team.national === true);
        if (nat) return nat.team.id;
    }
    return search.response[0].team.id;
  }
  return null;
}

/**
 * Statistiques d'une équipe dans son championnat, avec obstination.
 *
 * Trois obstacles se cumulent ici, et chacun a été constaté :
 *
 *  1. En début d'exercice, la saison en cours ne contient aucun match. On
 *     bascule alors sur la précédente, qui reste le meilleur reflet du niveau.
 *
 *  2. Sous rafale d'appels, l'API renvoie parfois une réponse vide avec un
 *     code 200 — vérifié : une requête donnait 0 match, la même relancée dix
 *     minutes plus tard en donnait 38. Un seul de ces à-coups suffisait à faire
 *     traiter Barcelone comme une équipe inconnue.
 *
 *  3. Une réponse vide et une équipe réellement sans historique se ressemblent.
 *     On insiste donc avant de conclure à l'absence de données, car cette
 *     conclusion fait tomber toute l'analyse sur des valeurs neutres.
 */
async function statistiquesEquipe(
  teamId: string | number,
  ligue: number,
  saison: number
): Promise<any> {
  const aDesDonnees = (r: any) => (r?.response?.fixtures?.played?.total ?? 0) > 0;

  for (const s of [saison, saison - 1]) {
    const premier = await fetchApiFootball(
      `/teams/statistics?team=${teamId}&season=${s}&league=${ligue}`,
      CACHE_TTL.TEAM_STATS,
      8000
    );
    if (aDesDonnees(premier)) return premier;

    // Une seule relance, et uniquement sur la saison précédente : c'est celle
    // qui doit contenir des données. Insister sur la saison en cours en début
    // d'exercice ne ferait que perdre du temps pour rien.
    if (s !== saison) {
      await new Promise((r) => setTimeout(r, 400));
      const second = await fetchApiFootball(
        `/teams/statistics?team=${teamId}&season=${s}&league=${ligue}&`,
        0,
        8000
      );
      if (aDesDonnees(second)) {
        console.log(`[BACKEND_ANALYZE] Statistiques de ${teamId} récupérées à la seconde tentative.`);
        return second;
      }
    }
  }
  console.warn(`[BACKEND_ANALYZE] Aucune statistique exploitable pour ${teamId} (ligue ${ligue}).`);
  return null;
}

/**
 * Championnat domestique d'une équipe.
 *
 * On ne retient que les compétitions de type « League ». Déduire le
 * championnat du dernier match joué rattachait les clubs à un match amical en
 * intersaison, ou à une finale de coupe, et toutes les statistiques suivantes
 * étaient alors calculées sur trois ou quatre rencontres sans rapport.
 *
 * La saison précédente sert de recours : au tout début d'un exercice, la
 * nouvelle n'est pas encore déclarée.
 */
async function resoudreChampionnat(teamId: string | number, saison: number): Promise<number | null> {
  for (const s of [saison, saison - 1]) {
    const r = await fetchApiFootball(`/leagues?team=${teamId}&season=${s}`, CACHE_TTL.TEAM_STATS, 8000);
    const championnat = (r?.response ?? []).find((x: any) => x?.league?.type === 'League');
    if (championnat?.league?.id) return championnat.league.id;
  }
  return null;
}

function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

import { clientIp, setBounded } from "@/lib/rateLimit";

// L'analyse enchaîne plusieurs appels API-Football puis un appel Gemini : bien
// au-delà des 10 s accordées par défaut à une fonction serverless. Sans cette
// déclaration, l'hébergeur interrompt la requête et le client voit une
// « erreur de connexion au modèle IA ».
export const maxDuration = 60;

/**
 * Budget de temps de la requête.
 *
 * `maxDuration` est un couperet : passé ce délai, l'hébergeur coupe et le
 * visiteur voit une erreur. On vise donc volontairement en dessous, et on
 * garde une réserve pour tout ce qui suit la réponse du modèle — analyse du
 * JSON, imposition des chiffres calculés, enregistrement dans l'historique.
 * Sans cette réserve, un modèle qui répond à la dernière seconde produit
 * quand même un échec.
 */
const LIMITE_PLATEFORME_MS = 55000;
// Ramenée de six à quatre secondes : la mise en forme mesurée prend moins
// d'une seconde, et chaque seconde rendue au modèle est une seconde de plus
// pour qu'il termine sa rédaction plutôt que d'être coupé.
const RESERVE_MISE_EN_FORME_MS = 4000;

/**
 * Contrôle final de cohérence, juste avant l'envoi.
 *
 * Les deux chemins de calcul normalisent déjà leurs pourcentages à 100 et
 * alignent le score sur l'issue la plus probable. Ce garde-fou ne corrige donc
 * rien aujourd'hui — il est là pour qu'une régression future se voie dans les
 * journaux au lieu d'arriver sur l'écran d'un abonné.
 *
 * Deux invariants, ceux-là même qui ont été rompus le 13 août : les trois
 * probabilités totalisent cent, et le score annoncé désigne le favori.
 */
function verifierCoherence(d: Record<string, any>, contexte: string) {
  const v = Number(d.winProb), n = Number(d.drawProb), l = Number(d.loseProb);
  if (![v, n, l].every(Number.isFinite)) return;

  const somme = Math.round(v + n + l);
  if (somme !== 100)
    console.error(`[COHERENCE] ${contexte} — les probabilités totalisent ${somme} % et non 100 (${v}/${n}/${l}).`);

  const buts1 = Number(d.predictedScore?.team1Goals);
  const buts2 = Number(d.predictedScore?.team2Goals);
  if (!Number.isFinite(buts1) || !Number.isFinite(buts2)) return;

  const issueScore = buts1 > buts2 ? 'victoire1' : buts1 < buts2 ? 'victoire2' : 'nul';
  const issueProbas = n >= v && n >= l ? 'nul' : v >= l ? 'victoire1' : 'victoire2';
  if (issueScore !== issueProbas)
    console.error(
      `[COHERENCE] ${contexte} — le score ${buts1}-${buts2} annonce « ${issueScore} » ` +
        `alors que les probabilités désignent « ${issueProbas} » (${v}/${n}/${l}).`
    );
}

/**
 * CE QUI A ÉTÉ PRÉLEVÉ SUR LE COMPTEUR DE L'ABONNÉ, ET QUI N'EST PAS ENCORE
 * PAYÉ DE RETOUR.
 *
 * La réservation du quota précède volontairement le travail : c'est elle qui
 * empêche deux clics de compter double. Mais si la requête s'arrête AVANT
 * d'avoir rien rendu — collecte de données en panne, plateforme qui coupe —
 * la ligne de décompte reste écrite pour une analyse qui n'a jamais existé.
 *
 * Ce billet suit la requête. Tant qu'il n'est pas « honoré », l'enveloppe
 * extérieure sait qu'elle doit rendre l'analyse au compteur.
 */
type BilletQuota = {
  userId: string;
  matchKey: string;
  equipe1: string;
  equipe2: string;
  /** Passé à vrai dès qu'une réponse — même de repli — part vers l'abonné. */
  honore: boolean;
};

/**
 * ── L'ENVELOPPE : PERSONNE NE PAIE POUR DU VIDE ───────────────────────────
 *
 * Le corps de l'analyse est protégé sur toute sa longueur, et plus seulement
 * autour de l'appel au modèle. Entre la réservation du quota et cet appel, il
 * y a une minute de collecte de données extérieures ; tout ce qui casse là
 * remontait jusqu'ici sans que personne n'en sache rien :
 *
 *   • l'abonné voyait « ANALYSE INTERROMPUE » ;
 *   • son compteur avait quand même reculé d'une unité ;
 *   • l'administration n'enregistrait aucun échec, puisque le journal se
 *     trouvait à l'intérieur du bloc qui venait d'être court-circuité.
 *
 * Sur une offre à quinze analyses par mois, c'est en vendre quatorze. Le
 * compteur affiché est juste — il compte simplement une analyse qui n'a jamais
 * eu lieu.
 */
export async function POST(req: Request) {
  const billet: BilletQuota = {
    userId: '',
    matchKey: '',
    equipe1: '',
    equipe2: '',
    honore: false,
  };

  try {
    return await analyser(req, billet);
  } catch (e: any) {
    console.error('[BACKEND_ANALYZE] Analyse interrompue avant toute réponse :', e?.message ?? e);

    if (billet.userId && !billet.honore) {
      // L'échec est enregistré ICI, et pas plus haut : c'est le seul endroit
      // qui voit les pannes survenues AVANT l'appel au modèle. Marqué « rien
      // servi » — c'est le chiffre de l'administration qui doit rester à zéro.
      enregistrerEchecAnalyse({
        userId: billet.userId,
        equipe1: billet.equipe1 || '?',
        equipe2: billet.equipe2 || '?',
        competition: null,
        message: `Interrompue avant toute réponse — ${String(e?.message ?? e).slice(0, 200)}`,
        modele: 'aucun',
        dureeMs: 0,
        serviQuandMeme: false,
        pays: req.headers.get('x-vercel-ip-country') ?? null,
      });

      await rembourserAnalyse(billet.userId, billet.matchKey);
    }

    // Un message lisible plutôt qu'une erreur de plateforme : le navigateur
    // relance tout seul, et la personne ne voit passer que l'attente.
    return NextResponse.json(
      {
        error: "L'analyse n'a pas pu aboutir. Votre quota n'a pas été décompté.",
        code: 'ANALYSIS_FAILED',
        rembourse: true,
      },
      { status: 503 }
    );
  }
}

async function analyser(req: Request, billet: BilletQuota) {
  const debutRequete = Date.now();
  // --- PERMISSIONS ---
  // L'analyse est ouverte à tout utilisateur connecté : le modèle produit est
  // un APERÇU gratuit (résultat partiel, reste flouté avec invitation à
  // s'abonner). Exiger un abonnement ici supprimerait cet aperçu, qui est le
  // principal levier de conversion.
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  // ── BOUCLIER ANTI-SPAM : CINQ ANALYSES PAR MINUTE ────────────────────────
  //
  // Clé = identifiant du compte : contrairement à l'IP, il n'est pas
  // renouvelable à volonté par l'attaquant.
  //
  // LE COMPTE VIT EN BASE, PLUS EN MÉMOIRE. Sur Vercel, chaque requête peut
  // atterrir sur une instance différente, et chaque instance avait son propre
  // compteur : « cinq par minute » devenait cinq par minute PAR INSTANCE. Avec
  // dix instances éveillées, cinquante analyses payantes par minute passaient
  // pour un seul compte. C'est cette route qui appelle le modèle : chaque
  // requête coûte de l'argent réel.
  const ip = guard.user.id;
  const limite = await compterTentative('analyse', ip, 5, 60 * 1000);
  if (limite.bloque) {
    console.warn(`[ANTI-SPAM] Compte ${ip} bloqué pour abus d'analyse.`);
    return NextResponse.json(
      { error: `Trop de requêtes. ${messageAttente(limite.attendreSecondes)}` },
      { status: 429 }
    );
  }
  // --------------------------------------------------

  let reqPayload: any = {};
  try {
    reqPayload = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // SÉCURITÉ : les équipes sont résolues depuis le référentiel serveur à partir
  // de leur seul identifiant. Faire confiance aux noms envoyés par le client
  // permettrait d'injecter des instructions dans le prompt de l'IA, et de
  // stocker la réponse détournée dans le cache partagé par tous les abonnés.
  const rawTeam1 = reqPayload.team1;
  const rawTeam2 = reqPayload.team2;

  /**
   * ── S'AGIT-IL D'UNE REPRISE APRÈS ÉCHEC ? ───────────────────────────────
   *
   * Le navigateur relance une fois, tout seul, quand la première tentative a
   * échoué — la personne ne voit pas passer l'incident. Cette reprise n'est pas
   * une requête ordinaire, et elle ne doit pas être traitée comme telle :
   *
   *   • Les données du match viennent d'être mises en réserve. La collecte, qui
   *     prend vingt secondes à froid, en prend deux. Inutile de garder un
   *     budget calculé pour le cas lent.
   *
   *   • Le modèle qui vient de fauter n'a aucune raison de mieux se comporter
   *     trente secondes plus tard. On repart de plus loin dans la cascade.
   *
   * Borné à trois : au-delà, une valeur venue du navigateur ne doit pas pouvoir
   * décaler la liste des modèles à sa guise.
   */
  const reprise = Math.min(3, Math.max(0, Number(reqPayload.reprise) || 0));
  if (!rawTeam1?.id || !rawTeam2?.id) {
    return NextResponse.json({ error: "Équipes manquantes" }, { status: 400 });
  }
  // hasOwnProperty et non `clubs[id]` : un identifiant comme "constructor" ou
  // "toString" remonte la chaîne de prototypes et passerait un simple test de
  // vérité, avec un objet qui n'est pas une équipe.
  const teamKey1 = String(rawTeam1.id);
  const teamKey2 = String(rawTeam2.id);

  // Une équipe est valide si elle figure dans le référentiel historique OU
  // dans la liste chargée en direct depuis API-Football (promus, championnats
  // hors « big 5 »). Le nom n'est jamais repris du client : il vient toujours
  // d'une source serveur, ce qui ferme l'injection dans le prompt de l'IA.
  const resolveTeam = async (id: string) => {
    if (Object.prototype.hasOwnProperty.call(clubs, id)) return clubs[id];
    const live = await findLiveTeam(id);
    if (!live) return null;
    return {
      id: live.id,
      name: live.name,
      logo: live.logo,
      country: live.country,
      league: live.league,
      stadium: live.stadium,
    } as any;
  };

  const [team1, team2] = await Promise.all([resolveTeam(teamKey1), resolveTeam(teamKey2)]);
  if (!team1 || !team2) {
    return NextResponse.json({ error: "Équipe inconnue" }, { status: 404 });
  }

  // --- QUOTA MENSUEL ---
  // Contrôlé AVANT le cache : sinon un abonné ayant épuisé sa limite obtiendrait
  // gratuitement une analyse déjà mise en cache par quelqu'un d'autre.
  // Les comptes gratuits ne sont pas décomptés : ils reçoivent l'aperçu
  // partiel, verrouillé par le paywall — c'est le levier de conversion.
  const quotaMatchKey = buildMatchKey(team1.id, team2.id);
  let quota: QuotaState | null = null;

  if (guard.entitlements.premium) {
    const consumption = await consumeAnalysis(
      guard.user.id,
      guard.entitlements,
      quotaMatchKey
    );
    quota = consumption.state;

    // ── LE BILLET N'EST OUVERT QUE POUR UN VRAI PRÉLÈVEMENT ───────────────
    //
    // `alreadyCounted` signifie que cette analyse était déjà décomptée — même
    // match, même période. Elle a donc déjà été servie une première fois, et
    // la rembourser reviendrait à effacer un décompte légitime.
    if (consumption.allowed && !consumption.alreadyCounted && !consumption.state.unlimited) {
      billet.userId = guard.user.id;
      billet.matchKey = quotaMatchKey;
      billet.equipe1 = team1.name;
      billet.equipe2 = team2.name;
    }

    if (!consumption.allowed) {
      return NextResponse.json(
        {
          error: `Limite mensuelle atteinte : ${consumption.state.limit} analyses pour votre offre.`,
          code: 'ANALYSIS_LIMIT_REACHED',
          quota: consumption.state,
        },
        { status: 429 }
      );
    }
  }
  // ── AUCUN PLAFOND POUR LES COMPTES GRATUITS ────────────────────────────────
  //
  // Une limite de trois rencontres a existé ici du 20 au 21 août 2026. Elle
  // partait d'un raisonnement juste — chaque essai appelle un modèle payant —
  // et s'est révélée fausse à l'usage : les visiteurs partaient AVANT même
  // d'atteindre le mur de paiement. Un compteur qui s'épuise se lit comme une
  // porte qui se ferme, pas comme une invitation à payer.
  //
  // Ce qui protège réellement la facture, ce n'est pas le nombre d'essais mais
  // ce qu'on envoie : un compte gratuit reçoit l'APERÇU, jamais l'analyse
  // complète. Le mur de paiement sert à débloquer le contenu, pas à barrer
  // l'accès. C'est `aDroitAuComplet`, plus bas, qui tient cette ligne — et lui
  // seul décide de ce qui est produit.

  /**
   * Seule sortie de cette route. Un compte sans abonnement ne reçoit que
   * l'aperçu : le contenu payant est retiré ICI et ne quitte jamais le serveur.
   * Flouter côté navigateur ne protégeait rien, la réponse complète étant déjà
   * lisible dans les outils de développement.
   */
  /**
   * A-t-il droit à l'analyse complète de CE match ?
   *
   * Deux titres y donnent accès, et ils donnent exactement le même contenu :
   * un abonnement en cours, ou l'achat de ce match à l'unité. Le second est
   * définitif et ne concerne que cette rencontre.
   *
   * Déterminé ici, une fois pour toutes : ce drapeau décide de ce qu'on demande
   * au modèle, de l'entrée de cache utilisée, et de ce qu'on renvoie. Les trois
   * DOIVENT s'accorder — sinon une version réduite finirait chez quelqu'un qui
   * a payé.
   */
  const aDroitAuComplet =
    guard.entitlements.premium || (await matchDebloque(guard.user.id, team1.id, team2.id));

  const estApercuGlobal = !aDroitAuComplet;

  /**
   * Point de passage unique de toutes les réponses.
   *
   * L'enregistrement de l'historique se fait ICI, et non dans le navigateur.
   * Écrit côté client, il ne disposait que de ce que le paywall laissait
   * passer : un compte gratuit ne reçoit ni le score prédit ni les
   * probabilités, et la ligne partait donc vide — ou pire, remplie d'un « 2-1 »
   * de remplissage. Sur le serveur, l'analyse complète est disponible quel que
   * soit l'abonnement.
   *
   * `dejaEnregistre` évite de recréer une ligne à chaque consultation d'une
   * analyse déjà servie depuis le cache.
   */
  /**
   * L'IDENTIFIANT DE LA RENCONTRE CHEZ LE FOURNISSEUR.
   *
   * SANS LUI, UNE ANALYSE NE PROUVE JAMAIS RIEN.
   *
   * C'est la seule clé qui permette, plus tard, d'aller chercher le résultat
   * réel et de confronter le pronostic. Une ligne d'historique sans identifiant
   * n'est jamais vérifiée, ne devient jamais une preuve, et disparaît du mur
   * public — quelle que soit la justesse du pronostic.
   *
   * Il manquait depuis le 16 août 2026, 19 h 49, quand l'enregistrement est
   * passé du navigateur au serveur : la nouvelle fonction n'a pas repris cette
   * colonne. Mille sept cent vingt-deux analyses ont été écrites en trois jours
   * sans identifiant — dont Barcelone, le Real, Liverpool, Arsenal et l'Inter.
   * Le mur de preuves est resté figé au 16 août sans qu'aucune erreur ne soit
   * signalée nulle part : rien ne plantait, la preuve ne naissait simplement
   * jamais.
   *
   * Renseigné dès que la rencontre est identifiée, plus bas. `respond` le lit
   * au moment de l'appel, donc après.
   */
  let fixtureIdResolu: number | null = null;

  const respond = async (data: Record<string, any>, dejaEnregistre = false) => {
    // Le billet est honoré : quelque chose part vers l'abonné — une analyse
    // complète, un match déjà joué ou un repli, peu importe. Le décompte est
    // alors mérité, et l'enveloppe extérieure ne le remboursera pas.
    billet.honore = true;

    if (!dejaEnregistre) {
      enregistrerAnalyse({
        userId: guard.user.id,
        fixtureId: fixtureIdResolu,
        equipe1: { id: team1.id, name: team1.name, logo: team1.logo, league: team1.league },
        equipe2: { id: team2.id, name: team2.name, logo: team2.logo, league: team2.league },
        donnees: data,
      });
    }
    return NextResponse.json(
      aDroitAuComplet
        ? {
            ...data,
            quota,
            // Vrai quand l'accès vient d'un achat à l'unité et non d'un
            // abonnement. C'est le seul moment où proposer l'abonnement a du
            // sens : la personne vient de payer, elle a la preuve en main.
            debloqueParAchat: !guard.entitlements.premium,
          }
        : {
            ...(await toTeaser(data, team1.name, team2.name)),
            quota,
            // L offre a l unite est decrite ICI et nulle part ailleurs : le
            // prix et l identifiant du produit vivent cote serveur, et le
            // navigateur ne doit pas avoir a importer ce module.
            matchUnique: {
              disponible: matchUniqueDisponible(),
              prix: PRIX_MATCH_UNIQUE,
              equipe1Id: String(team1.id),
              equipe2Id: String(team2.id),
              equipe1Nom: String(team1.name ?? ''),
              equipe2Nom: String(team2.name ?? ''),
            },
          }
    );
  };

  const today = new Date().toISOString().split('T')[0];

  // ── LE CACHE DOIT SÉPARER L'APERÇU DE L'ANALYSE COMPLÈTE ──────────────────
  //
  // Depuis que l'aperçu gratuit ne fait plus générer les sections détaillées,
  // une seule clé par match serait un piège : un visiteur non abonné analysant
  // Paris — Lens y déposerait une version réduite, et L'ABONNÉ SUIVANT LA
  // RECEVRAIT TELLE QUELLE. Il aurait payé pour une analyse amputée, sans que
  // rien ne signale l'erreur — ni exception, ni journal.
  //
  // Deux entrées distinctes, donc. Un abonné n'accepte QUE la complète ; s'il
  // n'en existe pas, l'analyse est régénérée intégralement pour lui. Un compte
  // gratuit se contente de l'une ou l'autre : `toTeaser` réduit la complète
  // sans le moindre risque, et c'est autant d'appels économisés.
  const cleComplete = `${team1.id}-${team2.id}-${today}-complet`;
  const cleApercu = `${team1.id}-${team2.id}-${today}-apercu`;
  const cacheKey = estApercuGlobal ? cleApercu : cleComplete;

  const cachedAnalysis = aDroitAuComplet
    ? analysisCache.get(cleComplete)
    : analysisCache.get(cleComplete) ?? analysisCache.get(cleApercu);

  if (cachedAnalysis && Date.now() - cachedAnalysis.timestamp < CACHE_TTL.ANALYSIS) {
    console.log(`[BACKEND_ANALYZE] Returning CACHED analysis for ${team1.name} vs ${team2.name}`);
    return await respond(cachedAnalysis.data, true);
  }

  console.log(`[BACKEND_ANALYZE] Starting analysis for ${team1.name} vs ${team2.name}`);

  const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "MA_CLE_API" || API_FOOTBALL_KEY === "") {
    // Levé plutôt que renvoyé tel quel : l'enveloppe rend alors l'analyse au
    // compteur et inscrit la panne dans l'administration. Une clé absente est
    // un défaut de configuration, pas quelque chose que l'abonné doit payer.
    throw new Error("API Football non configurée (API_FOOTBALL_KEY absente).");
  }

  let id1 = null; let id2 = null;
  try {
    const ids = await Promise.all([getTeamApiId(team1), getTeamApiId(team2)]);
    id1 = ids[0]; id2 = ids[1];
  } catch (e) {}

  let t1Data: any = null, t2Data: any = null, h2hRes: any = null, nextH2H: any = null;
  // Derniers matchs joués, indépendamment de la saison — voir plus bas.
  let t1Recent: any = { response: [] }, t2Recent: any = { response: [] };
  let matchDirect: MatchDirect | null = null;
  const season = getCurrentSeason();

  if (id1 && id2) {
    console.log(`[BACKEND_ANALYZE] Fetching H2H and Fixtures...`);
    // Sans le paramètre `next`, l'API ne renvoie que des confrontations
    // PASSÉES : la rencontre à venir (date, heure, stade) était donc invisible.
    //
    // Deux requêtes distinctes pour les matchs d'une équipe :
    //
    //  - AVEC la saison : sert à identifier le championnat de l'équipe.
    //
    //  - SANS la saison : sert à la forme récente. En début d'exercice, une
    //    équipe n'a joué que deux ou trois matchs amicaux dans la saison en
    //    cours ; filtrer dessus ne renvoyait donc que ces deux matchs et
    //    l'affichage se remplissait de cases vides. La forme d'une équipe ne
    //    s'arrête pas au 1er juillet : les dernières journées de l'exercice
    //    précédent en font partie.
    // La recherche du match en cours voyage AVEC les autres appels, jamais
    // après.
    //
    // Placée en série, elle ajoutait son propre délai à une requête qui enchaîne
    // déjà plusieurs appels de données puis le modèle, le tout sous la limite de
    // 60 s de l'hébergeur. Constaté en production : « Analyse interrompue » chez
    // l'abonné, et rien dans le journal des échecs — parce que la requête était
    // tuée avant même d'y arriver.
    //
    // Un match EN COURS n'apparaît pas dans les confrontations directes au coup
    // d'envoi : il faut demander explicitement les matchs en cours de l'équipe.
    // Cache de 30 secondes — le score évolue, mais cent abonnés sur la même
    // affiche ne doivent pas coûter cent requêtes.
    const [t1Fixtures, t2Fixtures, h2hr, nextH2Hr, r1, r2, enDirect] = await Promise.all([
      fetchApiFootball(`/fixtures?team=${id1}&season=${season}&last=10`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures?team=${id2}&season=${season}&last=10`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures/headtohead?h2h=${id1}-${id2}`),
      fetchApiFootball(`/fixtures/headtohead?h2h=${id1}-${id2}&next=1`, CACHE_TTL.API_DATA),
      fetchApiFootball(`/fixtures?team=${id1}&last=12`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures?team=${id2}&last=12`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/fixtures?live=all&team=${id1}`, 30 * 1000),
    ]);
    t1Data = { data: t1Fixtures, season };
    t2Data = { data: t2Fixtures, season };
    t1Recent = r1 ?? { response: [] };
    t2Recent = r2 ?? { response: [] };
    h2hRes = h2hr;
    nextH2H = nextH2Hr?.response?.[0] || null;

    const rencontreEnDirect = trouverRencontreEnDirect(enDirect, id1, id2);
    if (rencontreEnDirect) matchDirect = normaliserMatchDirect(rencontreEnDirect, id1);
  } else {
    console.warn(`[BACKEND_ANALYZE] API-Football IDs missing (Rate Limit or Unmapped). Bypassing API-Football for PURE AI analysis.`);
    t1Data = { data: { response: [] }, season };
    t2Data = { data: { response: [] }, season };
    h2hRes = { response: [] };
  }

  const h2hList = h2hRes?.response || [];
  h2hList.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
  
  const futureMatches = h2hList.filter((m: any) => ["NS", "TBD", "PST"].includes(m.fixture.status.short));
  const pastMatches = h2hList.filter((m: any) => ["FT", "AET", "PEN"].includes(m.fixture.status.short));

  const targetFutureMatch = futureMatches.length > 0 ? futureMatches[futureMatches.length - 1] : null;
  const targetPastMatch = pastMatches.length > 0 ? pastMatches[0] : null;

  // ── LA RENCONTRE EST IDENTIFIÉE : ON RETIENT SON NUMÉRO ────────────────────
  //
  // Dans l'ordre où l'analyse s'y intéresse : la rencontre à venir est celle
  // qu'on pronostique, le direct vient ensuite, le passé en dernier. C'est ce
  // numéro qui permettra d'aller chercher le résultat et de juger le pronostic.
  fixtureIdResolu =
    targetFutureMatch?.fixture?.id ??
    matchDirect?.fixtureId ??
    targetPastMatch?.fixture?.id ??
    null;

  // ── SECONDE CHANCE POUR LE DIRECT ──────────────────────────────────────────
  //
  // La rencontre en cours finit par apparaître dans l'historique des
  // confrontations — vérifié : absente en début de match, présente à la 72ᵉ
  // avec le statut « 2H ». On dispose donc de deux sources indépendantes.
  //
  // Elles sont toutes les deux utilisées, et ce n'est pas un luxe : un seul
  // appel réseau qui échoue suffisait à faire retomber l'affichage sur la
  // dernière rencontre terminée — celle d'avril 2025 présentée comme le match
  // du jour. Tant qu'une des deux sources répond, le direct l'emporte.
  const rencontreEnDirectH2H = h2hList.find((m: any) => estEnDirect(m?.fixture?.status?.short));

  if (!matchDirect && rencontreEnDirectH2H && id1) {
    // L'historique donne le score et la minute, jamais les buteurs. On va les
    // chercher sur la fiche du match, et on se contente du score si elle ne
    // répond pas : un score juste sans buteurs vaut mieux qu'un match périmé.
    const fiche = await fetchApiFootball(
      `/fixtures?id=${rencontreEnDirectH2H.fixture.id}`,
      30 * 1000,
      6000
    );
    matchDirect =
      normaliserMatchDirect(fiche?.response?.[0], id1) ??
      normaliserMatchDirect(rencontreEnDirectH2H, id1);

    if (matchDirect) {
      console.log(
        `[BACKEND_ANALYZE] Direct récupéré par l'historique (${matchDirect.buts1}-${matchDirect.buts2}, ${matchDirect.statut}).`
      );
      // Le direct a été retrouvé par la seconde source, après le premier
      // relevé : sans cette ligne, l'analyse d'un match en cours repartirait
      // sans identifiant et ne serait jamais vérifiable.
      fixtureIdResolu ??= matchDirect.fixtureId;
    }
  }

  // Une rencontre en cours n'est ni à venir ni terminée : elle ne doit jamais
  // être comptée parmi les matchs passés.
  const passeReel = targetPastMatch && !estEnDirect(targetPastMatch?.fixture?.status?.short)
    ? targetPastMatch
    : null;

  // ============================================================================
  // CASE 1: MATCH IS IN THE PAST
  // ============================================================================
  if (passeReel && !targetFutureMatch && !matchDirect) {
    // ... (Past Match Logic remains the same as before for history)
    const fixtureId = targetPastMatch.fixture.id;
    const [eventsRes, statsRes] = await Promise.all([
      fetchApiFootball(`/fixtures/events?fixture=${fixtureId}`),
      fetchApiFootball(`/fixtures/statistics?fixture=${fixtureId}`)
    ]);

    const isTeam1Home = targetPastMatch.teams.home.id.toString() === id1.toString();
    const hScore = targetPastMatch.goals.home;
    const aScore = targetPastMatch.goals.away;
    const events = eventsRes?.response || [];
    const stats = statsRes?.response || [];
    const homeStats = stats.find((s: any) => s.team.id === targetPastMatch.teams.home.id)?.statistics || [];
    const awayStats = stats.find((s: any) => s.team.id === targetPastMatch.teams.away.id)?.statistics || [];

    const getStat = (arr: any[], type: string) => {
      const s = arr.find((x: any) => x.type === type);
      if (!s || s.value === null) return 0;
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
      return parseInt(s.value);
    };

    const formatEvents = events.map((ev: any) => {
      let type = "unknown";
      if (ev.type === "Goal") type = "goal";
      if (ev.type === "Card" && ev.detail.includes("Yellow")) type = "card-yellow";
      if (ev.type === "Card" && ev.detail.includes("Red")) type = "card-red";
      const isHomeEvent = ev.team.id === targetPastMatch.teams.home.id;
      const side = (isHomeEvent && isTeam1Home) || (!isHomeEvent && !isTeam1Home) ? "team1" : "team2";
      return { type, name: ev.player.name, minute: ev.time.elapsed, side };
    }).filter((ev: any) => ev.type !== "unknown");

    const scorers = formatEvents.filter((ev: any) => ev.type === "goal").map((ev: any) => ({ name: ev.name, minute: ev.minute, side: ev.side }));
    const team1StatsData = isTeam1Home ? homeStats : awayStats;
    const team2StatsData = !isTeam1Home ? homeStats : awayStats;

    const realMatchResult = {
      isFinished: true,
      score: isTeam1Home ? `${hScore} - ${aScore}` : `${aScore} - ${hScore}`,
      venue: targetPastMatch.fixture.venue.name || "Stade",
      date: new Date(targetPastMatch.fixture.date).toLocaleDateString("fr-FR"),
      competition: targetPastMatch.league.name,
      scorers,
      events: formatEvents,
      stats: {
        possession: { team1: getStat(team1StatsData, "Ball Possession"), team2: getStat(team2StatsData, "Ball Possession") },
        shots: { team1: getStat(team1StatsData, "Total Shots"), team2: getStat(team1StatsData, "Total Shots") },
        shotsOnTarget: { team1: getStat(team1StatsData, "Shots on Goal"), team2: getStat(team2StatsData, "Shots on Goal") },
        corners: { team1: getStat(team1StatsData, "Corner Kicks"), team2: getStat(team2StatsData, "Corner Kicks") },
        fouls: { team1: getStat(team1StatsData, "Fouls"), team2: getStat(team2StatsData, "Fouls") },
        passes: { team1: getStat(team1StatsData, "Total passes"), team2: getStat(team2StatsData, "Total passes") }
      },
      summary: `Score final certifié via API-Football. ${targetPastMatch.teams.home.name} ${hScore} - ${aScore} ${targetPastMatch.teams.away.name}.`
    };
    setBounded(analysisCache, cacheKey, { data: realMatchResult, timestamp: Date.now() });
    return await respond(realMatchResult);
  }

  // ============================================================================
  // CASE 2: FUTURE MATCH — FULL AI PREDICTION WITH GEMINI
  // ============================================================================
  console.log(`[BACKEND_ANALYZE] Match identified as FUTURE. Fetching deep stats...`);

  const t1Fixtures = t1Data.data;
  const t2Fixtures = t2Data.data;
  const t1Season = t1Data.season;
  const t2Season = t2Data.season;

  // ── CHAMPIONNAT DE CHAQUE ÉQUIPE ───────────────────────────────────────────
  //
  // Il était déduit de la compétition du dernier match joué. En août, ce sont
  // des matchs AMICAUX : vérifié le 12 août 2026, Barcelone et Elche étaient
  // tous deux rattachés à « Friendlies Clubs », et le PSG comme Aston Villa à
  // la « UEFA Super Cup » où ils comptent zéro match.
  //
  // Toutes les statistiques qui suivent — buts marqués, encaissés, forme — se
  // retrouvaient donc calculées sur quatre matchs de préparation. C'est ce qui
  // a produit un Barcelone — Elche donné à l'avantage d'Elche, avec une
  // confiance plancher de 45 %.
  //
  // Le championnat se demande maintenant directement, et l'on ne retient que
  // les compétitions de type « League » : ni coupes, ni amicaux.
  let t1League = 39; let t2League = 39;
  if (t1Fixtures?.response?.length > 0) t1League = t1Fixtures.response[0].league.id;
  if (t2Fixtures?.response?.length > 0) t2League = t2Fixtures.response[0].league.id;

  // ── LES DEUX ÉQUIPES JOUENT-ELLES DANS LE MÊME CHAMPIONNAT ? ──────────────
  //
  // Question décisive pour la confiance affichée : les forces de chaque équipe
  // sont calculées À L'INTÉRIEUR de son championnat, et les comparer d'un pays
  // à l'autre revient à comparer deux échelles qui n'ont pas la même graduation.
  //
  // Mesuré le 24 août 2026 sur 353 rencontres vérifiées : 57 % de réussite
  // entre équipes du même championnat, 43 % entre championnats différents — et
  // une confiance affichée quasi identique dans les deux cas.
  //
  // Le drapeau ne se lève que si les DEUX championnats ont été résolus et
  // qu'ils diffèrent. `t1League` et `t2League` valent 39 par défaut : sans
  // cette précaution, une équipe dont le championnat reste introuvable
  // paraîtrait anglaise et déclencherait un plafond injustifié.
  let comparaisonCroisee = false;

  if (id1 && id2) {
    const [ligue1, ligue2] = await Promise.all([
      resoudreChampionnat(id1, season),
      resoudreChampionnat(id2, season),
    ]);
    if (ligue1) t1League = ligue1;
    if (ligue2) t2League = ligue2;
    comparaisonCroisee = !!ligue1 && !!ligue2 && Number(ligue1) !== Number(ligue2);
    console.log(
      `[BACKEND_ANALYZE] Championnats retenus : ${t1League} et ${t2League}` +
        `${comparaisonCroisee ? ' — comparaison croisée, confiance plafonnée.' : '.'}`
    );
  }

  let t1Stats = null, t2Stats = null, t1Injuries = null, t2Injuries = null, t1Squad = null, t2Squad = null, t1TopScorers = null, t2TopScorers = null, t1Standings = null, t2Standings = null, t1StandingsPrecedent = null, t2StandingsPrecedent = null;

  if (id1 && id2) {
    const statsRes = await Promise.all([
      statistiquesEquipe(id1, t1League, t1Season),
      statistiquesEquipe(id2, t2League, t2Season),
      fetchApiFootball(`/injuries?team=${id1}&season=${t1Season}`),
      fetchApiFootball(`/injuries?team=${id2}&season=${t2Season}`),
      fetchApiFootball(`/players/squads?team=${id1}`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/players/squads?team=${id2}`, CACHE_TTL.TEAM_STATS),
      fetchApiFootball(`/players/topscorers?season=${t1Season}&league=${t1League}`),
      fetchApiFootball(`/players/topscorers?season=${t2Season}&league=${t2League}`),
      fetchApiFootball(`/standings?season=${t1Season}&league=${t1League}`, CACHE_TTL.API_DATA),
      fetchApiFootball(`/standings?season=${t2Season}&league=${t2League}`, CACHE_TTL.API_DATA),
      // Repli : en ouverture de saison, le classement en cours est vide de sens.
      fetchApiFootball(`/standings?season=${t1Season - 1}&league=${t1League}`, CACHE_TTL.API_DATA),
      fetchApiFootball(`/standings?season=${t2Season - 1}&league=${t2League}`, CACHE_TTL.API_DATA)
    ]);
    [t1Stats, t2Stats, t1Injuries, t2Injuries, t1Squad, t2Squad, t1TopScorers, t2TopScorers, t1Standings, t2Standings, t1StandingsPrecedent, t2StandingsPrecedent] = statsRes;

    // La bascule sur la saison précédente et la relance en cas de réponse vide
    // sont désormais assurées par statistiquesEquipe, au plus près de la lecture.
  }

  /**
   * Le classement d'une équipe — et surtout, un classement QUI VEUT DIRE
   * QUELQUE CHOSE.
   *
   * En ouverture de saison, tout le monde est à zéro point et le fournisseur
   * range les équipes par ordre alphabétique. Le moteur annonçait ainsi « Paris
   * Saint-Germain classé 13e sur 18 » la veille du Trophée des Champions — et
   * l'écrivait noir sur blanc dans le prompt envoyé au modèle. Un classement à
   * zéro point n'est pas un classement : c'est une liste.
   *
   * On bascule donc sur la saison précédente tant que le championnat n'a pas
   * commencé. Le PSG y figure 1er avec 76 points, Lens 2e avec 70 — deux
   * informations vraies, là où « 13e » et « 14e » étaient deux mensonges.
   */
  const lireClassement = (standingsRes: any, teamId: string) => {
    try {
      const table = standingsRes?.response?.[0]?.league?.standings?.[0] || [];
      if (!table.length) return null;
      // Championnat pas encore commencé : le classement ne distingue rien.
      const totalPoints = table.reduce((t: number, s: any) => t + (Number(s.points) || 0), 0);
      if (totalPoints === 0) return null;

      const ligne = table.find((s: any) => String(s.team?.id) === String(teamId));
      if (!ligne) return null;
      return {
        rang: Number(ligne.rank),
        equipes: table.length,
        points: Number(ligne.points) || 0,
        forme: ligne.form ?? null,
        // Repère indispensable : 70 points ne veulent rien dire sans savoir ce
        // que valent les autres.
        pointsMoyens: totalPoints / table.length,
        pointsMax: Math.max(...table.map((s: any) => Number(s.points) || 0)),
      };
    } catch {
      return null;
    }
  };

  const classement1 =
    lireClassement(t1Standings, id1) ?? lireClassement(t1StandingsPrecedent, id1);
  const classement2 =
    lireClassement(t2Standings, id2) ?? lireClassement(t2StandingsPrecedent, id2);

  const decrire = (c: ReturnType<typeof lireClassement>) =>
    c
      ? `Classé ${c.rang}e sur ${c.equipes} avec ${c.points} points (moyenne du championnat : ${Math.round(c.pointsMoyens)}).` +
        (c.forme ? ` Forme : ${c.forme}.` : '')
      : "Classement inconnu ou non applicable (ex: match amical).";

  const stand1 = decrire(classement1);
  const stand2 = decrire(classement2);

  // Extract squad player names
  function extractSquad(squadRes: any) {
    const players = squadRes?.response?.[0]?.players || [];
    const byPosition: Record<string, string[]> = { Goalkeeper: [], Defender: [], Midfielder: [], Attacker: [] };
    players.forEach((p: any) => {
      const pos = p.position || 'Unknown';
      if (byPosition[pos]) byPosition[pos].push(p.name);
    });
    return { all: players.map((p: any) => p.name), byPosition, count: players.length };
  }
  const squad1 = extractSquad(t1Squad);
  const squad2 = extractSquad(t2Squad);

  function extractTeamTopScorers(topScorersRes: any, teamId: string) {
    const all = topScorersRes?.response || [];
    return all.filter((p: any) => p.statistics?.[0]?.team?.id?.toString() === teamId.toString()).slice(0, 3).map((p: any) => ({ name: p.player.name, goals: p.statistics[0].goals.total || 0 }));
  }
  const scorers1 = extractTeamTopScorers(t1TopScorers, id1);
  const scorers2 = extractTeamTopScorers(t2TopScorers, id2);

  // Get Recent Matches
  /**
   * Buts marqués et encaissés, reconstitués depuis les derniers matchs joués.
   *
   * Dernier rempart contre la confiance plancher de 45 %.
   *
   * Les statistiques de championnat manquent dans des cas parfaitement
   * ordinaires : une équipe nationale, un club de division inférieure, un promu,
   * un championnat que le fournisseur ne couvre pas en détail. Le calcul du
   * score recevait alors des zéros des deux côtés, traitait les équipes comme
   * équivalentes, et rendait un score sans intérêt assorti d'une confiance
   * plancher — le fameux « 45 % » qui revenait partout.
   *
   * Or les derniers matchs joués, eux, sont TOUJOURS disponibles : ils sont déjà
   * chargés pour afficher la forme, toutes compétitions et toutes saisons
   * confondues. Ils donnent une attaque et une défense réelles. C'est moins
   * précis qu'une saison complète de championnat, mais infiniment plus juste
   * que de déclarer deux équipes équivalentes.
   */
  /**
   * Nombre de matchs officiels en dessous duquel on accepte les amicaux.
   *
   * Quatre rencontres officielles suffisent à décrire une équipe. En dessous,
   * mieux vaut un amical qu'une moyenne calculée sur deux matchs.
   */
  const MATCHS_OFFICIELS_SUFFISANTS = 4;

  const statistiquesDepuisMatchs = (fixtures: any[], teamId: string) => {
    const termines = (fixtures || []).filter((f: any) =>
      ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short)
    );

    // ── LES MATCHS DE PRÉPARATION NE DISENT RIEN DE LA VRAIE FORCE ───────────
    //
    // Un amical d'été se joue avec des remplaçants, sans enjeu, contre ce qui
    // se présente. Les compter à égalité avec une finale européenne fausse tout.
    //
    // Cas mesuré : à la veille du Trophée des Champions, le moteur voyait Lens
    // à 2,00 buts marqués par match et le Paris Saint-Germain à 1,83 — donc
    // Lens devant. Les douze derniers matchs de Lens contenaient un 4-1 contre
    // Boulogne et un 3-0 contre Crystal Palace, tous deux amicaux ; ceux du PSG,
    // un 3-0 encaissé à Majorque avec une équipe remaniée.
    //
    // On les écarte donc — mais seulement s'il reste assez de matchs officiels.
    // En début de saison, un amical vaut mieux que rien.
    const officiels = termines.filter((f: any) => !estMatchDePreparation(f?.league));
    const joues = officiels.length >= MATCHS_OFFICIELS_SUFFISANTS ? officiels : termines;

    let marques = 0;
    let encaisses = 0;
    for (const f of joues) {
      const domicile = String(f?.teams?.home?.id) === String(teamId);
      const bh = Number(f?.goals?.home ?? 0);
      const ba = Number(f?.goals?.away ?? 0);
      marques += domicile ? bh : ba;
      encaisses += domicile ? ba : bh;
    }
    return { butsMarques: marques, butsEncaisses: encaisses, matchsJoues: joues.length };
  };

  const getRecentMatches = (fixtures: any[], teamId: string) => {
    const allMatches = (fixtures || []).filter((f: any) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
    allMatches.sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());
    return allMatches.slice(0, 5).map((f: any) => {
      const isHome = f.teams?.home?.id?.toString() === teamId;
      const gh = f.goals?.home ?? 0; const ga = f.goals?.away ?? 0;
      let res: "W" | "D" | "L" = "D";
      if (gh !== ga) res = (isHome && gh > ga) || (!isHome && ga > gh) ? "W" : "L";
      return { opponent: isHome ? f.teams?.away?.name : f.teams?.home?.name, score: `${gh}-${ga}`, result: res };
    });
  };
  // La forme se lit sur les derniers matchs RÉELLEMENT joués, toutes
  // compétitions et toutes saisons confondues. Repli sur les matchs de la
  // saison en cours si la requête sans saison n'a rien renvoyé.
  const recent1 = getRecentMatches(
    (t1Recent?.response?.length ? t1Recent.response : t1Fixtures?.response),
    id1
  );
  const recent2 = getRecentMatches(
    (t2Recent?.response?.length ? t2Recent.response : t2Fixtures?.response),
    id2
  );

  // Base Fallback Metrics (Just for basic display if Gemini fails completely)
  const s1r = t1Stats?.response || {};
  const s2r = t2Stats?.response || {};
  const baseAvgPossession1 = parseInt(s1r.ball_possession?.average || "50", 10);
  const baseAvgPossession2 = parseInt(s2r.ball_possession?.average || "50", 10);
  const baseGoalsFor1 = s1r.goals?.for?.total?.total || 0;
  const baseGoalsFor2 = s2r.goals?.for?.total?.total || 0;
  const baseGoalsAgainst1 = s1r.goals?.against?.total?.total || 0;
  const baseGoalsAgainst2 = s2r.goals?.against?.total?.total || 0;
  const played1 = s1r.fixtures?.played?.total || 1;
  const played2 = s2r.fixtures?.played?.total || 1;
  const winStreak1 = s1r.fixtures?.wins?.total || 0;
  const winStreak2 = s2r.fixtures?.wins?.total || 0;

  // ── PLUS AUCUNE ÉQUIPE SANS DONNÉES ────────────────────────────────────────
  //
  // Quand le championnat ne fournit rien, on reconstitue attaque et défense
  // depuis les derniers matchs réellement joués. Sans ce rattrapage, les deux
  // équipes étaient déclarées équivalentes et l'analyse tombait sur une
  // confiance plancher de 45 % — ce que l'administration affichait ligne après
  // ligne.
  // La reconstruction sur les dernières rencontres, toutes compétitions
  // confondues. Elle était calculée uniquement en dernier recours ; elle sert
  // désormais d'ancre permanente, ce qui empêche un unique match de championnat
  // de dicter toute la prédiction.
  const reference1 = statistiquesDepuisMatchs(
    (t1Recent?.response?.length ? t1Recent.response : t1Fixtures?.response) || [],
    String(id1)
  );
  const reference2 = statistiquesDepuisMatchs(
    (t2Recent?.response?.length ? t2Recent.response : t2Fixtures?.response) || [],
    String(id2)
  );

  const brutes1 = melangerStatistiques(
    {
      butsMarques: baseGoalsFor1,
      butsEncaisses: baseGoalsAgainst1,
      matchsJoues: s1r.fixtures?.played?.total ?? 0,
    },
    reference1
  );
  const brutes2 = melangerStatistiques(
    {
      butsMarques: baseGoalsFor2,
      butsEncaisses: baseGoalsAgainst2,
      matchsJoues: s2r.fixtures?.played?.total ?? 0,
    },
    reference2
  );

  /**
   * DERNIER RECOURS : LA SAISON PRÉCÉDENTE.
   *
   * PLUS JAMAIS DE SCORE SORTI DU VIDE.
   *
   * Sans la moindre statistique, le moteur ne se tait pas : il applique ses
   * valeurs par défaut et annonce 2-1 avec 44/27/29 — le même score pour toutes
   * les affiches du jour. C'est arrivé le 19 août 2026, en pleine reprise des
   * championnats : la saison 2026 venait de s'ouvrir, Barcelone y avait joué
   * zéro match, et le fournisseur répondait donc « 0 but en 0 rencontre » sans
   * la moindre erreur.
   *
   * Une équipe qui n'a pas encore joué cette saison a joué la précédente. Ces
   * chiffres-là existent, ils sont complets, et ils valent infiniment mieux
   * qu'un score inventé. On va donc les chercher plutôt que de rendre une
   * prédiction que rien ne fonde.
   *
   * Ce rattrapage ne coûte deux appels QUE dans le cas où tout le reste a
   * échoué — c'est-à-dire quelques jours par an, à la reprise.
   */
  if (brutes1.matchsJoues === 0 || brutes2.matchsJoues === 0) {
    console.warn(
      `[BACKEND_ANALYZE] Données introuvables — ${team1.name} ${brutes1.matchsJoues} matchs, ${team2.name} ${brutes2.matchsJoues}. Repli sur la saison ${season - 1}.`
    );

    const [ancien1, ancien2] = await Promise.all([
      brutes1.matchsJoues === 0 && id1
        ? fetchApiFootball(`/fixtures?team=${id1}&season=${season - 1}&last=15`, CACHE_TTL.TEAM_STATS, 8000)
        : Promise.resolve(null),
      brutes2.matchsJoues === 0 && id2
        ? fetchApiFootball(`/fixtures?team=${id2}&season=${season - 1}&last=15`, CACHE_TTL.TEAM_STATS, 8000)
        : Promise.resolve(null),
    ]);

    if (ancien1?.response?.length) {
      const r = statistiquesDepuisMatchs(ancien1.response, String(id1));
      if (r.matchsJoues > 0) {
        brutes1.butsMarques = r.butsMarques;
        brutes1.butsEncaisses = r.butsEncaisses;
        brutes1.matchsJoues = r.matchsJoues;
        console.log(`[BACKEND_ANALYZE] ${team1.name} rattrapé sur ${season - 1} : ${r.butsMarques}/${r.butsEncaisses} en ${r.matchsJoues}.`);
      }
    }
    if (ancien2?.response?.length) {
      const r = statistiquesDepuisMatchs(ancien2.response, String(id2));
      if (r.matchsJoues > 0) {
        brutes2.butsMarques = r.butsMarques;
        brutes2.butsEncaisses = r.butsEncaisses;
        brutes2.matchsJoues = r.matchsJoues;
        console.log(`[BACKEND_ANALYZE] ${team2.name} rattrapé sur ${season - 1} : ${r.butsMarques}/${r.butsEncaisses} en ${r.matchsJoues}.`);
      }
    }

    if (brutes1.matchsJoues === 0 || brutes2.matchsJoues === 0) {
      console.error(
        `[BACKEND_ANALYZE] Même la saison ${season - 1} est muette pour ${team1.name} — ${team2.name}. ` +
          `Le score annoncé ne reposera sur aucune mesure.`
      );
    }
  } else if ((s1r.fixtures?.played?.total ?? 0) === 0 || (s2r.fixtures?.played?.total ?? 0) === 0) {
    console.log(
      `[BACKEND_ANALYZE] Statistiques reconstituées depuis les derniers matchs : ` +
        `${team1.name} ${brutes1.butsMarques}/${brutes1.butsEncaisses} en ${brutes1.matchsJoues}, ` +
        `${team2.name} ${brutes2.butsMarques}/${brutes2.butsEncaisses} en ${brutes2.matchsJoues}.`
    );
  }

  // ── SCORE CALCULÉ ──────────────────────────────────────────────────────────
  //
  // Le score exact était demandé au modèle de langage. Constaté sur 228 analyses
  // réelles : 186 annonçaient 2-1, soit 82 %, y compris pour la même affiche
  // inversée. Un modèle de langage ne calcule pas un score, il répond le plus
  // banal du football.
  //
  // Il est donc calculé ici, à partir des buts marqués et encaissés des deux
  // équipes et de l'avantage du terrain. Le modèle garde la rédaction ; il ne
  // décide plus des chiffres.
  const lieuConnu = targetFutureMatch || targetPastMatch || nextH2H;
  const equipe1AJoueADomicile: boolean | null = lieuConnu
    ? String(lieuConnu.teams?.home?.id) === String(id1)
    : null;

  // ── SANS SAVOIR QUI REÇOIT, LA PRÉDICTION N'EST PAS FIABLE ─────────────────
  //
  // L'équipe qui reçoit gagne 15 % de rendement, celle qui se déplace en perd
  // 8 %. Sur deux équipes proches, cela suffit à INVERSER le favori.
  //
  // Quand l'appel au fournisseur échoue, la rencontre reste introuvable et le
  // code met les deux coefficients à 1 : l'analyse aboutit quand même, en
  // silence, avec un favori qui peut être l'inverse du bon. Le 16 août 2026,
  // Lens — PSG a été analysé 36 fois sans cette information et 4 fois avec :
  // les 4 ont vu juste, les 36 se sont trompées. Même match, même jour.
  //
  // On note donc explicitement ce manque, pour ne jamais figer une prédiction
  // bâtie dessus.
  const lieuInconnu = equipe1AJoueADomicile === null;
  if (lieuInconnu) {
    console.warn(
      `[BACKEND_ANALYZE] Rencontre introuvable pour ${team1.name} — ${team2.name} : ` +
        `l'avantage du terrain ne peut pas être appliqué, la prédiction ne sera pas figée.`
    );
  }

  // Les statistiques utilisées sont celles du championnat quand elles existent,
  // et celles reconstituées depuis les derniers matchs sinon.
  // Un match amical ne se predit pas comme un match de championnat : effectifs
  // remanies, enjeu nul. La confiance y est plafonnee.
  const nomCompetition =
    (targetFutureMatch || targetPastMatch || nextH2H)?.league?.name ?? team1.league ?? null;

  // ── LA FORCE RÉELLE DES DEUX ÉQUIPES ───────────────────────────────────────
  //
  // Jusqu'ici, le moteur jugeait une équipe sur ses buts marqués et encaissés,
  // sans jamais demander CONTRE QUI, ni ce qu'elle valait la saison passée. En
  // août, cela revenait à trancher sur deux rencontres.
  //
  // Mesuré en rejouant les cinq premières journées de dix championnats — 472
  // matchs, avec les seules données d'avant-match :
  //
  //     l'ancien calcul .............................. 46,0 % d'issues justes
  //     « l'équipe qui reçoit gagne » ................ 43,2 %
  //     avec les forces ajustées ..................... 52,8 %
  //
  // Sur le reste de la saison, quand les données abondent, le gain se réduit
  // (50,5 % → 50,9 % sur 2 761 matchs) : c'est bien le début de saison que
  // cette correction répare — c'est-à-dire la période en cours.
  //
  // Deux appels par championnat et par jour, mis en réserve : le coût ne dépend
  // pas du nombre d'abonnés. En cas d'échec, `forcesDuMatch` reste nul et
  // l'ancien chemin s'applique, inchangé.
  let forcesDuMatch: ForcesDuMatch | null = null;
  const ligueDuMatch = lieuConnu?.league;
  if (ligueDuMatch?.id && ligueDuMatch?.season && !lieuInconnu) {
    try {
      const forces = await lireForcesLigue(ligueDuMatch.id, ligueDuMatch.season);
      const f1 = forces?.equipes.get(Number(id1));
      const f2 = forces?.equipes.get(Number(id2));
      // Un promu n'a pas de saison passée dans ce championnat : sans socle pour
      // les DEUX équipes, on ne bascule pas. Mieux vaut l'ancien calcul qu'une
      // force inventée.
      if (forces?.fiable && f1 && f2) {
        forcesDuMatch = {
          equipe1: f1,
          equipe2: f2,
          butsDomicile: forces.butsDomicile,
          butsExterieur: forces.butsExterieur,
        };
        console.log(
          `[BACKEND_ANALYZE] Forces ajustées — ${team1.name} att ${f1.attaque.toFixed(2)}/déf ${f1.defense.toFixed(2)}, ` +
            `${team2.name} att ${f2.attaque.toFixed(2)}/déf ${f2.defense.toFixed(2)}.`
        );
      }
    } catch (e: any) {
      console.warn(`[BACKEND_ANALYZE] Forces indisponibles : ${e?.message}. Ancien calcul conservé.`);
    }
  }

  const scoreCalcule = calculerScoreProbable(
    brutes1,
    brutes2,
    equipe1AJoueADomicile,
    competitionPeuFiable(nomCompetition),
    // Le classement de fin de saison entre dans le calcul, et plus seulement
    // dans le texte envoyé au modèle. Sans lui, deux équipes aux moyennes de
    // buts voisines sont déclarées égales — même quand l'une a fini première
    // du championnat et l'autre quatorzième.
    { equipe1: classement1, equipe2: classement2 },
    // Quand elles sont disponibles, ces forces remplacent les moyennes brutes.
    // Nulles, tout ce qui précède s'applique comme avant.
    forcesDuMatch,
    // ── CE QUE LE MOTEUR A APPRIS DE SES PROPRES ERREURS ─────────────────
    //
    // Facteurs mesurés sur au moins trente rencontres passées de CE
    // championnat, en confrontant les buts annoncés aux buts marqués. Sous ce
    // seuil, `facteursPour` rend des facteurs neutres et le calcul est
    // rigoureusement celui d'avant.
    facteursPour(await lireCalibrages(), nomCompetition),
    // ── DEUX CHAMPIONNATS, DEUX ÉCHELLES ─────────────────────────────────
    //
    // N'agit que sur la confiance affichée. Le score annoncé, les
    // probabilités et l'issue retenue sortent identiques à ce qu'ils étaient
    // avant ce drapeau : trois correctifs du pronostic lui-même ont été
    // mesurés puis rejetés — voir `CONFIANCE_MAX_COMPARAISON_CROISEE`.
    comparaisonCroisee
  );

  // ── UNE RENCONTRE, UNE SEULE PRÉDICTION ────────────────────────────────────
  //
  // Le premier calcul complet fait foi. Tous les suivants le relisent, dans le
  // sens où l'utilisateur a saisi les équipes. Deux abonnés du même match ne
  // peuvent plus recevoir des réponses contraires selon l'heure à laquelle ils
  // cliquent, ni selon que le fournisseur répondait ou non à cet instant.
  //
  // Une prédiction bâtie sans savoir qui reçoit n'est jamais figée : elle ne
  // doit pas devenir la référence d'un match.
  const fixtureDeReference = targetFutureMatch ?? null;

  // ── LE PRONOSTIC SE RELIT AUSSI PENDANT LE MATCH ─────────────────────────
  //
  // `figeable` servait aux deux usages à la fois : lire ET écrire. Comme il
  // excluait les matchs en direct, le pronostic d'avant-match n'était jamais
  // RELU une fois le coup d'envoi donné — alors qu'il était bien en base.
  //
  // Constaté sur Espanyol — Real Madrid le 22 août 2026. Avant le match, le
  // pronostic figé annonçait 1-2 pour le Real. À la 74ᵉ, sur un 1-1, une
  // nouvelle analyse affichait « 1-1 » : le calcul du direct avait pris toute
  // la place. Deux personnes regardant le même match voyaient deux pronostics
  // contraires selon l'heure à laquelle elles avaient cliqué.
  //
  // Un pronostic n'est un pronostic que s'il ne bouge pas. Il est donc relu
  // dès qu'on sait de quelle rencontre il s'agit — y compris en plein match.
  //
  // L'ÉCRITURE, elle, reste interdite en direct : un « pronostic » calculé
  // après le coup d'envoi connaît déjà des buts, et n'en est plus un.
  const idRencontre = fixtureDeReference?.fixture?.id ?? matchDirect?.fixtureId ?? null;
  const lisible = !!idRencontre;
  const enregistrable = !lieuInconnu && !!fixtureDeReference?.fixture?.id && !matchDirect;

  if (lisible) {
    const deja = await lirePredictionFigee(idRencontre, id1);
    if (deja) {
      scoreCalcule.buts1 = deja.buts1;
      scoreCalcule.buts2 = deja.buts2;
      scoreCalcule.probaVictoire1 = deja.probaVictoire1;
      scoreCalcule.probaNul = deja.probaNul;
      scoreCalcule.probaVictoire2 = deja.probaVictoire2;
      scoreCalcule.confiance = deja.confiance;
      if (deja.butsAttendus1 !== null) scoreCalcule.butsAttendus1 = Number(deja.butsAttendus1);
      if (deja.butsAttendus2 !== null) scoreCalcule.butsAttendus2 = Number(deja.butsAttendus2);
    } else if (enregistrable) {
      // Enregistré dans le sens officiel : l'équipe qui reçoit en premier.
      const e1Domicile = equipe1AJoueADomicile === true;
      await figerPrediction({
        fixtureId: fixtureDeReference.fixture.id,
        domicileId: Number(e1Domicile ? id1 : id2),
        domicileNom: e1Domicile ? team1.name : team2.name,
        exterieurId: Number(e1Domicile ? id2 : id1),
        exterieurNom: e1Domicile ? team2.name : team1.name,
        butsDomicile: e1Domicile ? scoreCalcule.buts1 : scoreCalcule.buts2,
        butsExterieur: e1Domicile ? scoreCalcule.buts2 : scoreCalcule.buts1,
        probaDomicile: e1Domicile ? scoreCalcule.probaVictoire1 : scoreCalcule.probaVictoire2,
        probaNul: scoreCalcule.probaNul,
        probaExterieur: e1Domicile ? scoreCalcule.probaVictoire2 : scoreCalcule.probaVictoire1,
        confiance: scoreCalcule.confiance,
        xgDomicile: e1Domicile ? scoreCalcule.butsAttendus1 : scoreCalcule.butsAttendus2,
        xgExterieur: e1Domicile ? scoreCalcule.butsAttendus2 : scoreCalcule.butsAttendus1,
        calculeeLe: new Date().toISOString(),
      });
    }
  }

  /**
   * Impose les chiffres calculés à la réponse du modèle.
   *
   * Le modèle rédige, mais les nombres affichés sont ceux du calcul : sans quoi
   * le texte et le score pourraient se contredire, et le 2-1 reviendrait par la
   * fenêtre. Sert aussi bien quand le modèle répond que quand il échoue.
   */
  const imposerChiffresCalcules = (donnees: any) => {
    const raison =
      typeof donnees?.predictedScore?.reasoning === 'string' && donnees.predictedScore.reasoning.trim()
        ? donnees.predictedScore.reasoning
        : `Les buts attendus ressortent à ${scoreCalcule.butsAttendus1} contre ${scoreCalcule.butsAttendus2}, ce qui rend ce score le plus probable.`;

    donnees.predictedScore = {
      team1Goals: scoreCalcule.buts1,
      team2Goals: scoreCalcule.buts2,
      reasoning: raison,
    };
    donnees.winProb = scoreCalcule.probaVictoire1;
    donnees.drawProb = scoreCalcule.probaNul;
    donnees.loseProb = scoreCalcule.probaVictoire2;
    // Une analyse à 100 % et une autre à 8 % ont réellement été servies.
    donnees.confidence = scoreCalcule.donneesInsuffisantes
      ? scoreCalcule.confiance
      : bornerConfiance(scoreCalcule.confiance);

    donnees.predictions = {
      ...(donnees.predictions ?? {}),
      expectedGoals: {
        team1: scoreCalcule.butsAttendus1,
        team2: scoreCalcule.butsAttendus2,
        total: Math.round((scoreCalcule.butsAttendus1 + scoreCalcule.butsAttendus2) * 100) / 100,
      },
      btts: {
        yes: scoreCalcule.probaLesDeuxMarquent,
        no: 100 - scoreCalcule.probaLesDeuxMarquent,
      },
      overUnder: {
        over05: scoreCalcule.probaPlusDe.zeroCinq,
        over15: scoreCalcule.probaPlusDe.unCinq,
        over25: scoreCalcule.probaPlusDe.deuxCinq,
        over35: scoreCalcule.probaPlusDe.troisCinq,
      },
      // ── LA CAGE INVIOLÉE ────────────────────────────────────────────────
      //
      // Tirée de la grille déjà calculée, sans un appel de plus au
      // fournisseur. « Les deux marquent : non » regroupait 1-0, 0-1 et 0-0
      // sans jamais dire quelle défense tenait : cette mention le dit.
      cleanSheet: {
        team1: scoreCalcule.probaCageInviolee1,
        team2: scoreCalcule.probaCageInviolee2,
      },
    };

    // ── MATCH EN COURS ────────────────────────────────────────────────────────
    //
    // L'analyse d'avant-match est CONSERVÉE telle quelle : l'abonné doit
    // pouvoir confronter ce qui était annoncé à ce qui se passe réellement.
    // On lui ajoute l'état du match, et une projection de l'issue qui, elle,
    // tient compte du score déjà acquis et du temps restant — la prédiction
    // d'avant-match ne veut plus rien dire une fois le coup d'envoi donné.
    if (matchDirect) {
      donnees.live = matchDirect;
      donnees.isFinished = false;
      donnees.enDirect = true;
      // Le contexte affiché doit être celui du match qu'on regarde, pas d'une
      // rencontre à venir sans rapport.
      if (matchDirect.competition) donnees.competition = matchDirect.competition;
      if (matchDirect.stade) donnees.venue = matchDirect.stade;

      const projection = predireIssueFinale(
        scoreCalcule.butsAttendus1,
        scoreCalcule.butsAttendus2,
        matchDirect.buts1,
        matchDirect.buts2,
        // À la pause, la minute affichée est 45 mais aucune n'a été jouée
        // depuis : la traiter autrement ferait fondre le temps restant.
        matchDirect.minute ?? (matchDirect.miTemps ? 45 : 0),
        team1.name,
        team2.name
      );
      donnees.finalPrediction = projection;

      // ── LE PRONOSTIC NE BOUGE PLUS UNE FOIS LE MATCH COMMENCÉ ─────────────
      //
      // Cette portion remplaçait le pronostic par la projection du direct. Le
      // raisonnement de l'époque — 12 août 2026, le PSG menait 2-1 à la 90ᵉ et
      // l'écran affichait encore « 0-1 Aston Villa » — visait un vrai problème :
      // un pronostic seul, sans le score en cours, paraît absurde.
      //
      // Mais la solution était trop large. Elle a rendu le pronostic MOUVANT :
      // sur Espanyol — Real Madrid, 1-2 annoncé avant le coup d'envoi devenait
      // 1-1 à la 74ᵉ. Deux personnes, deux réponses contraires, pour le même
      // match. Un pronostic qui change n'est plus un pronostic.
      //
      // Le problème de départ est désormais réglé autrement, et mieux : le
      // score en direct s'affiche EN HAUT, en grand, impossible à manquer. Il
      // n'y a plus de risque qu'on prenne le pronostic pour l'état du match.
      //
      // Trois blocs distincts, qui ne se contredisent plus parce qu'ils ne
      // répondent pas à la même question :
      //
      //   • le SCORE EN DIRECT      — ce qui se passe maintenant ;
      //   • le PRONOSTIC            — ce qui avait été annoncé, immuable ;
      //   • « OÙ VA CE MATCH »      — la projection, recalculée sur le temps
      //                               restant, et étiquetée comme telle.
      //
      // `predictedScore`, `winProb`, `drawProb` et `loseProb` gardent donc les
      // valeurs d'avant-match, relues plus haut dans `predictions_match`.
      donnees.pronosticFige = {
        team1Goals: scoreCalcule.buts1,
        team2Goals: scoreCalcule.buts2,
        probaVictoire1: scoreCalcule.probaVictoire1,
        probaNul: scoreCalcule.probaNul,
        probaVictoire2: scoreCalcule.probaVictoire2,
      };
      // En cours de match, la confiance suit ce que dit le tableau d'affichage :
      // mener 2-1 a la 90e est un fait, pas une opinion. Elle reste toutefois
      // plafonnee a 95 % — un match n'est jamais joue avant le coup de sifflet
      // final, et afficher 100 % serait une promesse que personne ne peut tenir.
      // ── LA CONFIANCE ET LE RÉSUMÉ APPARTIENNENT AU PRONOSTIC ──────────────
      //
      // Ces deux lignes prenaient les valeurs de la projection. Elles n'ont
      // plus lieu d'être : la confiance qualifie le PRONOSTIC affiché juste
      // au-dessus, et celui-ci est désormais celui d'avant-match. Afficher
      // « 1-2 pour le Real » avec une confiance calculée sur un 1-1 en cours
      // reviendrait à noter une phrase avec la note d'une autre.
      //
      // La certitude de la projection n'est pas perdue : elle est dans ses
      // propres pourcentages, à l'intérieur du bloc « Où va ce match ».
      //
      // Le résumé garde de même le texte d'avant-match, qui va avec le
      // pronostic qu'il commente.
    }

    // Dernier filet avant l'envoi : le score et les probabilités doivent
    // raconter la même chose.
    verifierCoherence(donnees, `${team1.name} — ${team2.name}`);

    return donnees;
  };

  // UNE PASSERELLE SUFFIT.
  //
  // Ce contrôle exigeait une clé Gemini. Le jour où l'application passe par
  // OpenRouter et où la clé Google est retirée, il aurait refusé toutes les
  // analyses alors que la nouvelle passerelle fonctionnait — une panne totale
  // provoquée par un garde-fou devenu faux.
  const cleGemini = process.env.GEMINI_API_KEY;
  const geminiUtilisable = !!cleGemini && cleGemini !== 'fallback_key_for_safety';
  if (!openRouterDisponible() && !geminiUtilisable) {
    // Même raison qu'au-dessus : l'abonné ne doit pas perdre une analyse
    // parce qu'une clé manque sur le serveur.
    throw new Error(
      "Aucune passerelle IA configurée : ni OPENROUTER_API_KEY ni GEMINI_API_KEY."
    );
  }

  const debutAnalyse = Date.now();
  // Retenu hors du bloc pour rester lisible depuis la reprise sur echec :
  // sans cela, le journal ne sait pas QUEL modele a echoue.
  let modeleReellementAppele = '';

  /**
   * L'échec de CHAQUE modèle de la cascade, dans l'ordre où ils ont été
   * essayés.
   *
   * Seule la dernière erreur remontait auparavant. Sur cinq modèles, les quatre
   * premiers échouaient donc en silence — et le journal accusait toujours le
   * cinquième. Le 21 août, 91 % des échecs enregistrés portaient
   * « [OpenRouter 403] google/gemini-3.5-flash » : on a cherché une panne chez
   * Google, alors que ce message signifiait seulement que quatre modèles
   * avaient déjà renoncé avant lui, pour des raisons invisibles.
   *
   * Diagnostiquer une cascade par son dernier maillon, c'est chercher la panne
   * là où elle finit, jamais là où elle commence.
   */
  const echecsParModele: string[] = [];

  try {
    console.log(`[BACKEND_ANALYZE] Génération de la prédiction et de l'analyse experte...`);
    // Le modèle, la passerelle et le délai sont choisis plus bas, tentative par
    // tentative : un `AbortController` unique condamnait la deuxième tentative
    // avant qu'elle commence, puisqu'il continuait de courir entre les essais.

    // ── NE DEMANDER QUE CE QUI SERA RÉELLEMENT UTILISÉ ────────────────────────
    //
    // Deux gaspillages mesurés au compteur de jetons du fournisseur.
    //
    // 1. Les chiffres écrasés. Le modèle produisait le score, les probabilités,
    //    la confiance et les prédictions (buts attendus, BTTS, over/under) —
    //    que `imposerChiffresCalcules` remplace intégralement par le calcul de
    //    Poisson juste après. 13 % de chaque réponse était payé puis jeté. Seul
    //    le `reasoning` du score est conservé, donc seul lui reste demandé.
    //
    // 2. Le contenu jamais envoyé. Pour un compte sans abonnement, `toTeaser`
    //    retire côté serveur les sections, la comparaison, les métriques
    //    avancées, les points forts et le score prédit — soit environ 85 % de
    //    la réponse. On payait la rédaction de sept analyses détaillées que le
    //    visiteur ne recevait jamais. Les comptes gratuits représentent 88 %
    //    du trafic.
    //
    // L'aperçu affiché est INCHANGÉ : le résumé, le scénario et la confiance
    // sont exactement les mêmes. Le score, les probabilités et la confiance
    // étant calculés et non générés, l'historique et les preuves ne perdent
    // rien non plus.
    const estApercu = estApercuGlobal;

    const apiDataMissing = (baseGoalsFor1 === 0 && baseGoalsFor2 === 0 && played1 <= 1);

    // ── LA DATE À LAQUELLE ON JUGE LES ABSENCES ───────────────────────────
    //
    // Celle du match analysé, quand elle est connue. Le fournisseur rend
    // l'historique des blessures de TOUTE la saison ; sans cette référence, on
    // citerait comme absents des joueurs revenus depuis des mois. Absente, le
    // filtre se rabat sur l'instant présent.
    const dateDuMatchAnalyse: string | null =
      (targetFutureMatch || targetPastMatch || nextH2H)?.fixture?.date ?? null;
    const prompt = `Tu es le moteur de prédiction IA de ProFoot, un système ultra-avancé d'analyse de football.
TA MISSION : Analyser le match entre ${team1.name} et ${team2.name}, prendre en compte LA FORCE REELLE DES ÉQUIPES, évaluer les dynamiques et PREDIRE LE SCORE EXACT.

⚠️ RÈGLE ABSOLUE N°1 - INTERDIT : Il est FORMELLEMENT INTERDIT d'écrire des phrases du genre "absence de données récentes", "manque d'informations", "données insuffisantes" ou toute formulation similaire. TU ES UNE IA ENTRAÎNÉE SUR DES MILLIONS DE DONNÉES FOOTBALLISTIQUES. Tu connais ${team1.name} et ${team2.name} : leurs joueurs, leurs résultats récents, leur style de jeu. UTILISE CES CONNAISSANCES.
⚠️ RÈGLE ABSOLUE N°2 - DONNÉES VIDES : ${apiDataMissing ? `Les statistiques API pour ce match affichent 0 (ces équipes n'ont peut-être pas encore de matchs enregistrés dans la ligue cette saison, ou ce sont des équipes nationales). IGNORE CES ZÉROS. Dans ton JSON, retourne des valeurs RÉALISTES basées sur ta connaissance réelle de ces équipes (buts marqués, possession habituelle, forme réelle). Cite des résultats récents réels que tu connais.` : `Les données API sont disponibles, utilise-les.`}

DONNÉES REELLES FOURNIES :

[DONNÉES ${team1.name}]
- Niveau/Classement : ${stand1}
- Statistiques globales : ${baseGoalsFor1} buts marqués, ${baseGoalsAgainst1} encaissés en ${played1} matchs. Possession : ${baseAvgPossession1}%.
- Derniers résultats : ${JSON.stringify(recent1)}
- Blessures majeures : ${ligneAbsences(absencesRetenues(t1Injuries?.response, dateDuMatchAnalyse))}
- Meilleurs buteurs : ${scorers1.length > 0 ? scorers1.map((s:any) => `${s.name} (${s.goals})`).join(', ') : "Inconnu (utilise tes connaissances)"}
- Effectif complet : ${squad1.all.length > 0 ? squad1.all.slice(0, 20).join(', ') : "Inconnu (API injoignable, base-toi sur ta propre connaissance des titulaires et remplaçants actuels de " + team1.name + ")"}

[DONNÉES ${team2.name}]
- Niveau/Classement : ${stand2}
- Statistiques globales : ${baseGoalsFor2} buts marqués, ${baseGoalsAgainst2} encaissés en ${played2} matchs. Possession : ${baseAvgPossession2}%.
- Derniers résultats : ${JSON.stringify(recent2)}
- Blessures majeures : ${ligneAbsences(absencesRetenues(t2Injuries?.response, dateDuMatchAnalyse))}
- Meilleurs buteurs : ${scorers2.length > 0 ? scorers2.map((s:any) => `${s.name} (${s.goals})`).join(', ') : "Inconnu (utilise tes connaissances)"}
- Effectif complet : ${squad2.all.length > 0 ? squad2.all.slice(0, 20).join(', ') : "Inconnu (API injoignable, base-toi sur ta propre connaissance des titulaires et remplaçants actuels de " + team2.name + ")"}

[HISTORIQUE CONFRONTATIONS (H2H)]
${JSON.stringify(pastMatches.slice(0, 3).map((m:any)=>`${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`))}

[PROJECTION CHIFFRÉE DÉJÀ CALCULÉE — À NE PAS CONTREDIRE]
Le score et les probabilités de ce match ont été calculés à partir des buts marqués et encaissés des deux équipes et de l'avantage du terrain. Ils sont définitifs :
- Buts attendus : ${team1.name} ${scoreCalcule.butsAttendus1} — ${team2.name} ${scoreCalcule.butsAttendus2}
- Score le plus probable : ${scoreCalcule.buts1} - ${scoreCalcule.buts2}
- Victoire ${team1.name} ${scoreCalcule.probaVictoire1} %, nul ${scoreCalcule.probaNul} %, victoire ${team2.name} ${scoreCalcule.probaVictoire2} %
Ton texte doit être COHÉRENT avec ces chiffres. N'annonce jamais un autre score ni un autre vainqueur, et ne mentionne jamais qu'un calcul a été fait : tu expliques le match, pas la méthode.

TON ANALYSE ET TA DECISION (MODE EXPERT & COACH) :
1. Évalue la différence de niveau réel entre les équipes en t'appuyant sur TA PROPRE CONNAISSANCE.
2. Explique en une phrase POURQUOI le score ci-dessus tient debout au vu des forces en présence.
3. GÉNÉRATION DES TEXTES (TRÈS IMPORTANT) : Ton style de rédaction doit être fluide, percutant et facile à lire. Interdiction d'utiliser des phrases banales.
   - INTERDICTION ABSOLUE : Tu ne dois JAMAIS mentionner "API", "API Football", ou "données fournies". Tu es un expert humain, tu parles en ton nom. Ne dis JAMAIS "absence de données".
   - LANGAGE SIMPLE : N'utilise pas de mots trop compliqués. Fais des phrases claires, courtes et sans fautes de grammaire, compréhensibles par tout fan de foot.
   - EXPLICATION OBLIGATOIRE DES TERMES TECHNIQUES : À chaque fois que tu utilises un terme technique (xG, PPDA, xT, bloc médian, etc.), tu DOIS OBLIGATOIREMENT l'expliquer brièvement entre parenthèses avec des mots très simples pour le grand public.
   - STYLE ATTENDU : des phrases courtes et imagées, chaque terme technique expliqué entre parenthèses juste après, et les joueurs clés notés sur 10. Exemple de tournure, sans aucun nom réel : "Cette équipe a une attaque terrifiante. Son xG (qui mesure la qualité des occasions) montre qu'elle est très dangereuse, portée par un ailier étincelant (Note: 9/10). En face, on va souffrir face à un PPDA très bas (ce qui prouve un pressing très haut)..."
   - Cet exemple illustre une manière d'écrire, jamais un contenu : tous les noms, chiffres et notes que tu produis doivent venir des données de ce match, pas de cet exemple ni de ta mémoire.
${estApercu ? '' : `   - ÉVALUATION DES EFFECTIFS : Décortique les joueurs titulaires et les remplaçants fournis. Note les joueurs clés sur 10, explique leur rôle exact dans ce match précis, et révèle qui sera le facteur X capable de renverser la rencontre.`}

RETOURNE UNIQUEMENT UN JSON VALIDE AVEC LA STRUCTURE EXACTE SUIVANTE (aucun markdown) :
${estApercu ? `{
  "predictedScore": { "reasoning": "Phrase courte justifiant le score." },
  "quickSummary": "QUATRE À CINQ PHRASES, jamais moins. (1) Qui reçoit qui, dans quelle compétition. (2) L'état de forme réel de la première équipe, avec ses chiffres. (3) Celui de la seconde, avec les siens. (4) Le point sur lequel la rencontre va se jouer — le duel tactique, la faiblesse à exploiter, ce que chacun devra surveiller. Ton de journaliste sportif, français naturel, aucune liste. Une seule phrase est un travail bâclé : l'abonné a payé pour lire une analyse, pas une accroche.",
  "scenarios": [ { "title": "Scénario principal", "content": "Le déroulé le plus probable, en trois phrases." } ]
}` : `{
  "predictedScore": { "reasoning": "Phrase courte justifiant le score." },
  "quickSummary": "QUATRE À CINQ PHRASES, jamais moins. (1) Qui reçoit qui, dans quelle compétition. (2) L'état de forme réel de la première équipe, avec ses chiffres. (3) Celui de la seconde, avec les siens. (4) Le point sur lequel la rencontre va se jouer — le duel tactique, la faiblesse à exploiter, ce que chacun devra surveiller. Ton de journaliste sportif, français naturel, aucune liste. Une seule phrase est un travail bâclé : l'abonné a payé pour lire une analyse, pas une accroche.",
  "comparison": {
    "attack": { "team1": 0, "team2": 0 },
    "defense": { "team1": 0, "team2": 0 },
    "form": { "team1": 0, "team2": 0 },
    "h2h": { "team1": 50, "team2": 50 },
    "goals": { "team1": 0, "team2": 0 },
    "global": { "team1": 0, "team2": 0 }
  },
  "advancedMetrics": {
    "possession": { "team1": 50, "team2": 50 },
    "xG": { "team1": 0.0, "team2": 0.0 },
    "xT": { "team1": 0.0, "team2": 0.0 },
    "ppda": { "team1": 10, "team2": 10 }
  },
  "keyStrengths": { "team1": ["Force 1"], "team2": ["Force 1"] },
  "scenarios": [ { "title": "Scénario principal", "content": "..." } ],
  "sections": [
    { "title": "Dynamique & Forme Récente", "icon": "Activity", "content": "Analyse de la forme." },
    { "title": "Bataille Tactique (xG, PPDA, Blocs)", "icon": "Target", "content": "Analyse tactique pro (pressing, blocs, xT) avec explications des abréviations pour le lecteur." },
    { "title": "Effectifs & Évaluation des Joueurs", "icon": "Award", "content": "Analyse des joueurs de l'effectif. Qui est en forme ? Qui est sur le banc ? Évalue et note les joueurs clés." },
    { "title": "Absents & Blessés", "icon": "Shield", "content": "Impact des blessés." },
    { "title": "Historique des Confrontations", "icon": "History", "content": "Analyse du H2H." },
    { "title": "Contexte & Enjeux du Match", "icon": "Trophy", "content": "Importance du match." },
    { "title": "Justification du Score Final", "icon": "Brain", "content": "Pourquoi ce score final, en combinant les joueurs clés et la tactique." }
  ]
}`}`;

    // Chaque modèle a son propre quota journalier ET sa propre charge : si le
    // premier est épuisé, saturé ou trop lent, le suivant prend le relais.
    // Mieux vaut une analyse rédigée par un modèle plus léger qu'un texte de
    // secours identique pour tous les matchs.
    //
    // Le délai est géré tentative par tentative par `avecBasculeDeModele` : un
    // compteur unique partagé condamnait la deuxième tentative avant même
    // qu'elle commence. Le budget est calculé sur le temps réellement restant
    // avant la limite de la plateforme, moins une réserve pour la mise en forme

    const budgetModele = reprise
      ? // Reprise : les données sont en réserve, la collecte a été quasi
        // instantanée. Vingt-cinq secondes suffisent largement au modèle, et
        // c'est ce qui ramène l'attente totale de deux minutes trente à une
        // minute quinze dans le pire cas.
        Math.max(
          12000,
          Math.min(
            25000,
            LIMITE_PLATEFORME_MS - (Date.now() - debutRequete) - RESERVE_MISE_EN_FORME_MS
          )
        )
      : Math.max(
          12000,
          LIMITE_PLATEFORME_MS - (Date.now() - debutRequete) - RESERVE_MISE_EN_FORME_MS
        );

    if (reprise)
      console.log(
        `[BACKEND_ANALYZE] Reprise ${reprise} pour ${team1.name} — ${team2.name} : ` +
          `budget ${budgetModele} ms, cascade décalée de ${reprise} modèle(s).`
      );

    // Un compte non abonné ne voit que 15 % du résultat, le reste étant flouté.
    // Lui servir le modèle le plus cher revient à payer le prix fort pour du
    // contenu masqué : l'aperçu est produit par le modèle économique. Son
    // CONTENU est identique — seul le coût change.
    const result = await genererAnalyseJSON(prompt, {
      budgetMs: budgetModele,
      economique: estApercu,
      // Le modele qui vient de fauter est ecarte : rien ne dit qu il ferait
      // mieux trente secondes plus tard.
      decalage: reprise,
      // Chaque maillon de la cascade rend compte de lui-même. Voir
      // `echecsParModele` plus haut : sans cela, on ne voit que le dernier.
      surEchec: (modele, erreur, dureeMs, expire) => {
        const cause = expire
          ? `délai dépassé (${dureeMs} ms)`
          : `${erreur?.status ? `HTTP ${erreur.status} — ` : ''}${String(erreur?.message ?? erreur).slice(0, 120)}`;
        echecsParModele.push(`${modele} : ${cause}`);
        console.warn(`[BACKEND_ANALYZE] ${team1.name} — ${team2.name} | ${modele} a échoué | ${cause}`);
      },
    });

    modeleReellementAppele = result.modele;
    console.log(
      `[BACKEND_ANALYZE] Réponse obtenue via ${result.passerelle} — modèle ${result.modele} en ${Date.now() - debutAnalyse} ms.`
    );

    let responseText = result.texte;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }
    const parsedData = JSON.parse(responseText);

    // ── UN RÉSUMÉ D'UNE LIGNE N'EST PAS UN RÉSUMÉ ─────────────────────────
    //
    // Constaté sur un compte PRO ELITE le 21 août : « Napoli s'appuie sur un
    // pressing haut et une attaque efficace pour arracher la victoire 1-0
    // contre un Genoa fragile en défense. » Une phrase. C'est tout ce que
    // recevait quelqu'un qui venait de payer — moins que le visiteur gratuit,
    // qui en lisait quatre.
    //
    // Le modèle n'y était pour rien : on lui demandait « un résumé captivant »,
    // sans aucune exigence de longueur. Il a répondu exactement à la question
    // posée.
    //
    // La consigne est maintenant explicite, et ce filet garantit le résultat :
    // si la réponse reste trop courte, on sert le texte composé à partir des
    // chiffres réels — celui que le propriétaire a validé. Mieux vaut un texte
    // mécanique complet qu'une ligne bâclée à quelqu'un qui a payé.
    const RESUME_MINIMUM = 200;
    if (String(parsedData?.quickSummary ?? '').trim().length < RESUME_MINIMUM) {
      console.warn(
        `[BACKEND_ANALYZE] Résumé trop court (${String(parsedData?.quickSummary ?? '').length} caractères) ` +
          `pour ${team1.name} — ${team2.name}. Texte composé servi à la place.`
      );
      parsedData.quickSummary = composerApercuVendeur(
        team1.name,
        team2.name,
        { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1,
          cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1,
          winStreak: winStreak1, played: played1, name: team1.name },
        { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2,
          cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2,
          winStreak: winStreak2, played: played2, name: team2.name },
        {
          competition: (targetFutureMatch || nextH2H)?.league?.name ?? null,
          stade: (targetFutureMatch || nextH2H)?.fixture?.venue?.name ?? null,
        }
      );
    }

    // Les chiffres affichés sont ceux du calcul, jamais ceux que le modèle a pu
    // réécrire au passage. C'est ce qui garantit qu'on ne reverra pas 82 % de
    // 2-1, et que le texte ne peut pas contredire le score annoncé.
    imposerChiffresCalcules(parsedData);

    // Informations réelles du match (compétition, coup d'envoi, stade, ville).
    // Sans elles, l'en-tête affichait ses valeurs de repli — « Match
    // International » et « Bientôt » — au lieu du contexte réel de la rencontre.
    const fixtureSource = targetFutureMatch || nextH2H;
    if (fixtureSource) {
      const f = fixtureSource.fixture;
      const kickoff = new Date(f.date);
      parsedData.competition = fixtureSource.league?.name || parsedData.competition;
      parsedData.date = kickoff.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      parsedData.time = kickoff.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      parsedData.venue = f.venue?.name || null;
      parsedData.venueCity = f.venue?.city || null;
    }

    // Merge API basic data to keep the interface working
    parsedData.isFinished = false;
    parsedData.globalForm = {
      team1: { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1, cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1, winStreak: winStreak1, played: played1, name: team1.name },
      team2: { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2, cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2, winStreak: winStreak2, played: played2, name: team2.name }
    };

    console.log(`[BACKEND_ANALYZE] Gemini analysis & prediction completed successfully.`);
    setBounded(analysisCache, cacheKey, { data: parsedData, timestamp: Date.now() });
    
    return await respond(parsedData);

  } catch (e: any) {
    console.error("[BACKEND_ANALYZE] Gemini failed:", e.message);

    // ── REPRISE SUR ÉCHEC ────────────────────────────────────────────────────
    //
    // L'abonné ne doit rien voir. Il reçoit une analyse complète et exploitable
    // — le score et les probabilités sont ceux du calcul, exactement comme
    // lorsque le modèle répond. Seuls les textes sont plus sobres.
    //
    // Ce qui change, c'est que l'échec ne disparaît plus dans le silence : il
    // est enregistré pour l'administration. Auparavant, près d'une analyse sur
    // cinq servait un score écrit en dur et une phrase creuse sans que personne
    // ne le sache.
    enregistrerEchecAnalyse({
      userId: guard.user.id,
      equipe1: team1.name,
      equipe2: team2.name,
      competition: (targetFutureMatch || nextH2H)?.league?.name ?? null,
      // La chaîne COMPLÈTE, pas seulement son dernier maillon.
      message: echecsParModele.length
        ? `${String(e?.message ?? e)} | cascade : ${echecsParModele.join(' || ')}`
        : String(e?.message ?? e),
      // ── LE MODÈLE RÉELLEMENT APPELÉ, PAS UNE CONSTANTE ──────────────────
      //
      // Cette ligne écrivait `MODELES_GEMINI[0]` en dur. Tous les échecs
      // étaient donc attribués à « gemini-3.5-flash », y compris ceux d'un
      // modèle OpenRouter — et l'on cherchait la panne du mauvais côté. Un
      // journal qui ment coûte plus cher qu'un journal absent.
      modele: modeleReellementAppele || 'inconnu',
      dureeMs: Date.now() - debutAnalyse,
      serviQuandMeme: true,
      // Le pays vient de l en-tete pose par la plateforme, jamais du client :
      // une valeur envoyee par le navigateur se falsifie en trois secondes.
      // Une panne ne frappe pas partout pareil -- un fournisseur peut etre lent
      // depuis l Afrique de l Ouest et parfait depuis l Europe.
      pays: req.headers.get("x-vercel-ip-country") ?? null,
    });

    const t1Goals = scoreCalcule.buts1;
    const t2Goals = scoreCalcule.buts2;
    const vainqueur =
      t1Goals > t2Goals ? team1.name : t2Goals > t1Goals ? team2.name : null;

    // ── L'ABONNÉ NE REÇOIT JAMAIS MOINS QUE LE VISITEUR GRATUIT ────────────
    //
    // Constaté en ligne le 21 août sur un compte PRO ELITE : le « Résumé
    // rapide » était une phrase sèche — « Les buts attendus penchent vers Real
    // Betis : 1.92 contre 1.11 » — et le scénario une formule où l'adversaire
    // n'était même pas nommé. Sur une autre affiche, les deux blocs étaient
    // carrément absents. Pendant ce temps, un visiteur gratuit lisait un vrai
    // texte sur les deux équipes.
    //
    // Celui qui paie voyait donc moins bien que celui qui ne paie pas. Le repli
    // emploie désormais EXACTEMENT le même rédacteur que l'avant-goût gratuit :
    // il est composé mécaniquement, donc instantané et sans coût — on n'ajoute
    // pas un appel au modèle à une requête qui vient déjà d'échouer sur le
    // temps.
    //
    // L'abonné garde évidemment tout le reste : score, probabilités, buts
    // attendus, métriques. Ce repli ne touche qu'aux DEUX TEXTES qui manquaient.
    // Les mêmes chiffres que ceux servis plus bas dans `globalForm` : forme
    // récente, buts de la saison, matchs joués. Rien de plus n'est nécessaire.
    const formeRepli1 = {
      recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1,
      cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1,
      winStreak: winStreak1, played: played1, name: team1.name,
    };
    const formeRepli2 = {
      recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2,
      cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2,
      winStreak: winStreak2, played: played2, name: team2.name,
    };

    const fallbackData = imposerChiffresCalcules({
      isFinished: false,
      quickSummary: composerApercuVendeur(team1.name, team2.name, formeRepli1, formeRepli2, {
        competition: (targetFutureMatch || nextH2H)?.league?.name ?? null,
        stade: (targetFutureMatch || nextH2H)?.fixture?.venue?.name ?? null,
      }),
      comparison: {
        attack: { team1: 60, team2: 50 }, defense: { team1: 60, team2: 50 },
        form: { team1: 60, team2: 50 }, h2h: { team1: 50, team2: 50 },
        goals: { team1: 60, team2: 50 }, global: { team1: 60, team2: 50 }
      },
      predictions: {
        expectedGoals: { team1: t1Goals + 0.5, team2: t2Goals + 0.2, total: t1Goals + t2Goals + 0.7 },
        btts: { yes: 60, no: 40 },
        overUnder: { over05: 90, over15: 75, over25: 50, over35: 30 }
      },
      advancedMetrics: {
        possession: { team1: baseAvgPossession1, team2: baseAvgPossession2 },
        // Les buts attendus viennent du calcul : les afficher decales du score
        // arrondi revenait a inventer une metrique qui a l air savante.
        xG: { team1: scoreCalcule.butsAttendus1, team2: scoreCalcule.butsAttendus2 },
        xT: { team1: scoreCalcule.butsAttendus1, team2: scoreCalcule.butsAttendus2 },
        ppda: { team1: 10, team2: 10 }
      },
      keyStrengths: { team1: ["Performance offensive régulière"], team2: ["Solidité défensive"] },
      // Le même scénario que l'avant-goût gratuit : les intentions des DEUX
      // équipes, chacune nommée. L'ancienne formule laissait « l'adversaire »
      // anonyme et servait la même phrase à tous les matchs.
      scenarios: [
        {
          title: 'Scénario Tactique',
          content: scenarioGabarit(team1.name, team2.name, formeRepli1, formeRepli2),
        },
      ],
      sections: [
        { title: "Dynamique & Forme Récente", icon: "Activity", content: `Les statistiques récentes indiquent que ${team1.name} a enregistré ${baseGoalsFor1} buts marqués, tandis que ${team2.name} totalise ${baseGoalsFor2} buts. Une dynamique qui reflète l'état de forme des deux équipes.` },
        { title: "Bataille Offensive & Défensive", icon: "Target", content: `L'équilibre des forces montre une légère domination attendue de ${t1Goals > t2Goals ? team1.name : team2.name}, avec une projection de possession de ${t1Goals > t2Goals ? baseAvgPossession1 || 55 : baseAvgPossession2 || 55}%. La défense adverse devra se montrer particulièrement vigilante.` },
        { title: "Effectifs & Joueurs Clés", icon: "Award", content: "Les internationaux des deux équipes devront faire preuve de créativité. Les qualités individuelles au milieu de terrain pourraient être le véritable facteur X de la rencontre." },
        { title: "Contexte & Enjeux du Match", icon: "Trophy", content: "Chaque équipe cherchera à imposer son rythme dès le début du match pour asseoir sa domination et prendre une option sur la victoire." }
      ],
      globalForm: {
        team1: { recentMatches: recent1, goalsScored: baseGoalsFor1, goalsConceded: baseGoalsAgainst1, cleanSheets: s1r.clean_sheet?.total || 0, avgPossession: baseAvgPossession1, winStreak: winStreak1, played: played1, name: team1.name },
        team2: { recentMatches: recent2, goalsScored: baseGoalsFor2, goalsConceded: baseGoalsAgainst2, cleanSheets: s2r.clean_sheet?.total || 0, avgPossession: baseAvgPossession2, winStreak: winStreak2, played: played2, name: team2.name }
      }
    });

    setBounded(analysisCache, cacheKey, { data: fallbackData, timestamp: Date.now() });
    return await respond(fallbackData);
  }
}
