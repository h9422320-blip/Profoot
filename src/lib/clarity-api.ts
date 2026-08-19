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
  /**
   * Ce qui a empêché la lecture, quand il y a lieu.
   *
   * Affiché tel quel dans l'administration : un panneau muet oblige à ouvrir
   * les journaux du serveur pour comprendre, ce qui n'est pas à la portée de
   * celui qui regarde son tableau de bord.
   */
  probleme?: string;
  /**
   * Aperçu brut de la réponse, quand aucune ligne n'a pu être lue.
   *
   * Le format exact de Clarity n'a jamais été observé ici — il est décrit dans
   * leur documentation, pas vérifié sur pièce. Si la lecture échoue, ces
   * quelques centaines de caractères permettent de corriger sans deviner.
   */
  brut?: string;
}

export const clarityConfigure = () => !!process.env.CLARITY_API_TOKEN;

/**
 * Additionne les sessions d'une dimension renvoyée par Clarity.
 *
 * LECTURE VOLONTAIREMENT TOLÉRANTE
 *
 * Le format exact n'a pas été observé sur pièce : il vient de la documentation.
 * Plutôt que d'exiger un nom de champ précis — et de tout perdre s'il diffère
 * d'une lettre — on cherche la première clé plausible parmi celles que Clarity
 * emploie. Une intégration qui casse sur un nom de champ n'apprend rien à
 * personne.
 */
function agreger(blocs: any[], nomDimension: string): LigneClarity[] {
  const total = new Map<string, number>();

  // Tous les blocs sont parcourus, pas seulement « Traffic » : selon la
  // dimension demandée, Clarity range les sessions sous des métriques
  // différentes.
  for (const bloc of Array.isArray(blocs) ? blocs : []) {
    for (const info of bloc?.information ?? []) {
      if (!info || typeof info !== 'object') continue;

      // La valeur de la dimension : sous son nom exact, ou sous la première
      // clé non numérique qu'on trouve.
      const valeur =
        info[nomDimension] ??
        info[nomDimension.toLowerCase()] ??
        Object.entries(info).find(
          ([cle, v]) => typeof v === 'string' && !/count|percent|session|page/i.test(cle)
        )?.[1];
      if (valeur == null) continue;

      // ── LE NOMBRE DE SESSIONS, QUEL QUE SOIT SON NOM ──────────────────────
      //
      // Premier essai en production : les pays et les navigateurs remontaient
      // correctement, mais TOUS À ZÉRO. Le champ existe, il ne s'appelle
      // simplement pas comme prévu.
      //
      // Plutôt que de deviner une fois de plus, on prend la première valeur
      // numérique dont le nom parle de sessions — et à défaut, n'importe quel
      // nombre du bloc. Clarity peut renommer ses champs, la lecture tiendra.
      let sessions = 0;
      for (const [cle, v] of Object.entries(info)) {
        if (!/session/i.test(cle)) continue;
        const n = Number(v);
        if (Number.isFinite(n) && n > sessions) sessions = n;
      }
      if (sessions === 0) {
        for (const [cle, v] of Object.entries(info)) {
          if (/percent|rate|ratio/i.test(cle)) continue;
          const n = Number(v);
          if (Number.isFinite(n) && n > sessions) sessions = n;
        }
      }
      if (sessions <= 0) continue;
      total.set(String(valeur), (total.get(String(valeur)) ?? 0) + sessions);
    }
  }

  return [...total]
    .map(([valeur, sessions]) => ({ valeur, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

interface Reponse {
  blocs: any[] | null;
  probleme?: string;
  brut?: string;
}

async function interroger(dimension: string, jours: number): Promise<Reponse> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('numOfDays', String(jours));
  if (dimension) url.searchParams.set('dimension1', dimension);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CLARITY_API_TOKEN}` },
    // Jamais de cache réseau : on gère nous-mêmes la réserve, et un cache
    // silencieux fausserait le décompte des dix appels quotidiens.
    cache: 'no-store',
  });

  const texte = await res.text().catch(() => '');

  if (res.status === 429) {
    return { blocs: null, probleme: "Plafond de dix appels par jour atteint. Réessayez demain." };
  }
  if (res.status === 401 || res.status === 403) {
    return { blocs: null, probleme: `Jeton refusé (${res.status}). Vérifiez CLARITY_API_TOKEN dans Vercel.` };
  }
  if (!res.ok) {
    return { blocs: null, probleme: `Clarity a répondu ${res.status}.`, brut: texte.slice(0, 300) };
  }

  try {
    const donnees = JSON.parse(texte);
    return { blocs: Array.isArray(donnees) ? donnees : [donnees], brut: texte.slice(0, 400) };
  } catch {
    return { blocs: null, probleme: 'Réponse illisible de Clarity.', brut: texte.slice(0, 300) };
  }
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

    const probleme = parPays.probleme ?? parNavigateur.probleme ?? parAppareil.probleme;

    if (!parPays.blocs && !parNavigateur.blocs && !parAppareil.blocs) {
      // Plafond atteint ou service muet : on ressert la dernière valeur connue,
      // même périmée. Un chiffre d'hier vaut mieux qu'un écran vide.
      const perime = await lireReserve<ApercuClarity>(CLE);
      if (perime?.contenu) return { ...perime.contenu, enReserve: true, probleme };
      return {
        sessions: 0, pagesVues: 0, pays: [], navigateurs: [], appareils: [],
        jours, releveLe: new Date().toISOString(), enReserve: false,
        probleme: probleme ?? 'Clarity n’a rien renvoyé.',
        brut: parPays.brut,
      };
    }

    const pays = agreger(parPays.blocs ?? [], 'Country');
    const sessions = pays.reduce((a, l) => a + l.sessions, 0);

    const pagesVues = (parPays.blocs ?? []).reduce(
      (total: number, bloc: any) =>
        total +
        (bloc?.information ?? []).reduce(
          (a: number, i: any) => a + Number(i?.pagesViews ?? i?.pageViews ?? 0),
          0
        ),
      0
    );

    const apercu: ApercuClarity = {
      sessions,
      pagesVues: Number.isFinite(pagesVues) ? pagesVues : 0,
      pays,
      navigateurs: agreger(parNavigateur.blocs ?? [], 'Browser'),
      appareils: agreger(parAppareil.blocs ?? [], 'Device'),
      jours,
      releveLe: new Date().toISOString(),
      enReserve: false,
      // Rien n'a pu être lu alors que la réponse était valide : le format a
      // changé. On garde un extrait pour corriger sans avoir à deviner.
      ...(sessions === 0 ? { brut: parPays.brut, probleme } : probleme ? { probleme } : {}),
    };

    void ecrireReserve(CLE, apercu, TTL);
    return apercu;
  } catch (e: any) {
    console.warn('[CLARITY] Lecture impossible :', e?.message);
    return null;
  }
}
