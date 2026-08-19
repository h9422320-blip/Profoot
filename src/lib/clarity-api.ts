/**
 * Les chiffres de Microsoft Clarity, ramenés dans l'administration.
 *
 * CE QUE CETTE API DONNE, ET CE QU'ELLE NE DONNE PAS
 *
 * Elle rend des totaux agrégés sur les UN À TROIS DERNIERS JOURS : nombre de
 * sessions, pays, navigateurs, appareils. C'est exactement ce qu'il faut pour
 * répondre à « combien de Marocains ont ouvert le site hier, et sur quoi ».
 *
 * Elle ne dit PAS qui est connecté à l'instant présent. Clarity agrège avec du
 * retard ; pour le temps réel, l'application interroge sa propre base, qui sait
 * exactement qui vient de lancer une analyse.
 *
 * DIX REQUÊTES PAR JOUR, ET PAS UNE DE PLUS
 *
 * Microsoft plafonne à dix appels quotidiens par projet, tous confondus.
 * Ouvrir la page d'administration douze fois dans la journée suffirait donc à
 * la faire taire jusqu'au lendemain. Le résultat est conservé trois heures :
 * huit appels par jour au maximum, quel que soit le nombre de consultations.
 *
 * Renvoie `null` plutôt qu'une erreur : l'administration doit s'afficher même
 * quand Clarity ne répond pas.
 */

import { lireReserve, ecrireReserve } from '@/lib/api-football';

const ENDPOINT = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';

/** Trois heures : huit appels par jour au pire, sous le plafond de dix. */
const TTL = 3 * 60 * 60 * 1000;
const CLE = 'clarity:apercu';

export interface LigneClarity {
  valeur: string;
  sessions: number;
}

export interface ApercuClarity {
  /** Sessions au total sur la période. */
  sessions: number;
  /** Pages vues. */
  pagesVues: number;
  /** Sessions par pays, de la plus fréquente à la plus rare. */
  pays: LigneClarity[];
  navigateurs: LigneClarity[];
  appareils: LigneClarity[];
  /** Nombre de jours couverts (1 à 3). */
  jours: number;
  /** Quand ces chiffres ont été relevés. */
  releveLe: string;
  /** Vrai quand la réponse vient de la réserve et non d'un appel neuf. */
  enReserve: boolean;
}

export const clarityConfigure = () => !!process.env.CLARITY_API_TOKEN;

/** Additionne les sessions d'une dimension renvoyée par Clarity. */
function agreger(blocs: any[], nomDimension: string): LigneClarity[] {
  const bloc = blocs.find((b) => String(b?.metricName ?? '').toLowerCase() === 'traffic');
  const lignes: LigneClarity[] = [];
  const total = new Map<string, number>();

  for (const info of bloc?.information ?? []) {
    const valeur = info?.[nomDimension];
    if (valeur == null) continue;
    const sessions = Number(info?.sessionsCount ?? info?.sessionsWithMetricPercentage ?? 0);
    if (!Number.isFinite(sessions)) continue;
    total.set(String(valeur), (total.get(String(valeur)) ?? 0) + sessions);
  }

  for (const [valeur, sessions] of total) lignes.push({ valeur, sessions });
  return lignes.sort((a, b) => b.sessions - a.sessions);
}

async function interroger(dimension: string, jours: number): Promise<any[] | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('numOfDays', String(jours));
  if (dimension) url.searchParams.set('dimension1', dimension);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CLARITY_API_TOKEN}` },
    // Jamais de cache réseau : on gère nous-mêmes la réserve, et un cache
    // silencieux fausserait le décompte des dix appels quotidiens.
    cache: 'no-store',
  });

  if (res.status === 429) {
    console.warn('[CLARITY] Plafond de dix appels par jour atteint.');
    return null;
  }
  if (!res.ok) {
    console.warn(`[CLARITY] Réponse ${res.status} : ${(await res.text().catch(() => '')).slice(0, 160)}`);
    return null;
  }
  return res.json().catch(() => null);
}

/**
 * L'aperçu Clarity, mis en réserve.
 *
 * Trois appels seulement — pays, navigateur, appareil — et jamais plus d'une
 * fois toutes les trois heures.
 */
export async function lireApercuClarity(jours: 1 | 2 | 3 = 3): Promise<ApercuClarity | null> {
  if (!clarityConfigure()) return null;

  try {
    const enBase = await lireReserve<ApercuClarity>(CLE);
    if (enBase && !enBase.expiree && enBase.contenu) {
      return { ...enBase.contenu, enReserve: true };
    }

    const [parPays, parNavigateur, parAppareil] = await Promise.all([
      interroger('Country', jours),
      interroger('Browser', jours),
      interroger('Device', jours),
    ]);

    if (!parPays && !parNavigateur && !parAppareil) {
      // Plafond atteint ou service muet : on ressert la dernière valeur connue,
      // même périmée. Un chiffre d'hier vaut mieux qu'un écran vide.
      const perime = await lireReserve<ApercuClarity>(CLE);
      return perime?.contenu ? { ...perime.contenu, enReserve: true } : null;
    }

    const pays = parPays ? agreger(parPays, 'Country') : [];
    const sessions = pays.reduce((a, l) => a + l.sessions, 0);

    const blocTrafic = (parPays ?? []).find(
      (b: any) => String(b?.metricName ?? '').toLowerCase() === 'traffic'
    );
    const pagesVues = (blocTrafic?.information ?? []).reduce(
      (a: number, i: any) => a + Number(i?.pagesViews ?? 0),
      0
    );

    const apercu: ApercuClarity = {
      sessions,
      pagesVues: Number.isFinite(pagesVues) ? pagesVues : 0,
      pays,
      navigateurs: parNavigateur ? agreger(parNavigateur, 'Browser') : [],
      appareils: parAppareil ? agreger(parAppareil, 'Device') : [],
      jours,
      releveLe: new Date().toISOString(),
      enReserve: false,
    };

    void ecrireReserve(CLE, apercu, TTL);
    return apercu;
  } catch (e: any) {
    console.warn('[CLARITY] Lecture impossible :', e?.message);
    return null;
  }
}
