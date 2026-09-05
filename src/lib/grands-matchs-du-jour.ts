/**
 * LES GRANDS MATCHS DU JOUR, PRÊTS À ÊTRE ANALYSÉS EN UN GESTE.
 *
 * ── POURQUOI CETTE LISTE EXISTE ───────────────────────────────────────────
 *
 * Pour lancer une analyse, il fallait connaître deux équipes et les chercher
 * l'une après l'autre. Quelqu'un qui ouvre l'application sans idée précise
 * n'avait rien à quoi se raccrocher : un formulaire vide, et deux champs à
 * remplir.
 *
 * Les grands matchs du jour donnent ce point de départ. Un geste, et l'analyse
 * part — exactement la même que si les deux équipes avaient été choisies à la
 * main.
 *
 * ── UN SEUL APPEL PAR JOUR, PARTAGÉ PAR TOUT LE MONDE ─────────────────────
 *
 * Le quota du fournisseur de données est la ressource la plus rare du projet :
 * il a frôlé les 100 % le 16 août 2026, et au-delà, plus aucune analyse ne
 * fonctionne pour personne. Un appel par visiteur sur la page la plus
 * consultée du site l'épuiserait en une matinée.
 *
 * La liste est donc rangée dans la réserve partagée — la même table que les
 * classements et les fiches de club — sous une clé qui porte la date. Le
 * premier visiteur de la journée paie l'appel ; tous les autres lisent ce
 * qu'il a rapporté.
 *
 * ── LES CINQ CHAMPIONNATS, ET PAS LES AUTRES ──────────────────────────────
 *
 * Angleterre, Espagne, France, Allemagne, Italie. Un samedi ordinaire compte
 * plusieurs centaines de rencontres dans le monde ; un carrousel de trois
 * cents cartes ne se parcourt pas sur un téléphone. Ce sont aussi les clubs
 * que nos utilisateurs nomment quand ils cherchent une équipe.
 *
 * ── CE QUI EST FILTRÉ, ET QUAND ───────────────────────────────────────────
 *
 * La réserve garde la journée entière ; le tri par heure, lui, se fait à
 * CHAQUE lecture. Sans quoi, à 22 h, le carrousel proposerait encore des
 * rencontres jouées l'après-midi — analyser un match déjà terminé n'apprend
 * rien à personne.
 *
 * Quinze minutes de battement : une rencontre qui vient de commencer reste
 * proposée, parce que l'analyse d'avant-match garde tout son sens pendant la
 * première période.
 */

import { getTodayFixtures, getUpcomingFixtures, LEAGUE_IDS } from './api-football';
import { lireReserve, ecrireReserve } from './api-football';
import { getLiveTeams } from './teams-live';

/** Angleterre, Espagne, Italie, Allemagne, France. */
export const GRANDS_CHAMPIONNATS: number[] = [
  LEAGUE_IDS.epl,
  LEAGUE_IDS.laliga,
  LEAGUE_IDS.seriea,
  LEAGUE_IDS.bundesliga,
  LEAGUE_IDS.ligue1,
];

/** Combien de cartes au maximum : au-delà, le carrousel ne se parcourt plus. */
const MAX_CARTES = 15;

/** Une rencontre commencée depuis moins de ça reste proposée. */
const BATTEMENT_MS = 15 * 60 * 1000;

/**
 * Une équipe, dans la forme EXACTE que le sélecteur manuel produit.
 *
 * C'est ce qui garantit que taper une carte revient à choisir deux équipes à
 * la main : l'écran d'analyse reçoit le même objet, l'inscrit au référentiel
 * local par le même chemin, et appelle le serveur avec le même identifiant.
 */
export interface EquipeDuJour {
  /** Le slug, celui que `findLiveTeam` sait retrouver côté serveur. */
  id: string;
  name: string;
  logo: string;
  country: string;
  league: string;
  stadium: string;
}

export interface MatchDuJour {
  id: string;
  /** L'instant du coup d'envoi. Mis à l'heure du lecteur par le navigateur. */
  kickoffISO: string;
  championnat: string;
  dom: EquipeDuJour;
  ext: EquipeDuJour;
  /**
   * ── CE QUE L'APPLICATION A RÉUSSI SUR CE TYPE DE RENCONTRE ─────────────
   *
   * Mesuré le 5 septembre 2026 sur les quatre matchs proposés ce jour-là :
   * AS Roma - Atalanta à 62 %, Le Havre - Brest à 44 %. Dix-huit points
   * d'écart, et le client tapait au hasard entre les deux.
   *
   * C'est ce qui distingue les abonnés qui restent de ceux qui partent : les
   * vingt-neuf comptes sous 30 % de réussite ne lancent pas plus d'analyses
   * que les autres, ils les lancent sur d'autres matchs. Le carrousel est le
   * chemin le plus emprunté ; il ne disait rien.
   *
   * `null` quand la rencontre n'a jamais été analysée — on ne devine pas.
   */
  fiabilite: number | null;
}

export interface ListeMatchs {
  matchs: MatchDuJour[];
  /** Faux quand aucun grand match ne se joue aujourd'hui et qu'on montre la suite. */
  aujourdhui: boolean;
}

/** Jusqu'à minuit — la liste du jour n'a plus de sens le lendemain. */
function dureeJusquAMinuit(): number {
  const maintenant = new Date();
  const minuit = new Date(maintenant);
  minuit.setUTCHours(24, 0, 0, 0);
  // Un plancher d'une demi-heure : à 23 h 58, une réserve de deux minutes
  // ferait rappeler le fournisseur pour rien.
  return Math.max(30 * 60 * 1000, minuit.getTime() - maintenant.getTime());
}

function jourCourant(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Transforme les rencontres brutes du fournisseur en cartes affichables.
 *
 * Une rencontre dont l'une des deux équipes est inconnue du référentiel est
 * ÉCARTÉE. Elle s'afficherait, mais l'analyse échouerait au moment du clic :
 * mieux vaut une carte de moins qu'une carte qui déçoit.
 */
async function enCartes(brutes: any[]): Promise<MatchDuJour[]> {
  const equipes = await getLiveTeams().catch(() => []);
  const parApiId = new Map(equipes.map((e) => [e.apiId, e]));

  const cartes: MatchDuJour[] = [];
  for (const f of brutes) {
    const ligue = Number(f?.league?.id);
    if (!GRANDS_CHAMPIONNATS.includes(ligue)) continue;

    const dom = parApiId.get(Number(f?.teams?.home?.id));
    const ext = parApiId.get(Number(f?.teams?.away?.id));
    if (!dom || !ext) continue;

    const kickoff = String(f?.fixture?.date ?? '');
    if (!kickoff) continue;

    cartes.push({
      id: `md-${f?.fixture?.id}`,
      kickoffISO: kickoff,
      championnat: String(f?.league?.name ?? ''),
      // Renseignée juste après, en une seule lecture pour toutes les cartes.
      fiabilite: null,
      dom: {
        id: dom.id,
        name: dom.name,
        logo: dom.logo || String(f?.teams?.home?.logo ?? ''),
        country: dom.country,
        league: dom.league,
        stadium: dom.stadium,
      },
      ext: {
        id: ext.id,
        name: ext.name,
        logo: ext.logo || String(f?.teams?.away?.logo ?? ''),
        country: ext.country,
        league: ext.league,
        stadium: ext.stadium,
      },
    });
  }

  cartes.sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  return cartes;
}

/**
 * Pose sur chaque carte ce que l'application a réussi sur les rencontres du
 * même profil.
 *
 * Une seule lecture des calculs et du relevé pour toute la liste : la page
 * d'analyse est la plus visitée du site, et une requête par carte s'y paierait
 * quinze fois.
 *
 * Ne lève jamais. Sans fiabilité, les cartes restent exactement ce qu'elles
 * étaient — le carrousel n'a jamais dépendu de ce chiffre pour fonctionner.
 */
async function poserLaFiabilite(cartes: MatchDuJour[]): Promise<MatchDuJour[]> {
  if (!cartes.length) return cartes;
  try {
    const [{ createAdminClient }, { lireReleve, fiabilitePour }] = await Promise.all([
      import('./supabase-admin'),
      import('./fiabilite-apprise'),
    ]);
    const releve = await lireReleve();
    if (!releve) return cartes;

    const sb = createAdminClient();
    const parId = new Map<number, any>();
    for (let de = 0; de < 50_000; de += 1000) {
      const { data, error } = await sb
        .from('predictions_match')
        .select('fixture_id, proba_domicile, proba_nul, proba_exterieur, calculee_le')
        .range(de, de + 999);
      if (error) break;
      for (const p of data ?? []) {
        const id = Number(p.fixture_id);
        const connu = parId.get(id);
        if (!connu || String(p.calculee_le) > String(connu.calculee_le)) parId.set(id, p);
      }
      if (!data || data.length < 1000) break;
    }

    return cartes.map((c) => {
      const p = parId.get(Number(String(c.id).replace('md-', '')));
      if (!p || p.proba_domicile == null) return c;
      const f = fiabilitePour(
        releve,
        Number(p.proba_domicile),
        Number(p.proba_nul),
        Number(p.proba_exterieur),
        c.championnat
      );
      return f ? { ...c, fiabilite: f.taux } : c;
    });
  } catch {
    return cartes;
  }
}

/**
 * Ne garde que ce qui n'a pas encore été joué, et met devant les rencontres
 * que l'application comprend le mieux.
 *
 * L'ordre était chronologique. C'était défendable — « les prochains matchs » —
 * mais le carrousel ne montre que ses premières cartes, et il les montrait
 * sans rapport avec ce qu'elles valent. Un client tombait sur une rencontre à
 * 44 % quand une à 62 % attendait derrière.
 *
 * Les rencontres jamais analysées, sans fiabilité connue, passent en dernier :
 * on ne les cache pas, on ne les met simplement pas en tête.
 */
function aVenir(cartes: MatchDuJour[]): MatchDuJour[] {
  const seuil = Date.now() - BATTEMENT_MS;
  return cartes
    .filter((c) => new Date(c.kickoffISO).getTime() >= seuil)
    .sort(
      (a, b) =>
        (b.fiabilite ?? -1) - (a.fiabilite ?? -1) ||
        a.kickoffISO.localeCompare(b.kickoffISO)
    )
    .slice(0, MAX_CARTES);
}

/**
 * Les grands matchs à proposer, aujourd'hui de préférence.
 *
 * Ne lève jamais : cette liste est un confort. Une panne du fournisseur doit
 * rendre une liste vide, jamais casser la page d'analyse — qui reste
 * parfaitement utilisable avec ses deux sélecteurs.
 */
export async function matchsDuJour(): Promise<ListeMatchs> {
  const jour = jourCourant();

  try {
    // ── AUJOURD'HUI ────────────────────────────────────────────────────────
    const cleJour = `matchs-du-jour:v1:${jour}`;
    let cartes: MatchDuJour[] | null = null;

    const enReserve = await lireReserve<MatchDuJour[]>(cleJour).catch(() => null);
    if (enReserve?.contenu && !enReserve.expiree) {
      cartes = enReserve.contenu;
    } else {
      // Un SEUL appel : le fournisseur rend toutes les rencontres du jour,
      // tous championnats confondus, et le tri se fait ici. Interroger les
      // cinq championnats séparément coûterait cinq fois plus cher pour le
      // même résultat.
      const brutes = await getTodayFixtures();
      cartes = await enCartes(brutes ?? []);
      await ecrireReserve(cleJour, cartes, dureeJusquAMinuit()).catch(() => {});
    }

    const restants = aVenir(await poserLaFiabilite(cartes ?? []));
    if (restants.length > 0) return { matchs: restants, aujourdhui: true };

    // ── SINON, LES PROCHAINS ───────────────────────────────────────────────
    //
    // Une trêve internationale, un lundi de janvier, ou simplement 23 h passées
    // et tout est joué. Une section vide n'apprendrait rien : on montre la
    // suite du calendrier.
    const cleSuite = `prochains-grands-matchs:v1:${jour}`;
    let suite: MatchDuJour[] | null = null;

    const suiteEnReserve = await lireReserve<MatchDuJour[]>(cleSuite).catch(() => null);
    if (suiteEnReserve?.contenu && !suiteEnReserve.expiree) {
      suite = suiteEnReserve.contenu;
    } else {
      suite = await enCartes((await getUpcomingFixtures(7)) ?? []);
      await ecrireReserve(cleSuite, suite, dureeJusquAMinuit()).catch(() => {});
    }

    return { matchs: aVenir(suite ?? []), aujourdhui: false };
  } catch (e: any) {
    console.warn('[MATCHS DU JOUR] Liste indisponible :', e?.message);
    return { matchs: [], aujourdhui: true };
  }
}
