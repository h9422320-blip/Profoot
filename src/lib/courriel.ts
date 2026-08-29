/**
 * ENVOYER UN COURRIEL À UN CLIENT.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * L'application ne savait pas écrire à ses clients. Les seuls messages qui
 * partaient étaient ceux de Supabase — mot de passe oublié, confirmation
 * d'adresse — et Supabase ne sait envoyer que ses propres modèles.
 *
 * Le 22 août 2026, trois personnes avaient payé sans recevoir leur accès. Une
 * seule a écrit ; les deux autres attendaient depuis deux jours en silence.
 * Une fois leur accès rouvert, rien ne pouvait les en informer : il a fallu
 * écrire les messages à la main.
 *
 * Un accès rendu que le client ignore ne vaut pas beaucoup mieux qu'un accès
 * manquant. Il faut pouvoir le lui dire.
 *
 * ── CE QUE FAIT CE MODULE, ET CE QU'IL NE FAIT PAS ────────────────────────
 *
 * Il envoie un message, en texte simple, à une adresse. Rien d'autre : pas de
 * mise en page, pas de pièce jointe, pas de liste de diffusion. Ce qui manque
 * n'est pas de la richesse, c'est la capacité d'écrire.
 *
 * ── SANS CLÉ, IL NE FAIT RIEN — ET IL LE DIT ──────────────────────────────
 *
 * Tant que `RESEND_API_KEY` n'est pas renseignée, chaque envoi est refusé et
 * journalisé bruyamment. Un module d'envoi qui échoue en silence est pire que
 * pas de module du tout : on croit prévenir des clients qu'on ne prévient pas.
 */

/**
 * L'adresse d'expédition.
 *
 * ── POURQUOI CELLE-CI ET PAS UNE AUTRE ────────────────────────────────────
 *
 * C'est l'adresse qui envoie déjà les messages de mot de passe oublié, et dont
 * la livraison est vérifiée. Resend n'accepte que les domaines qu'on lui a
 * prouvé posséder : `contact@profootai.com`, qui figurait ici auparavant,
 * n'avait jamais servi. Une adresse jamais essayée est une adresse dont on ne
 * sait pas si elle passe.
 */
const EXPEDITEUR_PAR_DEFAUT = 'ProFoot AI <noreply@profootai.com>';

/**
 * L'adresse qui reçoit les réponses.
 *
 * ── POURQUOI ELLE EST INDISPENSABLE ICI ───────────────────────────────────
 *
 * Ces messages disent « répondez simplement à ce message ». Envoyés depuis un
 * `noreply@`, les réponses tomberaient dans le vide — on inviterait un client
 * à écrire là où personne ne lit. Pire qu'un message sans invitation : il
 * croirait avoir signalé son problème.
 *
 * L'expéditeur reste `noreply@`, parce que c'est le domaine vérifié ; c'est
 * l'en-tête de réponse qui ramène vers une vraie boîte.
 */
const REPONSE_PAR_DEFAUT = 'm09997818@gmail.com';

export interface Courriel {
  a: string;
  sujet: string;
  /** Corps du message, en texte simple. Les sauts de ligne sont conservés. */
  texte: string;
}

export const courrielDisponible = () => !!process.env.RESEND_API_KEY;

/**
 * Envoie un message, et dit franchement s'il est parti.
 *
 * Ne lève jamais : l'appelant est presque toujours en train de faire quelque
 * chose de plus important — rouvrir un accès payé, par exemple — et un service
 * de courriel injoignable ne doit pas faire échouer ce travail-là. L'échec est
 * journalisé et rendu par la valeur de retour.
 */
export async function envoyerCourriel({ a, sujet, texte }: Courriel): Promise<boolean> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    console.error(
      `[COURRIEL] NON ENVOYÉ à ${a} — « ${sujet} ». La clé RESEND_API_KEY n'est pas ` +
        `configurée sur le serveur. Le message a été perdu, pas différé.`
    );
    return false;
  }

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.COURRIEL_EXPEDITEUR || EXPEDITEUR_PAR_DEFAUT,
        to: [a],
        reply_to: process.env.COURRIEL_REPONSE || REPONSE_PAR_DEFAUT,
        subject: sujet,
        text: texte,
      }),
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => '');
      console.error(
        `[COURRIEL] Refusé pour ${a} (${reponse.status}) — ${detail.slice(0, 200)}`
      );
      return false;
    }

    console.log(`[COURRIEL] Envoyé à ${a} — « ${sujet} ».`);
    return true;
  } catch (e: any) {
    console.error(`[COURRIEL] Envoi impossible pour ${a} : ${e?.message}`);
    return false;
  }
}

/**
 * Le message envoyé à quelqu'un dont l'accès vient d'être rouvert.
 *
 * ── POURQUOI CE TEXTE-LÀ ──────────────────────────────────────────────────
 *
 * Il dit d'emblée que c'est réglé : c'est la seule information que la personne
 * attend, et elle doit tenir dans la première ligne.
 *
 * Il précise ensuite que l'erreur venait de nous. Sans cette phrase, quelqu'un
 * qui a payé et attendu deux jours se demande s'il a mal fait quelque chose,
 * et hésite à racheter.
 *
 * Il ne s'excuse qu'une fois. Répéter des excuses attire l'attention sur la
 * panne plutôt que sur son règlement.
 */
/**
 * IL A PAYÉ, IL N'A PAS DE COMPTE, ET PERSONNE NE LUI DIT QUOI FAIRE.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Le 28 août 2026 à 12 h 43, quelqu'un paie 2 000 FCFA. Il n'a pas de compte
 * ProFoot : la vente est enregistrée, l'accès s'ouvrira à son inscription —
 * mais rien ne le lui dit. Le lendemain matin, il reçoit de la boutique un
 * message automatique « Comment s'est passé votre achat ? » et répond :
 *
 *     « Je comprends rien d'abord »
 *
 * Il a payé, il attend, et le seul courrier qu'il reçoit lui demande s'il est
 * content. Vingt et une heures plus tard, il n'avait toujours pas de compte.
 *
 * ── POURQUOI CE TEXTE-LÀ ──────────────────────────────────────────────────
 *
 * La première ligne dit que le paiement est reçu : c'est ce qu'il doute le
 * plus. La deuxième dit l'unique geste qui reste, et l'adresse à employer y
 * est écrite en toutes lettres — c'est exactement là que ça casse. Le 29 août,
 * quinze personnes payantes se retrouvaient devant le mur de paiement pour
 * s'être inscrites avec une adresse voisine d'une lettre.
 *
 * Aucune excuse : il n'y a pas eu de panne. Le dire laisserait croire qu'il
 * s'est passé quelque chose d'anormal, alors qu'il lui manque une inscription.
 */
export function messageCompteAcreer(adresse: string, offre: string): Omit<Courriel, 'a'> {
  return {
    sujet: 'Votre accès ProFoot AI vous attend — il reste une étape',
    texte: [
      'Bonjour,',
      '',
      `Votre paiement pour l'offre ${offre} est bien reçu. Merci.`,
      '',
      'Il reste une seule étape : créer votre compte sur profootai.com. ' +
        'Votre accès s\'ouvrira tout seul, sans rien avoir à demander.',
      '',
      `IMPORTANT : inscrivez-vous avec cette adresse exactement — ${adresse}`,
      "C'est elle qui porte votre paiement. Avec une autre adresse, même " +
        'proche, votre accès ne vous retrouvera pas.',
      '',
      'Pour créer votre compte : profootai.com/signup',
      '',
      "Si quoi que ce soit bloque, répondez simplement à ce message : c'est " +
        'une vraie boîte, et je vous réponds.',
      '',
      'Ousmane',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  };
}

/**
 * ON A CRÉÉ LE COMPTE POUR LUI. IL N'A PLUS QU'À ENTRER.
 *
 * ── POURQUOI CE MESSAGE REMPLACE L'INVITATION ─────────────────────────────
 *
 * On envoyait « créez votre compte, votre accès s'ouvrira ensuite ». C'était
 * demander à quelqu'un qui a déjà payé de faire encore une démarche — et de
 * ne pas se tromper d'un caractère dans son adresse, sans quoi rien ne le
 * retrouve.
 *
 * Le 29 août 2026, deux acheteurs attendaient ainsi depuis un et deux jours.
 * Aucun n'avait créé son compte. Le message ne suffisait pas.
 *
 * Le compte est donc créé pour eux, l'accès crédité, et il ne reste qu'un
 * mot de passe à choisir — ce que personne ne peut faire à leur place.
 */
export function messageAccesCree(
  lienMotDePasse: string,
  offre: string,
  expireLe: string | null
): Omit<Courriel, 'a'> {
  const echeance = expireLe
    ? new Date(expireLe).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return {
    sujet: 'Votre accès ProFoot AI est ouvert',
    texte: [
      'Bonjour,',
      '',
      `Votre paiement pour l'offre ${offre} est bien reçu, et votre accès est ` +
        `ouvert${echeance ? ` jusqu'au ${echeance}` : ''}.`,
      '',
      "Nous avons créé votre compte avec cette adresse. Il ne reste qu'une " +
        'chose à faire : choisir votre mot de passe.',
      '',
      lienMotDePasse,
      '',
      'Une fois votre mot de passe choisi, vous serez connecté et vous pourrez ' +
        'lancer votre première analyse.',
      '',
      "Si le lien ne fonctionne pas, allez sur profootai.com, cliquez sur " +
        '« Mot de passe oublié » et saisissez cette même adresse.',
      '',
      'Répondez simplement à ce message si quoi que ce soit bloque.',
      '',
      'Ousmane',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  };
}

export function messageAccesRouvert(expireLe: string | null): Omit<Courriel, 'a'> {
  const echeance = expireLe
    ? new Date(expireLe).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return {
    sujet: 'Votre accès ProFoot AI est activé',
    texte: [
      'Bonjour,',
      '',
      'Votre accès ProFoot AI est maintenant actif. Vous pouvez vous connecter ' +
        'dès maintenant sur profootai.com avec cette adresse e-mail.',
      '',
      'Votre paiement avait bien été reçu, mais l\'accès ne s\'est pas ouvert ' +
        'automatiquement de notre côté. L\'erreur venait de nous, pas de vous.' +
        (echeance ? ` Elle est corrigée : votre accès court jusqu'au ${echeance}.` : ''),
      '',
      'Toutes nos excuses pour l\'attente. Si vous n\'arrivez pas à vous connecter, ' +
        'répondez simplement à ce message.',
      '',
      'Ousmane',
      'ProFoot AI — profootai.com',
    ].join('\n'),
  };
}
