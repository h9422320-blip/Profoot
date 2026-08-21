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

/**
 * ── CE QUE L'AVANT-GOÛT DONNE, ET CE QU'IL RETIENT ─────────────────────────
 *
 * La règle a été établie en observant ce que fait un concurrent qui vend, lui :
 * il donne du RÉCIT, jamais des CHIFFRES EXPLOITABLES.
 *
 * Un lecteur repart avec le contexte du match et la manière dont les deux
 * équipes vont l'aborder. Il ne repart avec AUCUNE donnée sur laquelle il
 * pourrait parier : ni score, ni probabilité, ni buts attendus. Pour ça, il
 * paie.
 *
 * Notre erreur était l'inverse : on servait « 2-1 », « 1.9 contre 1.36 »,
 * « 40/26/34 ». Des chiffres directement utilisables — et donc plus aucune
 * raison de payer.
 *
 * S'y ajoute une exigence qui nous est propre : le récit reste ÉQUILIBRÉ. On
 * décrit les intentions des deux équipes sans dire laquelle prendra le dessus.
 */
const CONSIGNE = `Tu rédiges l'avant-goût gratuit d'une analyse de match de football, pour un visiteur qui n'a pas encore payé.

Tu produis EXACTEMENT deux paragraphes, séparés par une ligne contenant seulement ---

PARAGRAPHE 1 — LE CONTEXTE (2 à 3 phrases)
Qui reçoit qui, dans quelle compétition, et l'état de forme réel des deux équipes d'après les chiffres fournis. Ton de journaliste sportif qui plante le décor.

PARAGRAPHE 2 — LE SCÉNARIO TACTIQUE (3 à 4 phrases)
Comment chaque équipe va aborder la rencontre : ses intentions, ses points d'appui, ce sur quoi elle va s'appuyer et ce qu'elle devra surveiller. Décris les DEUX camps avec le même soin.

RÈGLES ABSOLUES — leur violation rend le texte inutilisable :
- N'écris JAMAIS de score, même approximatif.
- N'écris JAMAIS de pourcentage, de probabilité, de cote ni de "buts attendus".
- N'écris JAMAIS de niveau de confiance.
- N'invente aucun nom de joueur, aucune minute, aucun but.
- Ne dis JAMAIS laquelle des deux équipes prendra le dessus, ni qui est favori. Pas de "devrait l'emporter", "la pression finira par payer", "logiquement", "sur le papier supérieur".
- Les deux équipes reçoivent un traitement ÉQUILIBRÉ : le lecteur ne doit pas pouvoir deviner l'issue.

CE QUE TU DOIS FAIRE :
- Appuie-toi UNIQUEMENT sur les chiffres fournis. N'invente rien.
- Raconte les chiffres, ne les recopie pas bruts.
- Français naturel, aucune liste, aucun titre, aucune puce.`;

/**
 * Ce texte trahit-il le verdict ?
 *
 * Appliqué à TOUTE sortie du modèle, sans exception. Un seul motif reconnu et
 * le texte est jeté : on préfère le gabarit, qui ne peut pas mentir.
 */
export function trahitLeVerdict(texte: string): string | null {
  const t = String(texte ?? '');

  const CONTROLES: [string, RegExp][] = [
    // ── CE QUI BASCULE LE RÉCIT EN PRONOSTIC ────────────────────────────
    //
    // Le récit a le droit de décrire les intentions des deux camps. Il n'a
    // pas le droit de dire lequel prendra le dessus : c'est la décision du
    // propriétaire, et c'est ce qui distingue un avant-goût d'une réponse.
    //
    // Les tournures listées ici sont celles qu'un modèle emploie
    // spontanément quand il croit devoir conclure.
    [
      'une issue annoncée',
      /\b(?:devrait\s+(?:finir\s+par|logiquement)|finir[a]?\s+par\s+(?:payer|porter\s+ses\s+fruits)|prendre\s+le\s+dessus|faire\s+la\s+différence\s+au\s+final|sur\s+le\s+papier\s+supérieur|a\s+les\s+faveurs)\b/i,
    ],
    // ── UN SCORE, PAS UN BILAN ────────────────────────────────────────────
    //
    // Le motif simple attrapait « 1-1-3 », qui est un bilan V-N-D parfaitement
    // légitime dans une bande-annonce. Un garde-fou qui rejette du texte
    // honnête est aussi nuisible qu'un garde-fou qui laisse passer : il fait
    // retomber sur le gabarit sans raison, et l'on croit le modèle défaillant.
    //
    // Les deux vérifications encadrantes écartent tout groupe de trois nombres
    // ou plus — un score n'a que deux termes.
    ['un score', /(?<![\d]\s*[-–—]\s*)\b\d{1,2}\s*[-–—]\s*\d{1,2}\b(?!\s*[-–—]\s*\d)/],
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

/**
 * Les chiffres transmis au modèle — et rien d'autre.
 *
 * ── DEUX PIÈGES, LES MÊMES QUE POUR LE GABARIT ───────────────────────────
 *
 * `goalsScored` compte les buts de TOUTE LA SAISON, pas des cinq derniers
 * matchs. Le diviser par cinq donnait « 11.8 buts par match », affiché tel quel
 * en production. Le bon diviseur est `played`.
 *
 * `winStreak` donne le TOTAL de victoires de la saison, pas une série en cours.
 * Le présenter comme une série a produit « 17 victoires de rang » sous un bilan
 * de 1-1-3. La série réelle se compte sur la forme récente.
 *
 * Transmettre un chiffre faux au modèle, c'est lui demander d'écrire une
 * absurdité avec application.
 */
function resumerForme(nom: string, f?: FormeEquipe): string {
  const m = Array.isArray(f?.recentMatches) ? f!.recentMatches! : [];
  const compte = (l: string) => m.filter((x) => String(x ?? '').toUpperCase().trim().startsWith(l)).length;

  const joues = Math.max(1, Number(f?.played ?? 0) || m.length || 1);
  const pour = Number(f?.goalsScored ?? 0) / joues;
  const contre = Number(f?.goalsConceded ?? 0) / joues;

  // La série RÉELLE : les victoires consécutives depuis le match le plus récent.
  let serie = 0;
  for (const x of m) {
    if (String(x ?? '').toUpperCase().trim().startsWith('W')) serie++;
    else break;
  }

  // Une moyenne au-dessus de 4 buts par match n'existe pas : plutôt que de la
  // transmettre, on la tait. Le modèle écrira sur ce qu'il a.
  const credible = (v: number) => v > 0 && v < 4;

  return [
    `${nom} :`,
    `${compte('W')} victoire(s), ${compte('D')} nul(s), ${compte('L')} défaite(s) sur ses ${m.length || 0} derniers matchs`,
    credible(pour) ? `${pour.toFixed(1)} but(s) marqué(s) par match cette saison` : '',
    credible(contre) ? `${contre.toFixed(1)} encaissé(s) par match` : '',
    Number(f?.cleanSheets ?? 0) > 0 ? `${Number(f!.cleanSheets)} match(s) sans encaisser` : '',
    Number(f?.avgPossession ?? 0) > 0 ? `${Math.round(Number(f!.avgPossession))} % de possession moyenne` : '',
    serie >= 2 ? `série de ${serie} victoires consécutives en cours` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

export interface ResultatApercu {
  /** Le bloc « Résumé rapide » : le décor et l'état des deux équipes. */
  resume: string;
  /** Le bloc « Scénario #1 » : les intentions des deux camps, sans verdict. */
  scenario: string;
  source: 'ia' | 'reserve' | 'gabarit';
  /** Renseigné quand une sortie du modèle a été rejetée. */
  rejet?: string;
}

/**
 * Le scénario de secours, composé mécaniquement.
 *
 * Il décrit ce que chaque équipe va chercher à faire, déduit de ses chiffres —
 * jamais qui va gagner. Volontairement neutre : c'est un filet, pas une
 * prédiction.
 */
function scenarioGabarit(
  nom1: string,
  nom2: string,
  f1?: FormeEquipe,
  f2?: FormeEquipe
): string {
  const intention = (nom: string, f?: FormeEquipe): string | null => {
    const joues = Math.max(1, Number(f?.played ?? 0) || 1);
    const pour = Number(f?.goalsScored ?? 0) / joues;
    const contre = Number(f?.goalsConceded ?? 0) / joues;
    const poss = Number(f?.avgPossession ?? 0);
    const clean = Number(f?.cleanSheets ?? 0);

    if (poss >= 58)
      return `${nom} cherchera à garder le ballon, à étirer le bloc adverse et à installer son jeu dans le camp d'en face`;
    if (poss > 0 && poss <= 43)
      return `${nom} devrait laisser le ballon, se regrouper bas et frapper sur les transitions rapides`;
    if (pour >= 1.8 && pour < 4)
      return `${nom} misera sur son volume offensif et cherchera à peser haut sur la défense adverse`;
    if (contre >= 1.6 && contre < 4)
      return `${nom} devra d'abord resserrer ses lignes avant de songer à se projeter`;
    if (clean >= 3)
      return `${nom} s'appuiera sur la solidité de son bloc pour garder la rencontre fermée`;
    return null;
  };

  // ── JAMAIS LA MÊME PHRASE POUR LES DEUX ─────────────────────────────────
  //
  // Vu en production : « Atalanta BC tentera d'imposer son rythme… De l'autre
  // côté, Sassuolo tentera d'imposer son rythme… ». La formule de repli
  // sortait deux fois dans le même paragraphe, ce qui donne un texte de
  // machine et détruit la crédibilité du reste.
  //
  // Chaque camp a donc son propre repli, et ils sont différents.
  const REPLIS = [
    (n: string) => `${n} tentera d'imposer son rythme dès l'entame`,
    (n: string) => `${n} s'appuiera sur ses points forts du moment pour exister dans le jeu`,
  ];

  const i1 = intention(nom1, f1) ?? REPLIS[0](nom1);
  let i2 = intention(nom2, f2) ?? REPLIS[1](nom2);
  // Deux équipes au profil identique produiraient la même phrase : on décale.
  if (i2 === i1.replace(nom1, nom2)) i2 = REPLIS[1](nom2);

  return [
    `${i1}.`,
    `De l'autre côté, ${i2.charAt(0).toLowerCase()}${i2.slice(1)}.`,
    `La rencontre se jouera sur la capacité de chacun à imposer son plan et à contrarier celui d'en face.`,
  ].join(' ');
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
  forme2?: FormeEquipe,
  contexte?: { competition?: string | null; stade?: string | null }
): Promise<ResultatApercu> {
  // Le filet : les deux mêmes blocs, composés mécaniquement. Sûrs par
  // construction — aucune de ces phrases ne peut contenir un chiffre du
  // verdict, puisque le verdict n'entre pas dans leur composition.
  const gabarit = (): ResultatApercu => ({
    resume: composerApercu(nom1, nom2, forme1, forme2, contexte),
    scenario: scenarioGabarit(nom1, nom2, forme1, forme2),
    source: 'gabarit',
  });
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
        ` | ${r.resume.length}+${r.scenario.length} caractères`
    );
    return r;
  };

  // ── UNE SEULE GÉNÉRATION PAR MATCH ───────────────────────────────────────
  try {
    const enBase = await lireReserve<{ resume: string; scenario: string }>(cle);
    if (enBase && !enBase.expiree && enBase.contenu?.resume && enBase.contenu?.scenario)
      return tracer({ ...enBase.contenu, source: 'reserve' }, 'aucun appel payé');
  } catch (e: any) {
    console.warn(`[APERÇU] ${affiche} | réserve illisible (${e?.message}) — on régénère.`);
  }

  // La cause n°1 observée en production : la clé n'est pas lue côté serveur.
  // On le DIT, au lieu de retomber silencieusement sur le gabarit.
  if (!openRouterDisponible())
    return tracer(gabarit(), 'CAUSE=OPENROUTER_API_KEY absente de l’environnement serveur');

  const decor = [contexte?.competition, contexte?.stade].filter(Boolean).join(", ");
  const invite = [
    `Match : ${nom1} recoit ${nom2}${decor ? ` (${decor})` : ""}.`,
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

    // Le modèle rend deux paragraphes séparés par une ligne de tirets.
    const morceaux = String(brut ?? '').split(/^\s*-{3,}\s*$/m);
    const propre = (s: string) =>
      String(s ?? '')
        .replace(/^["'«\s]+|["'»\s]+$/g, '')
        .replace(/\s*\n+\s*/g, ' ')
        .trim();

    const resume = propre(morceaux[0]);
    const scenario = propre(morceaux[1] ?? '');

    // Deux paragraphes attendus. Un seul veut dire que le format n'a pas été
    // suivi — et un bloc « Scénario » vide serait pire que pas de bloc du tout,
    // c'est exactement ce qu'on vient de corriger côté affichage.
    const faute = !scenario
      ? 'format à deux paragraphes non respecté'
      : trahitLeVerdict(`${resume} ${scenario}`);

    if (faute) {
      // On ne réessaie pas : un second appel coûterait autant et rien ne dit
      // qu'il ferait mieux. Le gabarit, lui, est sûr.
      //
      // Le texte rejeté est journalisé en entier : c'est la seule façon de
      // resserrer la consigne plutôt que de deviner ce que le modèle écrit.
      console.warn(
        `[APERÇU] ${affiche} | REJETÉ (${faute}) | texte reçu : « ${`${resume} ${scenario}`.slice(0, 300)} »`
      );
      return tracer({ ...gabarit(), rejet: faute }, `${Date.now() - debut} ms`);
    }

    const contenu = { resume, scenario };
    void ecrireReserve(cle, contenu, TTL);
    return tracer({ ...contenu, source: 'ia' }, `${Date.now() - debut} ms | mis en réserve ${TTL / 3600000} h`);
  } catch (e: any) {
    clearTimeout(minuteur);
    const cause =
      e?.name === 'AbortError'
        ? `délai de ${DELAI_MS} ms dépassé`
        : `${e?.status ? `HTTP ${e.status} — ` : ''}${e?.message ?? 'erreur inconnue'}`;
    console.error(`[APERÇU] ${affiche} | ÉCHEC DE L'APPEL | CAUSE=${cause} | ${Date.now() - debut} ms`);
    return tracer(gabarit(), `cause : ${cause}`);
  }
}
