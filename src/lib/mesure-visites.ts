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

/** Une étape du tunnel de vente, et ce qu'elle a retenu. */
export interface EtapeEntonnoir {
  cle: string;
  libelle: string;
  /** Visites distinctes ayant atteint cette étape. */
  visites: number;
  /** Part de l'étape précédente, en pourcentage. */
  partPrecedente: number | null;
  /** Perte par rapport à l'étape précédente. */
  perdues: number;
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
  /** Le tunnel de vente, de la page des tarifs au départ vers la caisse. */
  entonnoir: EtapeEntonnoir[];
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
    entonnoir: [],
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

  // ── LES ÉTAPES DU TUNNEL NE SONT PAS DES PAGES ──────────────────────────
  //
  // Elles sont enregistrées dans la même table, sous un chemin commençant par
  // « /~ », pour hériter de tout ce qui existe déjà — identifiant de visite,
  // pays, support, signal qui survit à la fermeture. Mais les mêler aux pages
  // fausserait tout : une étape n'a pas de durée, ne s'ouvre pas, et compterait
  // comme une sortie.
  const estEtape = (chemin: string) => chemin.startsWith('/~');

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
    const pagesSeules = liste.filter((l) => !estEtape(l.chemin));
    pagesSeules.forEach((l, i) => {
      const p = poste(l.chemin);
      p.vues++;
      p.visites.add(l.visite_id);
      if (l.duree_ms != null && l.duree_ms > 0) {
        p.dureeTotale += l.duree_ms;
        p.avecDuree++;
      } else p.sansDuree++;
      if (i === 0) p.arrivees++;
      if (i === pagesSeules.length - 1) p.sorties++;
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
    const seulesPages = liste.filter((l) => !estEtape(l.chemin));
    if (seulesPages.length < 2) continue;
    // Quatre pages suffisent à voir l'intention ; au-delà, chaque parcours
    // devient unique et le classement ne dit plus rien.
    const cle = seulesPages.slice(0, 4).map((l) => l.chemin).join(' → ');
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

  // ── LE TUNNEL DE VENTE, ÉTAPE PAR ÉTAPE ─────────────────────────────────
  //
  // On compte des VISITES DISTINCTES, jamais des signaux : quelqu'un qui ouvre
  // la notice, la ferme, la rouvre et paie doit compter pour une personne à
  // chaque étape. Compter les signaux gonflerait le haut de l'entonnoir et
  // ferait paraître la perte plus grande qu'elle n'est.
  //
  // La première marche est la PAGE DES TARIFS, pas le clic : c'est elle qui
  // donne le vrai dénominateur — combien de gens ont vu les prix.
  const visitesAvec = (predicat: (chemin: string) => boolean) => {
    const vus = new Set<string>();
    for (const [id, liste] of passages)
      if (liste.some((l) => predicat(l.chemin))) vus.add(id);
    return vus.size;
  };

  // ── « VERS LES TARIFS » N'EST PAS UN CLIC D'ACHAT ───────────────────────
  //
  // Le bouton du paywall qui envoie lire les prix partageait l'étape
  // « offre-cliquee ». Il n'ouvre pourtant aucune notice et ne mène à aucune
  // caisse. Mesuré du 22 au 24 août 2026, il pesait 377 des 579 clics comptés
  // en haut de l'entonnoir : les deux tiers. L'entonnoir affichait donc une
  // fuite massive qui n'était que le trajet normal vers la page des tarifs.
  //
  // Il a désormais sa propre étape. L'exclusion par le suffixe reste
  // nécessaire pour les semaines déjà enregistrées sous l'ancien chemin :
  // sans elle, le haut de l'entonnoir resterait faux jusqu'à ce que ces
  // lignes sortent de la fenêtre de lecture.
  const ANCIEN_VERS_TARIFS = '/~offre-cliquee/vers-tarifs';

  const MARCHES: { cle: string; libelle: string; test: (c: string) => boolean }[] = [
    {
      cle: 'vers-tarifs',
      libelle: 'Sont allés du paywall vers les tarifs',
      test: (c) => c.startsWith('/~vers-tarifs') || c === ANCIEN_VERS_TARIFS,
    },
    { cle: 'tarifs', libelle: 'Ont vu les tarifs', test: (c) => c === '/pricing' },
    {
      cle: 'offre-cliquee',
      libelle: 'Ont cliqué sur une offre',
      test: (c) => c.startsWith('/~offre-cliquee') && c !== ANCIEN_VERS_TARIFS,
    },
    { cle: 'notice-continuer', libelle: 'Ont cliqué « Continuer »', test: (c) => c.startsWith('/~notice-continuer') },
    { cle: 'notice-auto', libelle: 'Sont partis après 20 s, sans agir', test: (c) => c.startsWith('/~notice-auto') },
    { cle: 'notice-fermee', libelle: 'Ont fermé la notice', test: (c) => c.startsWith('/~notice-fermee') },
    { cle: 'depart-caisse', libelle: 'Sont partis vers la caisse', test: (c) => c.startsWith('/~depart-caisse') },
    { cle: 'echec-lien', libelle: 'Lien de paiement en échec', test: (c) => c.startsWith('/~echec-lien') },
  ];

  const brut = MARCHES.map((m) => ({ ...m, visites: visitesAvec(m.test) }));

  // Les trois issues de la notice sont des SŒURS, pas des marches : elles se
  // partagent ceux qui ont cliqué sur une offre. Seul le départ vers la caisse
  // est une marche de plus. La part affichée se calcule donc contre la bonne
  // référence, sinon « fermé » paraîtrait suivre « continuer ».
  const reference: Record<string, string | null> = {
    // Une porte d'entrée parmi d'autres : on arrive aussi sur les tarifs par
    // le menu ou par un lien direct. Lui donner un pourcentage laisserait
    // croire qu'elle est la seule.
    'vers-tarifs': null,
    tarifs: null,
    'offre-cliquee': 'tarifs',
    'notice-continuer': 'offre-cliquee',
    'notice-auto': 'offre-cliquee',
    'notice-fermee': 'offre-cliquee',
    'depart-caisse': 'offre-cliquee',
    'echec-lien': 'offre-cliquee',
  };

  const parCle = new Map(brut.map((m) => [m.cle, m.visites]));
  const entonnoir: EtapeEntonnoir[] = brut.map((m) => {
    const ref = reference[m.cle];
    const base = ref ? (parCle.get(ref) ?? 0) : 0;
    return {
      cle: m.cle,
      libelle: m.libelle,
      visites: m.visites,
      partPrecedente: ref && base > 0 ? arrondi((m.visites / base) * 100) : null,
      perdues: ref && base > 0 ? Math.max(0, base - m.visites) : 0,
    };
  });

  const unePage = [...passages.values()].filter(
    (l) => l.filter((x) => !estEtape(x.chemin)).length === 1
  ).length;

  return {
    depuis,
    visites: passages.size,
    pagesVues: lignes.filter((l) => !estEtape(l.chemin)).length,
    pagesParVisite: arrondi(lignes.filter((l) => !estEtape(l.chemin)).length / passages.size),
    tauxUnePage: arrondi((unePage / passages.size) * 100),
    partMobile: totalSupport ? arrondi((surMobile / totalSupport) * 100) : null,
    pages: pages.slice(0, 15),
    sorties,
    cheminsFrequents,
    pays: [...comptePays]
      .map(([valeur, visites]) => ({ valeur, visites }))
      .sort((a, b) => b.visites - a.visites)
      .slice(0, 8),
    entonnoir,
  };
}
