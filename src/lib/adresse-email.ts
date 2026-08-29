/**
 * L'ADRESSE SAISIE À L'INSCRIPTION EST LA SEULE CLÉ DU COMPTE.
 *
 * ── CE QUE CETTE ABSENCE DE CONTRÔLE A COÛTÉ ──────────────────────────────
 *
 * Relevé le 29 août 2026 sur les 5 932 comptes : QUINZE personnes payantes se
 * retrouvaient devant le mur de paiement. Aucune n'avait perdu son argent —
 * leur abonnement était actif, sur une adresse voisine d'une lettre.
 *
 *     kmkaime01@gmai.co      paie          kmkaime01@gmai.com     bloqué
 *     damsdesign07@gmail.com paie          damsdesign07@gamil.com bloqué
 *     armandtuo15@gmail.com  paie          armandtuo15@gm         bloqué
 *     yaoprince579@gmail.com paie (VIP)    yao.prince@icloud.com  bloqué
 *
 * Quarante adresses structurellement impossibles avaient été acceptées :
 * « @gamil », « @gmail » sans extension, « @com », « dab@ire », « jay@381 ».
 *
 * La confirmation d'e-mail est désactivée sur ce projet : rien, nulle part, ne
 * rattrape la faute de frappe. La personne crée un compte, paie, revient le
 * lendemain en tapant son adresse CORRECTE, tombe sur un compte vide — et
 * écrit qu'on lui a pris son argent. C'est exactement ce qui est arrivé.
 *
 * ── POURQUOI ON REFUSE AU LIEU DE SUGGÉRER ────────────────────────────────
 *
 * Une suggestion se décline d'un clic, et l'inscription se poursuit avec
 * l'adresse fautive. Ici la faute ne se voit qu'un mois plus tard, quand
 * l'argent est déjà parti. Mieux vaut une seconde d'agacement à l'inscription
 * qu'un client convaincu d'avoir été volé.
 *
 * ── CE QU'ON NE REFUSE PAS ────────────────────────────────────────────────
 *
 * Tout le reste. On ne juge ni le fournisseur, ni le pays, ni l'extension :
 * refuser une adresse valide parce qu'elle est inhabituelle ferait perdre un
 * client pour de bon, et ce serait pire que le mal soigné.
 */

/**
 * Une adresse doit avoir une partie locale, un domaine, et une extension d'au
 * moins deux lettres. C'est le strict minimum pour qu'un message puisse
 * partir : « damsdesign07@gmail » n'atteindra jamais personne.
 */
const FORME = /^[^\s@,;:<>()[\]\\"]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

/**
 * Domaines mal tapés, et leur correction.
 *
 * Aucune approximation ici : chaque entrée de gauche a été RELEVÉE dans la
 * base ou est la faute la plus courante du domaine visé. Un correcteur qui
 * devine finirait par refuser un vrai domaine.
 */
const FAUTES: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmai.co': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmailcom.com': 'gmail.com',
  'gmail.com.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yaho.fr': 'yahoo.fr',
  'yahho.fr': 'yahoo.fr',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'iclou.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

export interface VerdictAdresse {
  ok: boolean;
  /** Message destiné à la personne, en français, jamais technique. */
  message?: string;
}

/**
 * L'adresse peut-elle recevoir un message et servir de clé de compte ?
 *
 * Ne fait aucun appel réseau : c'est une vérification de forme, exécutée sur
 * le chemin d'inscription, où chaque seconde ajoutée coûte des comptes.
 */
export function verifierAdresse(brut: string): VerdictAdresse {
  const email = String(brut ?? '').trim().toLowerCase();

  if (!email) return { ok: false, message: 'Veuillez saisir votre adresse e-mail.' };

  if (!FORME.test(email)) {
    return {
      ok: false,
      message:
        "Cette adresse e-mail semble incomplète. Vérifiez qu'elle contient bien un « @ » " +
        'et une extension, par exemple : votrenom@gmail.com',
    };
  }

  const domaine = email.split('@')[1] ?? '';
  const correction = FAUTES[domaine];
  if (correction) {
    return {
      ok: false,
      message: `Il y a sans doute une faute de frappe : vouliez-vous dire « ${email.split('@')[0]}@${correction} » ?`,
    };
  }

  return { ok: true };
}

/**
 * L'adresse telle qu'elle doit être enregistrée.
 *
 * Espaces retirés et minuscules : « Traoreismaela753@Gmail.com » et
 * « traoreismaela753@gmail.com » sont le même compte, et c'est déjà la règle
 * appliquée au contrôle d'accès administrateur.
 */
export function normaliserAdresse(brut: string): string {
  return String(brut ?? '').trim().toLowerCase();
}
