/**
 * LES CINQ CAMPAGNES.
 *
 * ── CE QU'ELLES RÉPARENT ──────────────────────────────────────────────────
 *
 * Mesuré le 1er septembre 2026, sur trois semaines de vie réelle :
 *
 *     77 %   des gens qui essaient l'application ne viennent QU'UN SEUL JOUR
 *      9 %   sont encore là au bout d'une semaine
 *    2,9     jours d'usage moyen d'un abonné, sur trente de quota
 *   11,6 %   de réachat
 *
 * Ce ne sont pas cinq idées de marketing. Ce sont cinq réponses à un seul
 * défaut : l'application ne parle jamais la première. Elle attend qu'on vienne,
 * et 91 % des gens ne reviennent pas.
 *
 * ── DEUX FAMILLES, ET ELLES NE SE RESSEMBLENT PAS ─────────────────────────
 *
 * TROIS QUOTIDIENNES — matin, soir, réveil — qui construisent une habitude.
 * Elles tournent toutes seules, tous les jours, sur un public restreint.
 *
 * DEUX DE RATTRAPAGE — les 5 052 non-payeurs et les 1 711 jamais-essayé. Elles
 * s'adressent une fois à des gens partis depuis longtemps, par paliers, et
 * s'arrêtent définitivement quand la liste est épuisée.
 *
 * ── CE QUE CHAQUE MESSAGE DOIT AVOIR ──────────────────────────────────────
 *
 * Une raison d'exister ce jour-là, un seul lien, et rien qui ressemble à une
 * publicité. Le pied de désinscription est ajouté par la diffusion : ne pas le
 * remettre ici.
 */

import { diffuser, type BilanDiffusion, type Destinataire } from './diffusion';
import {
  lireTerrain,
  nonPayeurs,
  jamaisEssaye,
  resultatsDuSoir,
  abonnesDormants,
  publicDuMatin,
  type ResultatDuJour,
  type Terrain,
} from './publics';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com').replace(/\/+$/, '');
}

/** Le jour courant, pour les campagnes quotidiennes. */
const jour = () => new Date().toISOString().slice(0, 10);

/**
 * La semaine courante, pour le réveil des dormants.
 *
 * Le réveil est quotidien dans son déclenchement mais hebdomadaire dans son
 * effet : la clé de campagne porte la semaine, donc une même personne ne peut
 * pas être réveillée deux fois en sept jours, quel que soit le nombre de
 * passages.
 */
function semaine(): string {
  const d = new Date();
  const debut = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const jours = Math.floor((d.getTime() - debut.getTime()) / 86_400_000);
  return `${d.getUTCFullYear()}-S${String(Math.ceil((jours + debut.getUTCDay() + 1) / 7)).padStart(2, '0')}`;
}

/**
 * ── LA MENTION QUI DIT CE QU'ON VEND, ET CE QU'ON NE VEND PAS ─────────────
 *
 * Le 5 septembre 2026, un membre répond au message du matin : « Oui mais je
 * commence trop à perdre de l'argent il faut améliorer vos analyses. » Il
 * venait de prendre l'accès annuel trois jours plus tôt.
 *
 * Ce que sa phrase établit par écrit, c'est qu'il engage de l'argent sur nos
 * analyses. Or ce projet a perdu sa boutique en août 2026 sur un contrôle
 * « produits interdits : paris sportifs, jeux de hasard », et un échange
 * pareil est exactement la pièce qui déclenche le suivant.
 *
 * Cette mention n'est pas une formule pour se couvrir. Elle dit la vérité de
 * ce qui est vendu — une lecture statistique — et elle est ce qui permet de
 * le démontrer, message après message, à quiconque le demanderait.
 *
 * Elle vit ICI, collée à la signature, parce que les cinq campagnes
 * l'empruntent : aucune ne peut partir sans elle, et une sixième l'aura
 * d'office.
 */
const MENTION =
  "ProFoot AI est un outil d'analyse statistique du football. Nos analyses " +
  'décrivent des tendances mesurées sur les rencontres passées ; elles ne ' +
  'garantissent aucun résultat.';

const SIGNATURE = ['', 'Ousmane', 'ProFoot AI — profootai.com', '', MENTION];

// ═══════════════════════════════════════════════════════════════════════════
// LES MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ① LE SOIR — « vous aviez raison ».
 *
 * Le seul message des cinq qui ne demande rien. Il annonce un résultat, et
 * c'est tout. C'est précisément ce qui le rend efficace : la personne l'ouvre
 * parce qu'il parle d'elle, pas de nous.
 */
function messageDuSoir(d: Destinataire) {
  const resultats = (d.contexte?.resultats ?? []) as ResultatDuJour[];
  if (!resultats.length) return null;

  const exacts = resultats.filter((r) => r.scoreCorrect);
  const premier = resultats[0];

  const lignes = resultats.slice(0, 6).map((r) => {
    const score = r.reel ? ` — ${r.reel}` : '';
    const marque = r.scoreCorrect ? '  ← score exact' : '';
    return `  • ${r.equipe1} – ${r.equipe2}${score}${marque}`;
  });

  // Le sujet porte le fait, pas l'invitation. « Vous aviez raison » se lit dans
  // la liste des messages non ouverts et donne envie d'ouvrir ; « Découvrez nos
  // analyses » se lit comme une publicité et se supprime sans être lu.
  const sujet = exacts.length
    ? `Score exact : ${premier.equipe1} – ${premier.equipe2} ${premier.reel ?? ''}`.trim()
    : resultats.length > 1
      ? `${resultats.length} analyses justes pour vous aujourd'hui`
      : `Analyse juste : ${premier.equipe1} – ${premier.equipe2}`;

  return {
    sujet,
    texte: [
      'Bonjour,',
      '',
      resultats.length > 1
        ? `${resultats.length} des matchs que vous avez analysés se sont terminés comme annoncé :`
        : `Le match que vous avez analysé s'est terminé comme annoncé :`,
      '',
      ...lignes,
      '',
      exacts.length
        ? `Le score exact${exacts.length > 1 ? ' de ' + exacts.length + ' rencontres' : ''} est tombé pile — c'est le résultat le plus difficile à obtenir, et c'est arrivé aujourd'hui.`
        : `Le vainqueur était le bon. Le score exact reste plus rare : sur l'ensemble des rencontres vérifiées, il tombe une fois sur sept.`,
      '',
      `Les matchs de demain sont déjà analysables :`,
      `${siteUrl()}/analyze`,
      ...SIGNATURE,
    ].join('\n'),
  };
}

/**
 * ② LE MATIN — ce qui se joue aujourd'hui.
 *
 * Fabriqué UNE FOIS pour tout le monde : la liste des matchs du jour est la
 * même pour les huit cents destinataires, et la recalculer par personne
 * appellerait huit cents fois le fournisseur de données.
 */
function fabriqueMessageDuMatin(matchs: { dom: string; ext: string; heure: string }[]) {
  return (d: Destinataire) => {
    if (!matchs.length) return null;
    const abonne = !!d.contexte?.abonne;

    const lignes = matchs.slice(0, 8).map((m) => `  • ${m.heure}  ${m.dom} – ${m.ext}`);

    return {
      sujet:
        matchs.length > 1
          ? `${matchs.length} matchs à analyser aujourd'hui`
          : `${matchs[0].dom} – ${matchs[0].ext} aujourd'hui`,
      texte: [
        'Bonjour,',
        '',
        "Voici ce qui se joue aujourd'hui dans les grands championnats :",
        '',
        ...lignes,
        '',
        abonne
          ? "Votre accès est ouvert : lancez l'analyse avant le coup d'envoi."
          : "Chaque analyse est publiée avant le coup d'envoi, puis confrontée au résultat réel.",
        '',
        `${siteUrl()}/analyze`,
        ...SIGNATURE,
      ].join('\n'),
    };
  };
}

/**
 * ③ LE RÉVEIL — l'abonné qui ne vient plus.
 *
 * ── IL NE FAUT SURTOUT PAS LUI VENDRE QUELQUE CHOSE ─────────────────────
 *
 * Il a déjà payé. Le message lui rappelle ce qu'il POSSÈDE et qui va expirer,
 * jamais ce qu'il pourrait acheter. Une relance commerciale envoyée à un client
 * en cours d'abonnement est la meilleure façon de lui apprendre qu'il paie pour
 * quelque chose dont il se passe très bien.
 */
function messageDeReveil(d: Destinataire) {
  const jours = d.contexte?.joursSansVenir as number | null;
  const expireLe = d.contexte?.expireLe as string | null;

  const echeance = expireLe
    ? new Date(expireLe).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      })
    : null;

  return {
    sujet: echeance
      ? `Votre accès ProFoot court jusqu'au ${echeance}`
      : 'Votre accès ProFoot vous attend',
    texte: [
      'Bonjour,',
      '',
      jours
        ? `Vous n'avez pas lancé d'analyse depuis ${jours} jours, et votre accès est toujours ouvert${echeance ? ` jusqu'au ${echeance}` : ''}.`
        : `Votre accès est ouvert${echeance ? ` jusqu'au ${echeance}` : ''} et vous ne l'avez pas encore utilisé cette semaine.`,
      '',
      "Ce n'est pas une relance commerciale : vous avez déjà payé, et les analyses que vous n'utilisez pas ne se reportent pas au mois suivant.",
      '',
      "Les matchs du jour sont prêts à être analysés :",
      `${siteUrl()}/analyze`,
      '',
      'Et si quelque chose vous a bloqué — un écran, une erreur, une équipe introuvable — répondez à ce message. C’est utile, et ça se corrige.',
      ...SIGNATURE,
    ].join('\n'),
  };
}

/**
 * ④ LES NON-PAYEURS — 5 052 personnes qui ont essayé et n'ont rien reçu depuis.
 *
 * ── LE MESSAGE PORTE LA PREUVE, PAS L'ARGUMENT ──────────────────────────
 *
 * Ces gens ont vu 15 % d'une analyse et un mur de paiement. Leur répéter que
 * l'application est bonne ne pèse rien : ils l'ont déjà entendu, et ils sont
 * partis.
 *
 * Ce qui a changé depuis, et qui vaut la peine d'être annoncé, tient en deux
 * faits : leur première analyse complète est maintenant offerte, et le mur des
 * preuves est public — 288 rencontres annoncées avant le coup d'envoi et
 * confrontées au résultat. Le second se vérifie sans nous croire sur parole.
 */
function messageNonPayeurs(_d: Destinataire) {
  return {
    sujet: 'Votre première analyse complète est offerte',
    texte: [
      'Bonjour,',
      '',
      "Vous avez essayé ProFoot AI, et vous n'avez vu qu'un aperçu : l'analyse complète était réservée aux abonnés. C'était une erreur de notre part — on vous demandait d'acheter quelque chose que vous n'aviez jamais pu regarder.",
      '',
      "C'est corrigé. Votre première analyse complète est désormais offerte : scénarios, statistiques avancées, score annoncé, indice de confiance. Entière, sans rien de flouté.",
      '',
      `${siteUrl()}/analyze`,
      '',
      'ET SI VOUS PRÉFÉREZ VÉRIFIER AVANT',
      '',
      "Toutes nos analyses sont publiées avant le coup d'envoi, puis confrontées au résultat réel du match. La liste est publique, avec les dates et les scores :",
      '',
      `${siteUrl()}/preuves`,
      '',
      "Sur 1 995 rencontres vérifiées, le vainqueur annoncé était le bon dans 56 % des cas, et le score exact est tombé pile 14 fois sur 100. Ce sont nos vrais chiffres, pas des chiffres choisis — vous pouvez les recompter un par un sur cette page.",
      ...SIGNATURE,
    ].join('\n'),
  };
}

/**
 * ⑤ LES JAMAIS-ESSAYÉ — 1 711 comptes créés, aucune analyse lancée.
 *
 * ── LE MESSAGE DOIT SUPPOSER QUE QUELQUE CHOSE A BLOQUÉ ─────────────────
 *
 * Quelqu'un qui crée un compte a déjà dit oui. S'il n'a pas essayé, ce n'est
 * pas qu'il a changé d'avis en trente secondes : c'est qu'il n'a pas su quoi
 * faire de l'écran, ou qu'il est parti chercher un mot de passe. Le message
 * l'accompagne au premier geste au lieu de lui vendre à nouveau ce qu'il a
 * déjà accepté.
 */
function messageJamaisEssaye(_d: Destinataire) {
  return {
    sujet: 'Votre compte ProFoot est prêt — il ne manque qu’un match',
    texte: [
      'Bonjour,',
      '',
      "Vous avez créé votre compte sur ProFoot AI, mais vous n'avez encore lancé aucune analyse. C'est souvent qu'on ne sait pas par où commencer.",
      '',
      "EN TROIS GESTES",
      '',
      '  1. Ouvrez la page d’analyse',
      '  2. Choisissez un match du jour — ils sont déjà proposés à l’écran',
      '  3. Lancez l’analyse',
      '',
      "Votre première analyse complète est offerte : scénarios, statistiques avancées, score annoncé, indice de confiance.",
      '',
      `${siteUrl()}/analyze`,
      '',
      "Si c'est le mot de passe qui bloque, la page « Mot de passe oublié » vous en redonne un en une minute, avec l'adresse à laquelle vous lisez ce message.",
      '',
      'Et si autre chose vous a arrêté, répondez simplement à ce message.',
      ...SIGNATURE,
    ].join('\n'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LE REGISTRE
// ═══════════════════════════════════════════════════════════════════════════

export type NomCampagne =
  | 'soir'
  | 'matin'
  | 'reveil'
  | 'non-payeurs'
  | 'jamais-essaye';

export const CAMPAGNES: NomCampagne[] = [
  'soir',
  'matin',
  'reveil',
  'non-payeurs',
  'jamais-essaye',
];

/**
 * Exécute une campagne.
 *
 * `limite` plafonne ce passage. Les deux campagnes de rattrapage s'appellent
 * plusieurs fois : chaque passage reprend là où le précédent s'est arrêté,
 * puisque la mémoire est tenue en base et non dans le programme.
 */
export async function lancerCampagne(
  nom: NomCampagne,
  options: { limite?: number; simulation?: boolean } = {}
): Promise<BilanDiffusion> {
  // Les campagnes du jour n'ont besoin que d'une fenêtre courte ; celles de
  // rattrapage doivent voir tout l'historique pour savoir qui a déjà essayé.
  const fenetre = nom === 'non-payeurs' || nom === 'jamais-essaye' ? 120 : 10;
  const terrain: Terrain = await lireTerrain(fenetre);

  switch (nom) {
    case 'soir':
      return diffuser({
        campagne: `soir-${jour()}`,
        destinataires: resultatsDuSoir(terrain),
        message: messageDuSoir,
        limite: options.limite ?? 400,
        simulation: options.simulation,
      });

    case 'matin': {
      // La liste du jour est lue UNE fois, pas une par destinataire.
      const { matchsDuJour } = await import('../grands-matchs-du-jour');
      const liste = await matchsDuJour().catch(() => ({ matchs: [], aujourdhui: false }));
      const matchs = (liste.aujourdhui ? liste.matchs : []).map((m) => ({
        dom: m.dom.name,
        ext: m.ext.name,
        heure: new Date(m.kickoffISO).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }),
      }));

      return diffuser({
        campagne: `matin-${jour()}`,
        destinataires: publicDuMatin(terrain),
        message: fabriqueMessageDuMatin(matchs),
        limite: options.limite ?? 400,
        simulation: options.simulation,
      });
    }

    case 'reveil':
      return diffuser({
        campagne: `reveil-${semaine()}`,
        destinataires: abonnesDormants(terrain),
        message: messageDeReveil,
        limite: options.limite ?? 150,
        simulation: options.simulation,
      });

    case 'non-payeurs':
      return diffuser({
        campagne: 'non-payeurs',
        destinataires: nonPayeurs(terrain),
        message: messageNonPayeurs,
        limite: options.limite ?? 100,
        simulation: options.simulation,
      });

    case 'jamais-essaye':
      return diffuser({
        campagne: 'jamais-essaye',
        destinataires: jamaisEssaye(terrain),
        message: messageJamaisEssaye,
        limite: options.limite ?? 100,
        simulation: options.simulation,
      });
  }
}
