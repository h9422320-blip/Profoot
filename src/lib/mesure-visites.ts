/**
 * CE QUE LES VISITEURS FONT, LU DANS NOTRE PROPRE BASE.
 *
 * ── LES QUATRE QUESTIONS AUXQUELLES CE FICHIER RÉPOND ─────────────────────
 *
 *   1. Sur quelle page les gens ARRIVENT.
 *   2. Combien de temps ils restent sur chacune.
 *   3. Sur quelle page ils FERMENT — c'est celle-là qui coûte des ventes.
 *   4. Quel chemin ils suivent avant de partir.
 *
 * Clarity répond à la première et à la deuxième, avec un jour de retard et dix
 * appels par jour. Il ne répond pas du tout à la quatrième, et sa réponse à la
 * troisième ne distingue pas « il est parti content » de « il a abandonné ».
 *
 * Ici, tout vient de `visites_pages`, écrite par l'application elle-même. Sans
 * plafond, à la seconde, gratuitement.
 *
 * ── UNE PRÉCAUTION SUR LES DURÉES ─────────────────────────────────────────
 *
 * La durée n'est écrite qu'au départ de la page. Une fermeture brutale la
 * laisse vide. On calcule donc les moyennes sur les seules pages qui en ont
 * une, et l'on dit combien ont été écartées : une moyenne calculée en
 * remplaçant les trous par zéro ferait paraître toutes les pages plus courtes
 * qu'elles ne sont.
 */

import { createAdminClient } from './supabase-admin';

export interface PageMesuree {
  chemin: string;
  /** Nombre de fois que la page a été ouverte. */
  vues: number;
  /** Visites distinctes ayant vu cette page. */
  visites: number;
  /** Secondes passées en moyenne, sur les vues dont on connaît la durée. */
  secondesMoyennes: number | null;
  /** Vues sans durée connue — fermeture brutale, réseau coupé. */
  sansDuree: number;
  /** Fois où cette page a été la PREMIÈRE du passage. */
  arrivees: number;
  /** Fois où cette page a été la DERNIÈRE : c'est là qu'on ferme. */
  sorties: number;
  /** Part des passages qui se terminent ici, en pourcentage. */
  tauxDeSortie: number;
}

export interface CheminSuivi {
  /** Les pages dans l'ordre, séparées par une flèche. */
  parcours: string;
  passages: number;
}

export interface BilanVisites {
  /** Depuis quand on regarde. */
  depuis: string;
  visites: number;
  pagesVues: number;
  /** Pages par visite, en moyenne. */
  pagesParVisite: number;
  /** Part des visites d'une seule page — arrivées puis reparties. */
  tauxUnePage: number;
  partMobile: number | null;
  pages: PageMesuree[];
  /** Les pages où l'on ferme le plus, rapportées à leurs vues. */
  sorties: PageMesuree[];
  cheminsFrequents: CheminSuivi[];
  pays: { valeur: string; visites: number }[];
  /** Vrai quand la table n'existe pas encore. */
  tableAbsente?: boolean;
}

interface Ligne {
  visite_id: string;
  chemin: string;
  entre_le: string;
  duree_ms: number | null;
  ordre: number;
  pays: string | null;
  mobile: boolean | null;
}

/** Lit une table entière, mille lignes à la fois. */
async function lireTout(depuis: string, plafond = 60000): Promise<Ligne[] | null> {
  const sb = createAdminClient();
  const tout: Ligne[] = [];

  for (let de = 0; de < plafond; de += 1000) {
    const { data, error } = await sb
      .from('visites_pages')
      .select('visite_id, chemin, entre_le, duree_ms, ordre, pays, mobile')
      .gte('entre_le', depuis)
      .order('entre_le', { ascending: false })
      .range(de, de + 999);

    if (error) {
      // Table absente : le SQL n'a pas encore été passé. Ce n'est pas une
      // panne, c'est un état de départ — l'appelant le dira en clair.
      if (/relation|does not exist|schema cache/i.test(error.message)) return null;
      console.warn('[MESURE] Lecture impossible :', error.message);
      break;
    }
    if (!data?.length) break;
    tout.push(...(data as Ligne[]));
    if (data.length < 1000) break;
  }

  return tout;
}

const arrondi = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Le bilan des dernières heures.
 *
 * @param heures  Fenêtre observée. Vingt-quatre par défaut : la journée est
 *                l'unité à laquelle on décide.
 */
export async function lireBilanVisites(heures = 24): Promise<BilanVisites> {
  const depuis = new Date(Date.now() - heures * 3600_000).toISOString();
  const vide: BilanVisites = {
    depuis, visites: 0, pagesVues: 0, pagesParVisite: 0, tauxUnePage: 0,
    partMobile: null, pages: [], sorties: [], cheminsFrequents: [], pays: [],
  };

  const lignes = await lireTout(depuis);
  if (lignes === null) return { ...vide, tableAbsente: true };
  if (!lignes.length) return vide;

  // ── Regroupement par passage : c'est lui qui donne arrivées et sorties ──
  const passages = new Map<string, Ligne[]>();
  for (const l of lignes) {
    const liste = passages.get(l.visite_id) ?? [];
    liste.push(l);
    passages.set(l.visite_id, liste);
  }
  for (const liste of passages.values()) liste.sort((a, b) => a.ordre - b.ordre);

  // ── Agrégation par page ──────────────────────────────────────────────────
  const parPage = new Map<string, {
    vues: number; visites: Set<string>; dureeTotale: number;
    avecDuree: number; sansDuree: number; arrivees: number; sorties: number;
  }>();

  const poste = (chemin: string) => {
    const p = parPage.get(chemin) ?? {
      vues: 0, visites: new Set<string>(), dureeTotale: 0,
      avecDuree: 0, sansDuree: 0, arrivees: 0, sorties: 0,
    };
    parPage.set(chemin, p);
    return p;
  };

  for (const [, liste] of passages) {
    liste.forEach((l, i) => {
      const p = poste(l.chemin);
      p.vues++;
      p.visites.add(l.visite_id);
      if (l.duree_ms != null && l.duree_ms > 0) {
        p.dureeTotale += l.duree_ms;
        p.avecDuree++;
      } else p.sansDuree++;
      if (i === 0) p.arrivees++;
      if (i === liste.length - 1) p.sorties++;
    });
  }

  const pages: PageMesuree[] = [...parPage].map(([chemin, p]) => ({
    chemin,
    vues: p.vues,
    visites: p.visites.size,
    secondesMoyennes: p.avecDuree ? arrondi(p.dureeTotale / p.avecDuree / 1000) : null,
    sansDuree: p.sansDuree,
    arrivees: p.arrivees,
    sorties: p.sorties,
    tauxDeSortie: p.vues ? arrondi((p.sorties / p.vues) * 100) : 0,
  })).sort((a, b) => b.vues - a.vues);

  // ── Les pages où l'on ferme le plus ─────────────────────────────────────
  //
  // Classées sur le TAUX, pas sur le nombre : dix fermetures sur douze vues
  // sont un problème, dix sur mille n'en sont pas un. Sous dix vues, on
  // n'affiche rien — trois visiteurs ne prouvent rien.
  const MINIMUM = 10;
  const sorties = pages
    .filter((p) => p.vues >= MINIMUM && p.sorties > 0)
    .sort((a, b) => b.tauxDeSortie - a.tauxDeSortie)
    .slice(0, 6);

  // ── Les chemins les plus suivis ─────────────────────────────────────────
  const parcours = new Map<string, number>();
  for (const [, liste] of passages) {
    if (liste.length < 2) continue;
    // Quatre pages suffisent à voir l'intention ; au-delà, chaque parcours
    // devient unique et le classement ne dit plus rien.
    const cle = liste.slice(0, 4).map((l) => l.chemin).join(' → ');
    parcours.set(cle, (parcours.get(cle) ?? 0) + 1);
  }
  const cheminsFrequents: CheminSuivi[] = [...parcours]
    .map(([parcours, passages]) => ({ parcours, passages }))
    .sort((a, b) => b.passages - a.passages)
    .slice(0, 8);

  // ── Pays et support, comptés par PASSAGE et non par page vue ────────────
  const paysParVisite = new Map<string, string>();
  const mobileParVisite = new Map<string, boolean>();
  for (const [id, liste] of passages) {
    const avecPays = liste.find((l) => l.pays);
    if (avecPays?.pays) paysParVisite.set(id, avecPays.pays);
    const avecMobile = liste.find((l) => l.mobile != null);
    if (avecMobile) mobileParVisite.set(id, !!avecMobile.mobile);
  }

  const comptePays = new Map<string, number>();
  for (const p of paysParVisite.values()) comptePays.set(p, (comptePays.get(p) ?? 0) + 1);

  const surMobile = [...mobileParVisite.values()].filter(Boolean).length;
  const totalSupport = mobileParVisite.size;

  const unePage = [...passages.values()].filter((l) => l.length === 1).length;

  return {
    depuis,
    visites: passages.size,
    pagesVues: lignes.length,
    pagesParVisite: arrondi(lignes.length / passages.size),
    tauxUnePage: arrondi((unePage / passages.size) * 100),
    partMobile: totalSupport ? arrondi((surMobile / totalSupport) * 100) : null,
    pages: pages.slice(0, 15),
    sorties,
    cheminsFrequents,
    pays: [...comptePays]
      .map(([valeur, visites]) => ({ valeur, visites }))
      .sort((a, b) => b.visites - a.visites)
      .slice(0, 8),
  };
}
