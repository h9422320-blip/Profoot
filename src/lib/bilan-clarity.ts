/**
 * LE BILAN CLARITY, EN FRANÇAIS SIMPLE.
 *
 * ── CE QUE CE FICHIER FAIT, ET CE QU'IL NE FAIT PAS ───────────────────────
 *
 * Il prend les chiffres bruts de Clarity et les met en phrases : ce qui va,
 * ce qui ne va pas, et quoi corriger en premier.
 *
 * Il n'invente RIEN. Chaque phrase produite ici s'appuie sur un nombre reçu de
 * l'API. Quand un chiffre manque — Clarity ne rend pas toujours toutes ses
 * métriques —, le bilan le dit au lieu de combler le trou.
 *
 * ── CE QUE L'API DONNE, ET CE QU'ELLE NE DONNE PAS ────────────────────────
 *
 * Des TOTAUX AGRÉGÉS sur un à trois jours. Pas les vidéos de session, pas les
 * cartes de chaleur, pas le détail d'un visiteur. On sait que douze personnes
 * ont cliqué rageusement sur la page des tarifs ; on ne sait pas sur QUOI.
 * Le bilan désigne donc où regarder, et c'est l'interface de Clarity qui
 * montre quoi.
 *
 * ── LES SEUILS, ET D'OÙ ILS VIENNENT ──────────────────────────────────────
 *
 * Microsoft ne publie pas de norme. Les seuils ci-dessous sont donc des
 * repères de bon sens, énoncés comme tels dans le texte produit — jamais
 * présentés comme une vérité du métier.
 */

import type { ApercuClarity, ComportementClarity, PageClarity } from './clarity-api';

/** Un problème repéré, avec ce qu'il coûte et ce qu'on peut y faire. */
export interface Probleme {
  /** De 1 (le plus grave) à 3. */
  rang: number;
  titre: string;
  /** Le chiffre qui le prouve. */
  constat: string;
  /** Pourquoi ça coûte des ventes. */
  consequence: string;
  recommandation: string;
}

export interface Bilan {
  periode: string;
  releveLe: string;
  enReserve: boolean;
  sessions: number;
  pagesVues: number;
  resume: string[];
  pagesLesPlusVues: PageClarity[];
  pagesQuiDecrochent: PageClarity[];
  pays: { valeur: string; sessions: number }[];
  appareils: { valeur: string; sessions: number }[];
  problemes: Probleme[];
  /** Ce que Clarity n'a pas fourni : dit, jamais comblé. */
  manques: string[];
}

/** Au-delà, un taux de clics rageurs mérite qu'on aille voir la page. */
const SEUIL_RAGE_POUR_CENT = 3;
/** Idem pour les clics dans le vide. */
const SEUIL_MORTS_POUR_CENT = 5;
/** Une page qu'on quitte aussitôt plus d'une fois sur quatre pose question. */
const SEUIL_RETOUR_POUR_CENT = 25;
/** En dessous, la moitié basse de la page n'est jamais lue. */
const SEUIL_SCROLL_POUR_CENT = 50;

const pourCent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

/**
 * Construit le bilan à partir des deux lectures Clarity.
 *
 * Les deux peuvent être nulles — jeton absent, service muet. Le bilan reste
 * alors honnête sur ce qu'il ne sait pas, plutôt que de rendre un rapport
 * vide qui aurait l'air d'un rapport.
 */
export function composerBilan(
  apercu: ApercuClarity | null,
  comportement: ComportementClarity | null
): Bilan {
  const manques: string[] = [];
  if (!apercu) manques.push("Aucun aperçu d'audience : jeton absent ou service injoignable.");
  if (!comportement) manques.push('Aucune donnée de comportement : jeton absent ou service injoignable.');

  const sessions = apercu?.sessions ?? 0;
  const pages = comportement?.pages ?? [];
  const totaux = comportement?.totaux;

  // ── Les pages où l'on décroche ────────────────────────────────────────
  //
  // Le classement se fait sur le nombre de retours rapides RAPPORTÉ aux
  // sessions de la page : dix demi-tours sur mille visites n'ont rien à voir
  // avec dix sur quinze. Une page vue trois fois ne prouve rien et n'entre
  // pas au classement.
  const MINIMUM_SESSIONS = 10;
  const pagesQuiDecrochent = pages
    .filter((p) => p.sessions >= MINIMUM_SESSIONS && p.retoursRapides > 0)
    .map((p) => ({ p, taux: pourCent(p.retoursRapides, p.sessions) }))
    .sort((a, b) => b.taux - a.taux)
    .slice(0, 5)
    .map((x) => x.p);

  // ── Le résumé en clair ────────────────────────────────────────────────
  const resume: string[] = [];
  if (sessions > 0) {
    resume.push(
      `${sessions.toLocaleString('fr-FR')} session${sessions > 1 ? 's' : ''} sur ` +
        `${apercu?.jours ?? 3} jour${(apercu?.jours ?? 3) > 1 ? 's' : ''}, ` +
        `${(apercu?.pagesVues ?? 0).toLocaleString('fr-FR')} page${(apercu?.pagesVues ?? 0) > 1 ? 's' : ''} vue${(apercu?.pagesVues ?? 0) > 1 ? 's' : ''}.`
    );
  }
  if (apercu?.pays?.length) {
    const trois = apercu.pays.slice(0, 3).map((p) => `${p.valeur} (${p.sessions})`).join(', ');
    resume.push(`Les visiteurs viennent surtout de : ${trois}.`);
  }
  if (apercu?.appareils?.length) {
    const mobile = apercu.appareils.find((a) => /mobile|phone/i.test(a.valeur));
    const partMobile = mobile ? pourCent(mobile.sessions, sessions) : null;
    if (partMobile !== null)
      resume.push(`${partMobile} % des visites se font sur téléphone — c'est là qu'il faut juger le site.`);
  }
  if (totaux?.profondeurScroll != null) {
    resume.push(`En moyenne, les pages sont lues jusqu'à ${totaux.profondeurScroll} % de leur hauteur.`);
  } else {
    manques.push("Clarity n'a pas renvoyé la profondeur de lecture sur cette période.");
  }

  // ── Les problèmes, classés par ce qu'ils coûtent ──────────────────────
  const candidats: Omit<Probleme, 'rang'>[] = [];

  if (totaux && sessions > 0) {
    const tauxRage = pourCent(totaux.clicsDeRage, sessions);
    if (totaux.clicsDeRage > 0 && tauxRage >= SEUIL_RAGE_POUR_CENT) {
      const pire = [...pages].sort((a, b) => b.clicsDeRage - a.clicsDeRage)[0];
      candidats.push({
        titre: 'Des visiteurs cliquent avec agacement',
        constat:
          `${totaux.clicsDeRage} clic${totaux.clicsDeRage > 1 ? 's' : ''} de rage sur ${sessions} sessions ` +
          `(${tauxRage} %)` + (pire?.url ? `, surtout sur ${pire.url}.` : '.'),
        consequence:
          'Un clic de rage, c\'est quelqu\'un qui appuie plusieurs fois de suite parce que rien ne se ' +
          'passe. Il ne signale jamais le problème : il ferme la page.',
        recommandation: pire?.url
          ? `Ouvrez ${pire.url} sur un téléphone et touchez chaque élément qui ressemble à un bouton. ` +
            'Les vidéos de session dans Clarity montrent exactement sur quoi ils insistent.'
          : 'Regardez les enregistrements de session dans Clarity pour voir sur quoi ils insistent.',
      });
    }

    const tauxMorts = pourCent(totaux.clicsMorts, sessions);
    if (totaux.clicsMorts > 0 && tauxMorts >= SEUIL_MORTS_POUR_CENT) {
      const pire = [...pages].sort((a, b) => b.clicsMorts - a.clicsMorts)[0];
      candidats.push({
        titre: 'Des éléments ont l\'air cliquables sans l\'être',
        constat:
          `${totaux.clicsMorts} clic${totaux.clicsMorts > 1 ? 's' : ''} dans le vide sur ${sessions} sessions ` +
          `(${tauxMorts} %)` + (pire?.url ? `, surtout sur ${pire.url}.` : '.'),
        consequence:
          'Le visiteur croit avoir déclenché quelque chose. Il attend, rien ne vient, et il conclut que ' +
          'le site est cassé.',
        recommandation:
          'Rendez ces éléments réellement cliquables, ou retirez-leur ce qui les fait passer pour des ' +
          'boutons — la couleur d\'accent, le soulignement, le curseur en main.',
      });
    }

    const tauxRetour = pourCent(totaux.retoursRapides, sessions);
    if (totaux.retoursRapides > 0 && tauxRetour >= SEUIL_RETOUR_POUR_CENT) {
      const pire = pagesQuiDecrochent[0];
      candidats.push({
        titre: 'Des visiteurs font demi-tour aussitôt arrivés',
        constat:
          `${totaux.retoursRapides} retour${totaux.retoursRapides > 1 ? 's' : ''} immédiat${totaux.retoursRapides > 1 ? 's' : ''} ` +
          `sur ${sessions} sessions (${tauxRetour} %)` +
          (pire ? `, le pire étant ${pire.url} (${pourCent(pire.retoursRapides, pire.sessions)} %).` : '.'),
        consequence:
          'La page n\'a pas tenu sa promesse en une seconde : mauvais contenu, chargement trop lent, ou ' +
          'ce n\'était pas ce que la personne cherchait.',
        recommandation: pire
          ? `Vérifiez ce que ${pire.url} montre dans sa première seconde sur un téléphone. Si le contenu ` +
            'utile arrive après le premier écran, remontez-le.'
          : 'Vérifiez ce que ces pages affichent dans leur première seconde sur un téléphone.',
      });
    }

    if (totaux.profondeurScroll != null && totaux.profondeurScroll < SEUIL_SCROLL_POUR_CENT) {
      candidats.push({
        titre: 'La moitié basse des pages n\'est pas lue',
        constat: `Lecture moyenne : ${totaux.profondeurScroll} % de la hauteur des pages.`,
        consequence:
          'Tout ce qui se trouve plus bas — arguments, preuves, boutons d\'abonnement — n\'est vu par ' +
          'presque personne.',
        recommandation:
          'Remontez ce qui doit convaincre au-dessus de la ligne de flottaison, et raccourcissez ce qui ' +
          'précède.',
      });
    }
  }

  const problemes = candidats.slice(0, 3).map((p, i) => ({ ...p, rang: i + 1 }));

  if (!problemes.length && sessions > 0)
    resume.push('Aucun signal d\'alerte au-dessus des seuils retenus sur cette période.');

  return {
    periode: `${comportement?.jours ?? apercu?.jours ?? 3} derniers jours`,
    releveLe: comportement?.releveLe ?? apercu?.releveLe ?? new Date().toISOString(),
    enReserve: !!(comportement?.enReserve || apercu?.enReserve),
    sessions,
    pagesVues: apercu?.pagesVues ?? 0,
    resume,
    pagesLesPlusVues: pages.slice(0, 8),
    pagesQuiDecrochent,
    pays: apercu?.pays?.slice(0, 8) ?? [],
    appareils: apercu?.appareils ?? [],
    problemes,
    manques: [
      ...manques,
      ...(apercu?.probleme ? [apercu.probleme] : []),
      ...(comportement?.probleme ? [comportement.probleme] : []),
    ],
  };
}
