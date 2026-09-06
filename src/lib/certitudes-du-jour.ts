/**
 * LES CERTITUDES DU JOUR.
 *
 * ── POURQUOI CETTE LISTE EXISTE ──────────────────────────────────────────
 *
 * Le 6 septembre 2026, des abonnés payants se plaignaient que l'application
 * « ne fonctionne pas ». Le reproche est fondé sur un malentendu que
 * l'application entretenait : elle mettait en avant « qui va gagner », qui
 * plafonne à 82,7 % de réussite — trois issues possibles, c'est le mur du
 * domaine, et aucun bookmaker au monde ne fait mieux.
 *
 * Or la même grille de scores permet d'affirmer d'autres choses, à DEUX
 * réponses celles-là, qui tiennent 92 à 98 %. Mesuré sur 1 544 rencontres
 * hors échantillon, stable dans les deux moitiés du contrôle :
 *
 *     « tel club marque », annoncé à 90 % ...... tenu 98,5 % (67 fois)
 *     « tel club marque », annoncé à 85 % ...... tenu 94,1 % (269)
 *     « tel club ne perd pas », à 85 % ......... tenu 92,8 % (111)
 *     « la rencontre ne finit pas 0-0 » ........ tenu 93,5 % (1 544)
 *
 * Elles étaient déjà visibles À L'INTÉRIEUR d'une analyse. Mais il fallait
 * ouvrir un match pour les découvrir, et donc savoir lequel ouvrir. Cette
 * liste les sort au grand jour : l'abonné voit, dès l'écran d'analyse, ce que
 * l'application affirme aujourd'hui et à quel point elle en est sûre.
 *
 * ── D'OÙ VIENT LA MATIÈRE, ET CE QU'ELLE NE COÛTE PAS ────────────────────
 *
 * De `predictions_match`, les pronostics déjà figés — qui portent les buts
 * attendus de chaque rencontre. Aucun appel au fournisseur, aucun calcul de
 * moteur : la grille de Poisson se reconstruit à partir de deux nombres.
 *
 * Ce qui est affiché ici décrit donc EXACTEMENT ce que l'analyse dira, et ne
 * peut pas diverger d'elle.
 */

import { ecrireReserve } from './api-football';
import { createAdminClient } from './supabase-admin';
import { fixturesDuJour } from './selection-du-jour';

const CLE = 'certitudes:du-jour-v2';

/** Trente minutes : la liste doit suivre les coups d'envoi de la journée. */
const TTL = 30 * 60 * 1000;

/**
 * Le seuil d'affichage.
 *
 * Mesuré le 6 septembre 2026 sur 1 544 rencontres hors échantillon : annoncées
 * à 85 %, « telle équipe ne perd pas » se réalise 92,8 % du temps et « telle
 * équipe marque » 94,1 %. C'est donc la barre à partir de laquelle on a le
 * droit d'écrire « presque certain ».
 *
 * En dessous, on ne l'a plus : un abonné qui lit ce mot sur une affirmation
 * tenue deux fois sur trois se sent trompé, et il a raison.
 */
export const SEUIL = 85;

/** Au-delà, la liste devient un mur de texte que personne ne lit. */
export const MAXIMUM = 8;

export interface Certitude {
  fixtureId: number;
  /** « Arsenal — Chelsea » */
  affiche: string;
  championnat: string;
  kickoffISO: string;
  /** « Arsenal marque au moins un but » */
  texte: string;
  probabilite: number;
  /** Rang de ce que l affirmation apprend : 0 dit le plus, 3 le moins. */
  valeur: number;
}

export interface CertitudesDuJour {
  liste: Certitude[];
  /** Faux quand la liste porte sur demain, faute de rencontres aujourd'hui. */
  aujourdhui: boolean;
  calculeeLe: string;
}

const VIDE: CertitudesDuJour = { liste: [], aujourdhui: true, calculeeLe: new Date().toISOString() };

const factorielle = (k: number): number => {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
};
const poisson = (lambda: number, k: number) =>
  (Math.exp(-lambda) * Math.pow(lambda, k)) / factorielle(k);

/**
 * Les affirmations tenables pour une rencontre, à partir de ses buts attendus.
 *
 * La grille est reconstruite exactement comme dans le moteur — même loi, mêmes
 * bornes — pour que cette liste et l'analyse ne puissent pas se contredire.
 */
export function certitudesPour(
  xgDomicile: number,
  xgExterieur: number,
  nomDomicile: string,
  nomExterieur: string
): { texte: string; probabilite: number; valeur: number }[] {
  if (!(xgDomicile > 0) || !(xgExterieur > 0)) return [];

  const p1: number[] = [];
  const p2: number[] = [];
  for (let k = 0; k <= 10; k++) {
    p1.push(poisson(xgDomicile, k));
    p2.push(poisson(xgExterieur, k));
  }

  let marqueD = 0, marqueE = 0, nePerdPasD = 0, nePerdPasE = 0, zeroZero = 0, cinqEtPlus = 0;
  let masse = 0;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = p1[i] * p2[j];
      masse += p;
      if (i >= 1) marqueD += p;
      if (j >= 1) marqueE += p;
      if (i >= j) nePerdPasD += p;
      if (j >= i) nePerdPasE += p;
      if (i === 0 && j === 0) zeroZero += p;
      if (i + j >= 5) cinqEtPlus += p;
    }
  }
  if (!(masse > 0)) return [];
  const pct = (v: number) => Math.round((v / masse) * 100);

  const sortie: { texte: string; probabilite: number; valeur: number }[] = [];
  const marque = marqueD >= marqueE
    ? { nom: nomDomicile, v: marqueD }
    : { nom: nomExterieur, v: marqueE };
  const tient = nePerdPasD >= nePerdPasE
    ? { nom: nomDomicile, v: nePerdPasD }
    : { nom: nomExterieur, v: nePerdPasE };

  /**
   * ── UNE CERTITUDE VAUT PAR CE QU'ELLE DIT, PAS PAR SON POURCENTAGE ─────
   *
   * Premier essai, classé par probabilité seule : les huit certitudes du jour
   * étaient sept fois « la rencontre ne finit pas 0-0 » à 99 %. C'est vrai —
   * et parfaitement inutile. Un match ne finit pas 0-0 dans quatre-vingt-treize
   * pour cent des cas QUOI QU'IL ARRIVE : l'affirmation ne distingue pas cette
   * rencontre des autres, elle décrit le football en général.
   *
   * L'abonné qui paie veut savoir quelque chose sur SON match. « Arsenal ne
   * perd pas » à 91 % en dit infiniment plus que « il y aura un but » à 99 %.
   *
   * Le rang ci-dessous porte donc d'abord sur ce que l'affirmation apprend :
   *
   *   0 — « telle équipe ne perd pas » : elle parle de l'ISSUE, c'est le plus
   *       proche de ce que le client cherche, et c'est la plus difficile.
   *   1 — « telle équipe marque » : elle nomme une équipe, elle dit quelque
   *       chose de ce match-là.
   *   2 et 3 — les deux affirmations générales, gardées seulement quand il n'y
   *       a rien de mieux à dire sur cette rencontre.
   */
  sortie.push({ texte: `${tient.nom} ne perd pas`, probabilite: pct(tient.v), valeur: 0 });
  sortie.push({ texte: `${marque.nom} marque au moins un but`, probabilite: pct(marque.v), valeur: 1 });

  /**
   * ── UN SEUIL PAR AFFIRMATION, ET NON UN SEUIL UNIQUE ──────────────────
   *
   * Premier essai avec un seuil commun à 88 % : aucune rencontre du jour ne
   * l'atteignait sur les affirmations UTILES, et la liste s'est remplie de
   * huit « la rencontre ne finit pas 0-0 » à 99 %.
   *
   * L'erreur était de traiter des affirmations de difficulté très différente
   * avec la même barre. La mesure du 6 septembre 2026 donne, pour chacune, le
   * seuil à partir duquel elle tient plus de neuf fois sur dix :
   *
   *     « ne perd pas », annoncé à 85 % ...... tenu 92,8 % (111 rencontres)
   *     « marque »,      annoncé à 85 % ...... tenu 94,1 % (269 rencontres)
   *
   * Les deux affirmations générales — « pas de 0-0 », « moins de cinq buts » —
   * ne figurent PLUS dans cette liste. Elles restent justes, mais elles sont
   * vraies de presque toutes les rencontres : elles ne distinguent pas celle
   * qu'on propose, et l'abonné qui paie n'apprend rien en les lisant. Elles
   * gardent leur place à l'intérieur de l'analyse, où elles complètent un
   * tableau au lieu d'en tenir lieu.
   */
  return sortie
    .filter((c) => c.probabilite >= SEUIL)
    .sort((a, b) => a.valeur - b.valeur || b.probabilite - a.probabilite);
}

async function pronosticsAvecButsAttendus(): Promise<Map<number, { d: number; e: number }>> {
  const sb = createAdminClient();
  const sortie = new Map<number, { d: number; e: number; quand: string }>();
  for (let de = 0; de < 50_000; de += 1000) {
    const { data, error } = await sb
      .from('predictions_match')
      .select('fixture_id, xg_domicile, xg_exterieur, calculee_le')
      .range(de, de + 999);
    if (error) break;
    for (const p of data ?? []) {
      const id = Number(p.fixture_id);
      const d = Number(p.xg_domicile);
      const e = Number(p.xg_exterieur);
      if (!Number.isFinite(id) || !Number.isFinite(d) || !Number.isFinite(e)) continue;
      // Le pronostic le plus récent fait foi, comme pour la sélection.
      const connu = sortie.get(id);
      if (!connu || String(p.calculee_le) > connu.quand)
        sortie.set(id, { d, e, quand: String(p.calculee_le) });
    }
    if (!data || data.length < 1000) break;
  }
  return new Map([...sortie].map(([k, v]) => [k, { d: v.d, e: v.e }]));
}

async function calculer(): Promise<CertitudesDuJour> {
  const pronostics = await pronosticsAvecButsAttendus();
  if (!pronostics.size) return VIDE;

  const pourLeJour = async (jour: string): Promise<Certitude[]> => {
    const retenues: Certitude[] = [];
    for (const f of await fixturesDuJour(jour)) {
      const id = Number(f?.fixture?.id);
      const xg = pronostics.get(id);
      if (!xg) continue;

      const dom = String(f?.teams?.home?.name ?? '').trim();
      const ext = String(f?.teams?.away?.name ?? '').trim();
      const kickoff = String(f?.fixture?.date ?? '');
      if (!dom || !ext || !kickoff) continue;

      for (const c of certitudesPour(xg.d, xg.e, dom, ext)) {
        retenues.push({
          fixtureId: id,
          affiche: `${dom} — ${ext}`,
          championnat: String(f?.league?.name ?? '').trim(),
          kickoffISO: kickoff,
          texte: c.texte,
          probabilite: c.probabilite,
          valeur: c.valeur,
        });
      }
    }
    // La plus sûre d'abord. Et UNE SEULE par rencontre : quatre affirmations
    // sur le même match rempliraient la liste sans rien apprendre de plus.
    const vues = new Set<number>();
    return retenues
      .sort(
        (a, b) =>
          a.valeur - b.valeur ||
          b.probabilite - a.probabilite ||
          a.kickoffISO.localeCompare(b.kickoffISO)
      )
      .filter((c) => {
        if (vues.has(c.fixtureId)) return false;
        vues.add(c.fixtureId);
        return true;
      })
      .slice(0, MAXIMUM);
  };

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const duJour = await pourLeJour(aujourdhui);
  if (duJour.length) return { liste: duJour, aujourdhui: true, calculeeLe: new Date().toISOString() };

  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const deDemain = await pourLeJour(demain);
  if (deDemain.length)
    return { liste: deDemain, aujourdhui: false, calculeeLe: new Date().toISOString() };

  return VIDE;
}

/**
 * ── LECTURE DIRECTE, ET NON PAR LA RÉSERVE ────────────────────────────────
 *
 * `lireReserve` abandonne au bout d'une seconde et demie. Vérifié le
 * 6 septembre 2026 : sur cette liste-ci, l'abandon se produisait à chaque
 * appel — « delai après 1505 ms — repli servi » — et le repli RECALCULE tout,
 * c'est-à-dire relit `predictions_match` en entier et redemande la journée au
 * fournisseur. Le cache n'aurait donc jamais servi, et chaque affichage aurait
 * coûté le prix fort.
 *
 * Le même piège avait déjà tué la fusion du relevé de fiabilité, le
 * 5 septembre. Il ne se voit pas : tout continue de fonctionner, simplement en
 * payant à chaque fois ce qu'on croyait payer une fois.
 *
 * Trois secondes, et l'écran d'analyse n'attend jamais plus que cela — cette
 * lecture se fait dans un composant serveur, pas dans le rendu du navigateur.
 */
async function lireEnReserve(): Promise<{ contenu: CertitudesDuJour; expiree: boolean } | null> {
  try {
    const sb = createAdminClient();
    const lecture = sb.from('cache_api').select('contenu, expire_le').eq('cle', CLE).maybeSingle();
    const limite = new Promise<null>((r) => setTimeout(() => r(null), 3_000));
    const resultat: any = await Promise.race([lecture, limite]);
    const contenu = resultat?.data?.contenu;
    if (!contenu?.liste) return null;
    const expire = resultat?.data?.expire_le ? Date.parse(resultat.data.expire_le) : 0;
    return { contenu, expiree: !expire || expire < Date.now() };
  } catch {
    return null;
  }
}

/** La liste, depuis la réserve quand elle est fraîche. */
export async function lireCertitudesDuJour(): Promise<CertitudesDuJour> {
  try {
    const cache = await lireEnReserve();
    if (cache && !cache.expiree) {
      // Une rencontre commencée n'a plus rien à faire dans une liste de ce qui
      // VA se passer : on la retire à la lecture, sans tout recalculer.
      const maintenant = Date.now();
      const encore = (cache.contenu.liste ?? []).filter(
        (c) => !c.kickoffISO || Date.parse(c.kickoffISO) > maintenant
      );
      if (encore.length) return { ...cache.contenu, liste: encore };
    }

    const calculee = await calculer();
    await ecrireReserve(CLE, calculee, TTL);
    return calculee;
  } catch (e: any) {
    console.warn('[CERTITUDES] Indisponible :', e?.message);
    // L'écran doit vivre sans elle : elle ajoute, elle ne porte rien.
    return VIDE;
  }
}
