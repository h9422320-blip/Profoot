/**
 * CALCULER LES GRANDS MATCHS À VENIR AVANT QU'ON LES DEMANDE.
 *
 * ── LE VERROU QUE CE FICHIER FAIT SAUTER ──────────────────────────────────
 *
 * La sélection « les matchs les mieux cernés » ne peut classer qu'une
 * rencontre dont les probabilités existent — donc une rencontre déjà analysée
 * par quelqu'un. Mesuré le 5 septembre 2026 sur le programme du lendemain :
 *
 *     88 rencontres dans un grand championnat
 *     38 avaient un calcul  →  50 invisibles pour la sélection
 *
 * Elle proposait donc trois ou quatre matchs par jour, choisis parmi ce que
 * les clients avaient ouvert la veille, et non parmi ce qui se joue vraiment.
 * Un abonné qui dispose de vingt analyses par mois ne peut pas se contenter de
 * trois propositions.
 *
 * ── CE QUE ÇA COÛTE, ET POURQUOI C'EST SUPPORTABLE ────────────────────────
 *
 * Le quota du fournisseur est la ressource la plus rare du projet : il a
 * frôlé les 100 % le 16 août 2026, et au-delà plus aucune analyse ne
 * fonctionne pour personne. Relevé le 5 septembre : 27 801 requêtes sur
 * 150 000, soit 122 000 disponibles.
 *
 * Un pronostic coûte deux appels — les statistiques de chaque équipe. Le
 * classement et les forces de la ligue sont partagés par toutes les
 * rencontres du même championnat, donc lus une seule fois. Cinquante matchs
 * manquants reviennent à une centaine d'appels, sur cent vingt-deux mille.
 *
 * Le plafond `MAX_PAR_PASSAGE` reste là pour le jour où quelque chose
 * déraille : mieux vaut couvrir la moitié du programme que vider le quota.
 *
 * ── CE QUI N'EST JAMAIS RECALCULÉ ─────────────────────────────────────────
 *
 * Une rencontre qui a déjà un pronostic. Il est FIGÉ, et c'est tout le sujet :
 * un abonné qui rouvre son analyse doit y retrouver ce qu'il a lu. Ce fichier
 * ne fait qu'ajouter ce qui manque.
 */

import { createAdminClient } from './supabase-admin';
import { calculerScoreProbable, competitionPeuFiable } from './score-probable';
import { lireForcesLigue } from './forces-equipes';
import { figerPrediction } from './prediction-figee';

/**
 * Les championnats que la sélection a vocation à couvrir.
 *
 * Ce sont ceux que les abonnés ouvrent, et ceux pour lesquels le fournisseur
 * rend des statistiques complètes. Y ajouter les championnats obscurs
 * coûterait du quota pour des rencontres que la fiabilité mesurée écarterait
 * de toute façon.
 */
const CHAMPIONNATS = [
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Primeira Liga',
  'Eredivisie',
  'Jupiler Pro League',
  'Championship',
  'Serie B',
  '2. Bundesliga',
  'Ligue 2',
  'Süper Lig',
  'Super Lig',
  'Liga Portugal',
  'Premiership',
  'Super League',
  'Super League 1',
  'Ekstraklasa',
  'Allsvenskan',
  'Eliteserien',
  'Czech Liga',
  'Liga I',
  'HNL',
];

/** Au-delà, on s'arrête : le quota vaut plus qu'une sélection complète. */
const MAX_PAR_PASSAGE = 60;

/** Combien de journées à venir on prépare. */
const JOURS_A_PREPARER = 2;

/** Les statuts d'une rencontre pas encore jouée. */
const A_VENIR = ['NS', 'TBD'];

export interface BilanPrecalcul {
  examinees: number;
  calculees: number;
  dejaConnues: number;
  echecs: number;
  details: string[];
}

async function api(chemin: string): Promise<any[]> {
  const cle = process.env.API_FOOTBALL_KEY;
  if (!cle) return [];
  try {
    const r = await fetch(`https://v3.football.api-sports.io/${chemin}`, {
      headers: { 'x-apisports-key': cle },
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.response ?? [];
  } catch {
    return [];
  }
}

/**
 * Prépare les rencontres à venir des grands championnats.
 *
 * Ne lève JAMAIS : cette préparation est un confort. Son échec doit laisser
 * l'application exactement dans l'état où elle était — la sélection se
 * contentera des rencontres déjà connues, comme avant.
 */
export async function precalculerGrandsMatchs(): Promise<BilanPrecalcul> {
  const bilan: BilanPrecalcul = {
    examinees: 0,
    calculees: 0,
    dejaConnues: 0,
    echecs: 0,
    details: [],
  };

  try {
    const sb = createAdminClient();

    // Tous les identifiants déjà calculés, en une lecture paginée : Supabase
    // rend mille lignes et s'arrête sans le dire.
    const connus = new Set<number>();
    for (let de = 0; de < 50_000; de += 1000) {
      const { data, error } = await sb
        .from('predictions_match')
        .select('fixture_id')
        .range(de, de + 999);
      if (error) break;
      for (const p of data ?? []) connus.add(Number(p.fixture_id));
      if (!data || data.length < 1000) break;
    }

    // ── LES RÉSERVES PARTAGÉES ────────────────────────────────────────────
    //
    // Le classement et les forces valent pour TOUTES les rencontres d'un même
    // championnat. Les relire par match multiplierait le coût par vingt.
    const statsCache = new Map<string, any>();
    const classementCache = new Map<string, any[]>();
    const forcesCache = new Map<string, any>();

    const stats = async (ligue: number, saison: number, equipe: number) => {
      const cle = `${ligue}:${saison}:${equipe}`;
      if (!statsCache.has(cle)) {
        const r = await api(`teams/statistics?league=${ligue}&season=${saison}&team=${equipe}`);
        statsCache.set(cle, Array.isArray(r) ? r[0] : r);
      }
      return statsCache.get(cle);
    };

    const classement = async (ligue: number, saison: number) => {
      const cle = `${ligue}:${saison}`;
      if (!classementCache.has(cle)) {
        const r = await api(`standings?league=${ligue}&season=${saison}`);
        classementCache.set(cle, r?.[0]?.league?.standings?.[0] ?? []);
      }
      return classementCache.get(cle) ?? [];
    };

    const forces = async (ligue: number, saison: number) => {
      const cle = `${ligue}:${saison}`;
      if (!forcesCache.has(cle)) {
        forcesCache.set(cle, await lireForcesLigue(ligue, saison).catch(() => null));
      }
      return forcesCache.get(cle);
    };

    // ── LES RENCONTRES À PRÉPARER ─────────────────────────────────────────
    const aPreparer: any[] = [];
    for (let d = 0; d < JOURS_A_PREPARER; d++) {
      const jour = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
      for (const f of await api(`fixtures?date=${jour}`)) {
        if (!A_VENIR.includes(String(f?.fixture?.status?.short))) continue;
        if (!CHAMPIONNATS.includes(String(f?.league?.name ?? ''))) continue;
        bilan.examinees++;
        if (connus.has(Number(f?.fixture?.id))) {
          bilan.dejaConnues++;
          continue;
        }
        aPreparer.push(f);
      }
    }

    // Les rencontres les plus proches d'abord : ce sont celles qu'on ouvrira
    // en premier, et le plafond peut tomber avant la fin de la liste.
    aPreparer.sort((a, b) =>
      String(a?.fixture?.date ?? '').localeCompare(String(b?.fixture?.date ?? ''))
    );

    for (const f of aPreparer.slice(0, MAX_PAR_PASSAGE)) {
      const ligue = Number(f?.league?.id);
      const saison = Number(f?.league?.season);
      const domId = Number(f?.teams?.home?.id);
      const extId = Number(f?.teams?.away?.id);
      if (!ligue || !saison || !domId || !extId) {
        bilan.echecs++;
        continue;
      }

      try {
        const [sDom, sExt, table, fl] = await Promise.all([
          stats(ligue, saison, domId),
          stats(ligue, saison, extId),
          classement(ligue, saison),
          forces(ligue, saison),
        ]);

        const brut = (s: any) => ({
          butsMarques: Number(s?.goals?.for?.total?.total ?? 0),
          butsEncaisses: Number(s?.goals?.against?.total?.total ?? 0),
          matchsJoues: Number(s?.fixtures?.played?.total ?? 0),
        });

        // Une équipe qui n'a joué aucun match ne donne rien d'exploitable :
        // le calcul sortirait des probabilités inventées, et la sélection les
        // servirait comme les autres.
        if (brut(sDom).matchsJoues < 1 || brut(sExt).matchsJoues < 1) {
          bilan.echecs++;
          continue;
        }

        // ── LE CLASSEMENT SE TRANSMET AVEC SA RÉFÉRENCE ────────────────
        //
        // `forceDepuisClassement` divise les points de l'équipe par la moyenne
        // du championnat. Sans `pointsMoyens`, elle rend 1 — c'est-à-dire
        // qu'elle ignore purement et simplement le classement, sans que rien
        // ne le signale. C'est ce que faisait le script de réparation, qui
        // transmettait `{ rang, points, total }` : trois champs, dont aucun
        // n'était celui attendu.
        const lignes = table as any[];
        const totalPoints = lignes.reduce((s2, x) => s2 + (Number(x?.points) || 0), 0);
        const rang = (id: number) => {
          const r = lignes.find((x: any) => x?.team?.id === id);
          if (!r || !lignes.length) return null;
          return {
            points: Number(r.points) || 0,
            pointsMoyens: totalPoints / lignes.length,
          };
        };

        const fDom = fl?.equipes?.get(domId);
        const fExt = fl?.equipes?.get(extId);
        const forcesDuMatch =
          fl?.fiable && fDom && fExt
            ? { equipe1: fDom, equipe2: fExt, butsDomicile: fl.butsDomicile, butsExterieur: fl.butsExterieur }
            : null;

        const r = calculerScoreProbable(
          brut(sDom),
          brut(sExt),
          // L'équipe 1 est celle qui reçoit : c'est l'orientation de la table,
          // et s'en écarter inverserait tous les pronostics enregistrés.
          true,
          competitionPeuFiable(f?.league?.name ?? null),
          { equipe1: rang(domId), equipe2: rang(extId) },
          forcesDuMatch
        );

        await figerPrediction({
          fixtureId: Number(f.fixture.id),
          domicileId: domId,
          domicileNom: String(f?.teams?.home?.name ?? ''),
          exterieurId: extId,
          exterieurNom: String(f?.teams?.away?.name ?? ''),
          butsDomicile: r.buts1,
          butsExterieur: r.buts2,
          probaDomicile: r.probaVictoire1,
          probaNul: r.probaNul,
          probaExterieur: r.probaVictoire2,
          confiance: r.confiance,
          xgDomicile: r.butsAttendus1,
          xgExterieur: r.butsAttendus2,
          calculeeLe: new Date().toISOString(),
        });
        bilan.calculees++;
      } catch (e: any) {
        bilan.echecs++;
        bilan.details.push(`${f?.teams?.home?.name} : ${e?.message}`);
      }
    }

    if (aPreparer.length > MAX_PAR_PASSAGE) {
      bilan.details.push(
        `${aPreparer.length - MAX_PAR_PASSAGE} rencontre(s) laissée(s) au prochain passage (plafond).`
      );
    }
  } catch (e: any) {
    bilan.details.push(`interrompu : ${e?.message}`);
  }

  return bilan;
}
