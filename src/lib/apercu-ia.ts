/**
 * LA BANDE-ANNONCE, RÉDIGÉE PAR LE MODÈLE — ET SURVEILLÉE.
 *
 * POURQUOI L'IA PLUTÔT QU'UN GABARIT
 *
 * Un gabarit rempli de chiffres se reconnaît : « arrive lancé avec 3 succès sur
 * ses 5 dernières sorties » revient d'un match à l'autre, et le lecteur sent
 * la machine. Un texte rédigé donne un ton naturel, propre à chaque affiche.
 *
 * LES TROIS CONTRAINTES, DANS L'ORDRE D'IMPORTANCE
 *
 *   1. NE RIEN RÉVÉLER. Le modèle ne reçoit QUE la forme récente et les buts.
 *      Ni le score calculé, ni les probabilités, ni la confiance, ni les
 *      scénarios n'entrent dans son prompt. On ne peut pas divulguer ce qu'on
 *      n'a pas. C'est la protection principale — le prompt n'est que la
 *      seconde.
 *
 *   2. NE PAS COÛTER. Modèle le moins cher de la chaîne, sortie bornée à
 *      quelques dizaines de mots, et surtout UNE SEULE GÉNÉRATION PAR MATCH :
 *      le texte est écrit en base et resservi à tous les visiteurs. Sans ce
 *      cache, une affiche analysée trente fois serait payée trente fois — c'est
 *      exactement le gaspillage qu'on vient de corriger ailleurs.
 *
 *   3. NE PAS DÉRAPER. Un modèle bon marché à qui l'on interdit d'annoncer un
 *      vainqueur finit par écrire « logiquement remporté par le favori ». Tout
 *      texte produit passe donc un contrôle : au moindre score, pourcentage ou
 *      verdict, il est REJETÉ et le gabarit prend le relais. Mieux vaut un
 *      texte mécanique qu'un texte qui vend la mèche.
 */

import { appelerOpenRouter, MODELE_ECONOMIQUE, openRouterDisponible } from './openrouter';
import { lireReserve, ecrireReserve } from './api-football';
import { composerApercu, type FormeEquipe } from './apercu-vendeur';

/** Sept jours : la forme d'une équipe ne bouge qu'entre deux journées. */
const TTL = 7 * 24 * 60 * 60 * 1000;

/** Assez pour trois ou quatre phrases, pas assez pour une dissertation. */
const JETONS_MAX = 220;

/** Au-delà, on n'attend plus : le gabarit part et le visiteur ne voit rien. */
const DELAI_MS = 12_000;

const CONSIGNE = `Tu rédiges la bande-annonce d'une analyse de match de football, destinée à un visiteur qui n'a pas encore payé.

TON RÔLE : donner envie de débloquer l'analyse complète, SANS jamais en révéler le contenu.

RÈGLES ABSOLUES — leur violation rend le texte inutilisable :
- N'annonce JAMAIS de vainqueur, ni qui est favori, ni qui va perdre.
- N'écris JAMAIS de score, même approximatif.
- N'écris JAMAIS de pourcentage, de probabilité, de cote ni de "buts attendus".
- N'écris JAMAIS de niveau de confiance.
- N'invente aucun nom de joueur, aucune minute, aucun but.
- N'emploie pas les mots : favori, vainqueur, gagnera, l'emportera, dominera, devrait s'imposer.

CE QUE TU DOIS FAIRE :
- Décris un atout RÉEL de CHAQUE équipe, tiré uniquement des chiffres fournis.
- Reste ÉQUILIBRÉ : le lecteur ne doit pas pouvoir deviner qui va gagner. Même une équipe en difficulté reçoit un argument crédible.
- Termine en disant qu'une analyse complète existe, avec son verdict, sans le donner.
- 3 à 4 phrases. Français naturel, ton de journaliste sportif. Aucune liste, aucun titre.
- Ne répète pas les chiffres bruts tels quels : raconte-les.`;

/**
 * Ce texte trahit-il le verdict ?
 *
 * Appliqué à TOUTE sortie du modèle, sans exception. Un seul motif reconnu et
 * le texte est jeté : on préfère le gabarit, qui ne peut pas mentir.
 */
export function trahitLeVerdict(texte: string): string | null {
  const t = String(texte ?? '');

  const CONTROLES: [string, RegExp][] = [
    ['un score', /\b\d\s*[-–—]\s*\d\b/],
    ['un pourcentage', /\d+\s*%/],
    ['une probabilité chiffrée', /\b\d[.,]\d{1,2}\b\s*(?:contre|vs|à)\s*\d[.,]\d{1,2}\b/],
    ['les buts attendus', /buts?\s+attendus?/i],
    ['un niveau de confiance', /confian[cs]e\s+(?:de\s+)?(?:l['’]ia|très|élevée|faible|moyenne)/i],
    ['un vainqueur annoncé', /\b(?:favori|vainqueur|l['’]emporter|va\s+gagner|devrait\s+(?:gagner|s['’]imposer|l['’]emporter)|s['’]imposera|dominera|remport(?:e|era|é))\b/i],
    ['un pronostic déguisé', /\b(?:notre\s+pronostic|nous\s+prévoyons|le\s+plus\s+probable\s+est)\b/i],
  ];

  for (const [quoi, motif] of CONTROLES) if (motif.test(t)) return quoi;

  // Un texte trop court n'est pas une bande-annonce, c'est un échec silencieux.
  if (t.trim().length < 120) return 'un texte trop court';

  return null;
}

const cleDe = (nom1: string, nom2: string) => {
  const n = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Trié : « Lens — PSG » et « PSG — Lens » désignent la même rencontre et ne
  // doivent pas être générés deux fois.
  return `apercu:${[n(nom1), n(nom2)].sort().join('-')}`;
};

/** Les chiffres transmis au modèle — et rien d'autre. */
function resumerForme(nom: string, f?: FormeEquipe): string {
  const m = Array.isArray(f?.recentMatches) ? f!.recentMatches! : [];
  const compte = (l: string) => m.filter((x) => String(x ?? '').toUpperCase().startsWith(l)).length;
  const joues = m.length || 1;
  const pour = Number(f?.goalsScored ?? 0);
  const contre = Number(f?.goalsConceded ?? 0);

  return [
    `${nom} :`,
    `${compte('W')} victoire(s), ${compte('D')} nul(s), ${compte('L')} défaite(s) sur ses ${m.length || 0} derniers matchs`,
    `${(pour / joues).toFixed(1)} but(s) marqué(s) et ${(contre / joues).toFixed(1)} encaissé(s) par match`,
    `${Number(f?.cleanSheets ?? 0)} match(s) sans encaisser`,
    Number(f?.avgPossession ?? 0) > 0 ? `${Math.round(Number(f!.avgPossession))} % de possession moyenne` : '',
    Number(f?.winStreak ?? 0) >= 2 ? `série de ${Number(f!.winStreak)} victoires en cours` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export interface ResultatApercu {
  texte: string;
  source: 'ia' | 'reserve' | 'gabarit';
  /** Renseigné quand une sortie du modèle a été rejetée. */
  rejet?: string;
}

/**
 * L'aperçu d'une rencontre : lu en réserve, sinon rédigé une fois.
 *
 * Ne lève jamais. En cas d'échec — modèle absent, réseau coupé, texte qui
 * trahit le verdict — le gabarit prend le relais et le visiteur ne voit
 * aucune différence de service.
 */
export async function obtenirApercu(
  nom1: string,
  nom2: string,
  forme1?: FormeEquipe,
  forme2?: FormeEquipe
): Promise<ResultatApercu> {
  const gabarit = () => composerApercu(nom1, nom2, forme1, forme2);
  const cle = cleDe(nom1, nom2);
  const affiche = `${nom1} — ${nom2}`;

  /**
   * Une ligne par aperçu, toujours, quel que soit le résultat.
   *
   * Sans elle, un repli sur le gabarit est indiscernable d'un succès : le
   * visiteur voit un texte, l'application n'écrit rien, et l'on découvre le
   * problème en regardant l'écran par hasard. C'est exactement ce qui s'est
   * produit en production, où le gabarit sortait sans que rien ne dise
   * pourquoi.
   */
  const tracer = (r: ResultatApercu, detail = '') => {
    console.log(
      `[APERÇU] ${affiche} | source=${r.source}` +
        (r.rejet ? ` | rejet=${r.rejet}` : '') +
        (detail ? ` | ${detail}` : '') +
        ` | ${r.texte.length} caractères`
    );
    return r;
  };

  // ── UNE SEULE GÉNÉRATION PAR MATCH ───────────────────────────────────────
  try {
    const enBase = await lireReserve<string>(cle);
    if (enBase && !enBase.expiree && typeof enBase.contenu === 'string' && enBase.contenu.length > 80)
      return tracer({ texte: enBase.contenu, source: 'reserve' }, 'aucun appel payé');
  } catch (e: any) {
    console.warn(`[APERÇU] ${affiche} | réserve illisible (${e?.message}) — on régénère.`);
  }

  // La cause n°1 observée en production : la clé n'est pas lue côté serveur.
  // On le DIT, au lieu de retomber silencieusement sur le gabarit.
  if (!openRouterDisponible())
    return tracer(
      { texte: gabarit(), source: 'gabarit' },
      'CAUSE=OPENROUTER_API_KEY absente de l’environnement serveur'
    );

  const invite = [
    `Match : ${nom1} contre ${nom2}.`,
    '',
    'Données réelles des deux équipes :',
    `- ${resumerForme(nom1, forme1)}`,
    `- ${resumerForme(nom2, forme2)}`,
    '',
    'Rédige la bande-annonce en respectant toutes les règles.',
  ].join('\n');

  const horloge = new AbortController();
  const minuteur = setTimeout(() => horloge.abort(), DELAI_MS);

  const debut = Date.now();
  console.log(`[APERÇU] ${affiche} | appel du modèle ${MODELE_ECONOMIQUE}…`);

  try {
    const brut = await appelerOpenRouter(MODELE_ECONOMIQUE, invite, horloge.signal, CONSIGNE);
    clearTimeout(minuteur);

    const texte = String(brut ?? '')
      .replace(/^["'«\s]+|["'»\s]+$/g, '')
      .replace(/\s*\n+\s*/g, ' ')
      .trim();

    const faute = trahitLeVerdict(texte);
    if (faute) {
      // On ne réessaie pas : un second appel coûterait autant et rien ne dit
      // qu'il ferait mieux. Le gabarit, lui, est sûr.
      //
      // Le texte rejeté est journalisé en entier : c'est la seule façon de
      // resserrer la consigne plutôt que de deviner ce que le modèle écrit.
      console.warn(`[APERÇU] ${affiche} | REJETÉ (${faute}) | texte reçu : « ${texte.slice(0, 300)} »`);
      return tracer({ texte: gabarit(), source: 'gabarit', rejet: faute }, `${Date.now() - debut} ms`);
    }

    const final = /Débloquez/i.test(texte)
      ? texte
      : `${texte} Débloquez l'analyse complète pour tout voir.`;

    void ecrireReserve(cle, final, TTL);
    return tracer({ texte: final, source: 'ia' }, `${Date.now() - debut} ms | mis en réserve ${TTL / 3600000} h`);
  } catch (e: any) {
    clearTimeout(minuteur);
    const cause =
      e?.name === 'AbortError'
        ? `délai de ${DELAI_MS} ms dépassé`
        : `${e?.status ? `HTTP ${e.status} — ` : ''}${e?.message ?? 'erreur inconnue'}`;
    console.error(`[APERÇU] ${affiche} | ÉCHEC DE L'APPEL | CAUSE=${cause} | ${Date.now() - debut} ms`);
    return tracer({ texte: gabarit(), source: 'gabarit' }, `cause : ${cause}`);
  }
}
