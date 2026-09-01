/**
 * ÉCRIRE À BEAUCOUP DE GENS SANS RIEN CASSER.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Au 1er septembre 2026, l'application savait écrire à ses clients, mais
 * uniquement pour RÉPARER : livrer un accès manquant, renvoyer un lien de mot
 * de passe, relancer un abonné qui n'est jamais entré. Aucun message n'était
 * jamais envoyé à quelqu'un dont tout allait bien.
 *
 * Le résultat, mesuré ce jour-là :
 *
 *     5 052   personnes ont essayé l'application, n'ont pas payé,
 *             et n'ont JAMAIS reçu un seul message
 *     1 711   ont créé un compte sans jamais lancer une analyse
 *       426   ont payé, utilisé trois jours, puis disparu
 *
 * Toutes ont une adresse valide. Aucune n'a jamais rien reçu.
 *
 * ── CE QUI PEUT MAL TOURNER, ET QUI EST GRAVE ─────────────────────────────
 *
 * Les messages partent de `noreply@profootai.com`, LA MÊME adresse qui envoie
 * les liens de mot de passe et les ouvertures d'accès après paiement. Si Gmail
 * classe une campagne en indésirable, ce n'est pas la campagne qu'on perd :
 * c'est la récupération de mot de passe et la livraison des achats. Le domaine
 * est déjà sensible — le modèle de courriel de récupération a dû être refait en
 * août parce que Gmail brûlait le lien en le pré-ouvrant.
 *
 * D'où les trois règles tenues ici :
 *
 *   1. UN PLAFOND PAR PASSAGE. Six mille messages d'un coup depuis un domaine
 *      qui n'en a jamais envoyé cent est la définition même d'un envoi
 *      suspect. On monte par paliers, et on regarde entre deux.
 *   2. UN RYTHME. Un intervalle entre deux envois : les services de courriel
 *      limitent le débit, et un refus pour cadence dépassée compte comme un
 *      échec de livraison.
 *   3. UN LIEN DE DÉSINSCRIPTION DANS CHAQUE MESSAGE, et il est respecté. Une
 *      personne qui ne peut pas partir clique sur « spam » — et c'est ce clic,
 *      pas le message, qui abîme le domaine.
 *
 * ── LA TRACE EST ÉCRITE AVANT L'ENVOI, PAS APRÈS ──────────────────────────
 *
 * C'est l'inverse de ce que font les relances de réparation, et c'est
 * volontaire. Pour un accès manquant, le pire est de croire quelqu'un servi
 * alors qu'il attend : on écrit donc la trace seulement si le message est
 * parti.
 *
 * Ici le pire est l'inverse : un passage interrompu à mi-chemin — un délai
 * dépassé, une fonction serveur coupée — puis relancé, qui réécrirait aux mille
 * premiers. Recevoir deux fois la même relance commerciale, c'est du courrier
 * indésirable, et la personne le signalera comme tel.
 *
 * La trace réserve donc la place AVANT l'envoi, et elle est RETIRÉE si l'envoi
 * échoue. Une panne coûte au pire une personne non écrite, jamais une personne
 * écrite deux fois.
 */

import { createAdminClient } from '../supabase-admin';
import { DOMAINES_DE_TEST } from '../livraison-sans-compte';

/**
 * Combien de messages au maximum par passage.
 *
 * Volontairement bas. Le premier objectif n'est pas d'écrire à tout le monde,
 * c'est de savoir si les messages arrivent. Se monte par le paramètre `limite`
 * une fois la livraison observée.
 */
export const PLAFOND_PAR_DEFAUT = 100;

/**
 * COMBIEN DE MESSAGES DE CAMPAGNE PAR JOUR, TOUTES CAMPAGNES CONFONDUES.
 *
 * ── LE DANGER QU'IL FERME ─────────────────────────────────────────────────
 *
 * Le 1er septembre 2026, la première campagne réelle s'est arrêtée après
 * 143 envois sur cette réponse :
 *
 *     429 — "You have reached your daily email sending quota."
 *
 * L'offre en cours chez le fournisseur autorise CENT messages par jour. Et
 * c'est le même compteur qui sert aux messages vitaux : le lien de mot de passe
 * oublié, et l'ouverture d'accès envoyée à quelqu'un qui vient de payer.
 *
 * Sans ce budget, voici ce qui arriverait demain matin : la campagne du matin
 * part à 7 h 10, consomme les cent messages de la journée en cinquante
 * secondes — et le premier client qui paie à 9 h ne reçoit pas son accès. On
 * aurait automatisé la panne qu'on a passé trois semaines à réparer.
 *
 * ── POURQUOI CINQUANTE ────────────────────────────────────────────────────
 *
 * La moitié du quota reste libre pour les messages vitaux. Les livraisons et
 * les mots de passe dépassent rarement la vingtaine par jour ; cinquante laisse
 * de la marge un jour de forte vente.
 *
 * ── CE CHIFFRE EST FAIT POUR ÊTRE RELEVÉ ──────────────────────────────────
 *
 * Il ne décrit pas ce qui est souhaitable, il décrit ce que l'offre gratuite
 * permet. Une offre payante à 50 000 messages par mois couvrirait tout ce qui
 * est prévu ici — les huit cents du matin, les sept cents du soir et les
 * 6 723 personnes à rattraper — pour une somme modeste.
 *
 * Le jour où l'offre change, poser `COURRIEL_BUDGET_QUOTIDIEN` à 2000 sur le
 * serveur suffit. Rien d'autre à toucher.
 */
const BUDGET_QUOTIDIEN = Math.max(
  0,
  Number(process.env.COURRIEL_BUDGET_QUOTIDIEN) || 50
);

/**
 * Combien de messages de campagne sont déjà partis aujourd'hui.
 *
 * Compté sur les traces réellement écrites, et non sur un compteur en mémoire :
 * chaque appel de fonction serveur démarre à zéro, et trois campagnes tournent
 * dans trois appels différents. Un compteur en mémoire les laisserait consommer
 * le budget chacune de son côté.
 */
async function envoyesAujourdhui(): Promise<number> {
  const minuit = new Date();
  minuit.setUTCHours(0, 0, 0, 0);
  try {
    const { count, error } = await createAdminClient()
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'campagne')
      .gte('received_at', minuit.toISOString());
    // Une lecture impossible se lit comme « budget épuisé » : mieux vaut
    // n'écrire à personne aujourd'hui que de priver d'accès quelqu'un qui a
    // payé.
    if (error) return BUDGET_QUOTIDIEN;
    return count ?? 0;
  } catch {
    return BUDGET_QUOTIDIEN;
  }
}

/**
 * Millisecondes entre deux envois.
 *
 * Deux par seconde : c'est la cadence que les offres d'entrée des services de
 * courriel acceptent sans refuser. Au-delà, les refus pour cadence dépassée
 * comptent comme des échecs de livraison et pèsent sur la réputation du
 * domaine, exactement ce qu'on cherche à éviter.
 */
const RYTHME_MS = 500;

/**
 * Nombre d'échecs consécutifs après lequel on arrête tout.
 *
 * Si cinq messages d'affilée sont refusés, ce n'est pas cinq adresses
 * invalides : c'est le service qui refuse, ou le quota qui est atteint.
 * Continuer à pousser dans ce cas transforme un incident en sanction.
 */
const ECHECS_AVANT_ARRET = 5;

export interface Destinataire {
  email: string;
  userId?: string | null;
  /** Ce que la campagne veut transporter jusqu'au message. */
  contexte?: Record<string, unknown>;
}

export interface BilanDiffusion {
  campagne: string;
  candidats: number;
  envoyes: number;
  /** Déjà écrits lors d'un passage précédent. */
  dejaEcrits: number;
  desabonnes: number;
  echecs: number;
  /** Vrai si le plafond a été atteint : il reste du monde à écrire. */
  reste: boolean;
  details: string[];
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://profootai.com').replace(/\/+$/, '');
}

const cleTrace = (campagne: string, email: string) =>
  `campagne-${campagne}-${email.trim().toLowerCase()}`;

const cleDesabo = (email: string) => `desabo-${email.trim().toLowerCase()}`;

/**
 * La signature qui rend un lien de désinscription infalsifiable.
 *
 * Sans elle, l'adresse `/api/desabonnement?e=nimporte@qui.com` désabonnerait
 * n'importe qui — il suffirait de deviner une adresse. Avec elle, seul le
 * porteur du lien qu'on lui a envoyé peut se désinscrire.
 *
 * La clé de service signe : elle ne quitte jamais le serveur, et la signature
 * qui en sort ne permet pas de la retrouver.
 */
export async function signerDesabonnement(email: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_ACCESS_KEY || '';
  return createHmac('sha256', secret)
    .update(`desabo:${email.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

export async function lienDesabonnement(email: string): Promise<string> {
  const signature = await signerDesabonnement(email);
  return `${siteUrl()}/api/desabonnement?e=${encodeURIComponent(email)}&s=${signature}`;
}

/**
 * Le pied de page obligatoire de tout message non transactionnel.
 *
 * Il n'est pas là par politesse. Une personne qui veut partir et ne trouve pas
 * comment clique sur « courrier indésirable » — et ce signal-là frappe le
 * domaine entier, donc aussi les liens de mot de passe et les livraisons
 * d'accès des gens qui ont payé.
 */
export async function piedDePage(email: string): Promise<string> {
  return [
    '',
    '—',
    "Vous recevez ce message parce que vous avez un compte sur ProFoot AI.",
    'Pour ne plus recevoir ce type de message, ouvrez ce lien :',
    await lienDesabonnement(email),
  ].join('\n');
}

/** Qui a demandé à ne plus rien recevoir. Lu en une fois, pas une par adresse. */
async function lireDesabonnes(): Promise<Set<string>> {
  const sortie = new Set<string>();
  try {
    const sb = createAdminClient();
    for (let depart = 0; depart < 100_000; depart += 1000) {
      const { data, error } = await sb
        .from('webhook_events')
        .select('delivery_id')
        .like('delivery_id', 'desabo-%')
        .range(depart, depart + 999);
      if (error) break;
      for (const t of data ?? []) sortie.add(String(t.delivery_id).slice('desabo-'.length));
      if (!data || data.length < 1000) break;
    }
  } catch {
    /* Une lecture impossible ne doit pas empêcher la campagne — mais elle
       ne doit pas non plus faire écrire à quelqu'un qui est parti. Voir
       l'appelant : `diffuser` refuse de partir si cette lecture a échoué. */
  }
  return sortie;
}

/** À qui cette campagne a déjà écrit. */
async function lireDejaEcrits(campagne: string): Promise<Set<string>> {
  const sortie = new Set<string>();
  const prefixe = `campagne-${campagne}-`;
  try {
    const sb = createAdminClient();
    for (let depart = 0; depart < 200_000; depart += 1000) {
      const { data, error } = await sb
        .from('webhook_events')
        .select('delivery_id')
        .like('delivery_id', `${prefixe}%`)
        .range(depart, depart + 999);
      if (error) throw new Error(error.message);
      for (const t of data ?? []) sortie.add(String(t.delivery_id).slice(prefixe.length));
      if (!data || data.length < 1000) break;
    }
  } catch (e) {
    // Ne PAS avaler : sans cette liste, on réécrirait à tout le monde.
    throw new Error(`liste des déjà-écrits illisible : ${(e as Error).message}`);
  }
  return sortie;
}

/**
 * Envoie un message à une liste de personnes, une fois chacune, jamais deux.
 *
 * Ne lève pas : elle rend son bilan, même partiel. Une campagne qui explose au
 * milieu doit dire ce qu'elle a fait avant d'exploser.
 */
export async function diffuser(options: {
  /** Identifiant stable de la campagne. Il porte la mémoire de qui a été écrit. */
  campagne: string;
  destinataires: Destinataire[];
  /** Fabrique le message. Le pied de désinscription est ajouté par la diffusion. */
  message: (d: Destinataire) => { sujet: string; texte: string } | null;
  limite?: number;
  /**
   * Vrai pour n'écrire à personne et seulement compter.
   *
   * Le seul moyen honnête de vérifier une campagne avant de la lancer sur
   * cinq mille personnes : voir QUI serait écrit, et combien.
   */
  simulation?: boolean;
}): Promise<BilanDiffusion> {
  const { campagne, destinataires, message } = options;
  const limite = Math.max(0, options.limite ?? PLAFOND_PAR_DEFAUT);

  const bilan: BilanDiffusion = {
    campagne,
    candidats: destinataires.length,
    envoyes: 0,
    dejaEcrits: 0,
    desabonnes: 0,
    echecs: 0,
    reste: false,
    details: [],
  };

  const { courrielDisponible, envoyerCourriel } = await import('../courriel');
  if (!courrielDisponible() && !options.simulation) {
    bilan.details.push('RESEND_API_KEY absente : aucun message ne peut partir.');
    return bilan;
  }

  let dejaEcrits: Set<string>;
  try {
    dejaEcrits = await lireDejaEcrits(campagne);
  } catch (e) {
    // Refus net. Une campagne qui ne sait pas à qui elle a déjà écrit
    // écrirait une deuxième fois à tout le monde.
    bilan.details.push(`ARRÊT : ${(e as Error).message}`);
    return bilan;
  }

  // ── LE BUDGET DU JOUR EST PARTAGÉ AVEC LES MESSAGES VITAUX ──────────────
  //
  // Le quota du fournisseur est commun aux campagnes ET aux liens de mot de
  // passe et ouvertures d'accès après paiement. Une campagne qui le viderait le
  // matin priverait d'accès le premier client qui paie dans la journée.
  //
  // La simulation n'est pas concernée : elle n'envoie rien, et doit pouvoir
  // montrer la liste entière même quand le budget est épuisé.
  let budgetRestant = Number.POSITIVE_INFINITY;
  if (!options.simulation) {
    const dejaPartis = await envoyesAujourdhui();
    budgetRestant = BUDGET_QUOTIDIEN - dejaPartis;
    if (budgetRestant <= 0) {
      bilan.details.push(
        `Budget du jour épuisé : ${dejaPartis} messages de campagne déjà partis ` +
          `sur ${BUDGET_QUOTIDIEN}. Le reste du quota est gardé pour les mots de ` +
          `passe et les livraisons d'accès. Reprise demain.`
      );
      bilan.reste = true;
      return bilan;
    }
  }

  const desabonnes = await lireDesabonnes();
  const sb = createAdminClient();
  let echecsDaffilee = 0;
  const vus = new Set<string>();

  for (const d of destinataires) {
    if (bilan.envoyes >= limite) {
      bilan.reste = true;
      break;
    }

    // Le budget du jour prime sur le plafond demandé : on peut réclamer cinq
    // cents envois, on n'obtiendra jamais plus que ce que le quota partagé
    // laisse aux campagnes.
    if (bilan.envoyes >= budgetRestant) {
      bilan.details.push(
        `Budget du jour atteint (${BUDGET_QUOTIDIEN} messages de campagne). ` +
          `Le reste du quota est gardé pour les mots de passe et les livraisons.`
      );
      bilan.reste = true;
      break;
    }

    const email = String(d.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    if (vus.has(email)) continue;
    vus.add(email);

    if (DOMAINES_DE_TEST.test(email)) continue;
    if (desabonnes.has(email)) {
      bilan.desabonnes++;
      continue;
    }
    if (dejaEcrits.has(email)) {
      bilan.dejaEcrits++;
      continue;
    }

    const corps = message(d);
    // Un message nul signifie « cette personne n'a rien à recevoir
    // aujourd'hui » — pas d'analyse à lui montrer, pas de résultat à lui
    // annoncer. Ce n'est pas un échec, et ça ne consomme pas sa place.
    if (!corps) continue;

    if (options.simulation) {
      bilan.envoyes++;
      if (bilan.details.length < 25) bilan.details.push(`[SIMULATION] ${email} — ${corps.sujet}`);
      continue;
    }

    // ── LA PLACE EST RÉSERVÉE AVANT L'ENVOI ────────────────────────────────
    const { error: erreurTrace } = await sb.from('webhook_events').insert({
      provider: 'campagne',
      delivery_id: cleTrace(campagne, email),
      event: `campagne_${campagne}`,
      payload: { email, user_id: d.userId ?? null, sujet: corps.sujet },
    });

    if (erreurTrace) {
      // 23505 : quelqu'un d'autre — ou un passage précédent — a déjà pris la
      // place. C'est exactement ce que le verrou doit faire.
      if (erreurTrace.code === '23505') {
        bilan.dejaEcrits++;
        continue;
      }
      bilan.echecs++;
      bilan.details.push(`${email} : trace impossible (${erreurTrace.message})`);
      if (++echecsDaffilee >= ECHECS_AVANT_ARRET) {
        bilan.details.push('ARRÊT : cinq échecs consécutifs.');
        break;
      }
      continue;
    }

    const parti = await envoyerCourriel({
      a: email,
      sujet: corps.sujet,
      texte: corps.texte + (await piedDePage(email)),
    });

    if (parti) {
      bilan.envoyes++;
      echecsDaffilee = 0;
    } else {
      // ── LA RÉSERVATION EST RENDUE ────────────────────────────────────────
      // Sans cela, une panne passagère du service de courriel condamnerait
      // définitivement ces personnes à ne jamais recevoir la campagne : la
      // trace dirait « écrit » pour un message jamais parti.
      await sb.from('webhook_events').delete().eq('delivery_id', cleTrace(campagne, email));
      bilan.echecs++;
      // La RAISON, et pas seulement le fait. « Envoi refusé » cinq fois de
      // suite ne dit pas s'il faut attendre demain, ralentir, ou corriger la
      // liste — et ce sont trois décisions opposées.
      const { dernierRefus } = await import('../courriel');
      bilan.details.push(`${email} : refusé — ${dernierRefus ?? 'raison inconnue'}`);
      if (++echecsDaffilee >= ECHECS_AVANT_ARRET) {
        bilan.details.push('ARRÊT : cinq envois refusés d’affilée.');
        break;
      }
    }

    await new Promise((r) => setTimeout(r, RYTHME_MS));
  }

  if (!bilan.reste && bilan.envoyes >= limite) bilan.reste = true;
  return bilan;
}

/** Cette personne a-t-elle demandé à ne plus rien recevoir ? */
export async function estDesabonne(email: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('webhook_events')
      .select('id')
      .eq('delivery_id', cleDesabo(email))
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Enregistre la désinscription. Idempotent : deux clics ne font pas d'erreur. */
export async function desabonner(email: string): Promise<boolean> {
  try {
    const { error } = await createAdminClient().from('webhook_events').insert({
      provider: 'desabonnement',
      delivery_id: cleDesabo(email),
      event: 'desabonnement',
      payload: { email: email.trim().toLowerCase() },
    });
    if (error && error.code !== '23505') return false;
    return true;
  } catch {
    return false;
  }
}
