/**
 * LES MESSAGES DE CONNEXION, EN FRANÇAIS ET UTILISABLES.
 *
 * ── CE QU'UNE PERSONNE AU BÉNIN A VÉCU LE 23 AOÛT 2026 ────────────────────
 *
 * La mesure maison, posée le matin même, a enregistré son passage complet :
 *
 *     10:46:40  /login                 13 s
 *     10:46:52  /mot-de-passe-oublie    4 s
 *     10:46:57  /login                  3 s
 *     10:46:59  /mot-de-passe-oublie   12 s
 *     10:47:34  /login                  3 s
 *     10:47:43  /                       3 s
 *
 * Soixante-sept secondes, trois allers-retours, et elle n'est jamais entrée.
 *
 * ── POURQUOI ELLE A TOURNÉ EN ROND ────────────────────────────────────────
 *
 * L'action de connexion renvoyait `error.message` tel quel. Supabase répond en
 * ANGLAIS : « Invalid login credentials ». Sur une application entièrement en
 * français, destinée à l'Afrique de l'Ouest francophone, le seul message qui
 * décide si quelqu'un entre ou non était dans une langue qu'il ne lit pas
 * forcément.
 *
 * Et ce message ne dit rien d'utile. « Identifiants invalides » recouvre deux
 * situations opposées :
 *
 *   • le mot de passe est faux — il faut le réinitialiser ;
 *   • AUCUN COMPTE n'existe à cette adresse — la réinitialisation ne servira
 *     jamais à rien, et aucun courriel n'arrivera jamais.
 *
 * La page de récupération, elle, répond toujours « Vérifiez votre boîte mail »,
 * même pour une adresse inconnue. C'est volontaire et c'est juste : révéler
 * quelles adresses ont un compte permettrait de dresser la liste des clients.
 *
 * Mais les deux ensemble forment un piège parfait. La personne ne peut pas
 * entrer, on lui dit d'attendre un courriel qui n'existe pas, elle recommence,
 * puis elle part.
 *
 * ── CE QUE CES MESSAGES FONT DE PLUS ──────────────────────────────────────
 *
 * Ils nomment la deuxième possibilité. Sans jamais confirmer si le compte
 * existe — le message est le même pour tout le monde — ils rappellent qu'on
 * peut aussi ne pas en avoir, et où aller le créer. C'est ce qui manquait pour
 * sortir de la boucle.
 */

/** Ce qu'on montre, et vers où l'on envoie. */
export interface MessageAuth {
  texte: string;
  /** Une porte de sortie, quand il en existe une. */
  lien?: { texte: string; href: string };
}

/**
 * Traduit une erreur d'authentification en message utile.
 *
 * La comparaison se fait en minuscules et par fragment : Supabase reformule ses
 * messages au fil des versions, et exiger la phrase exacte ferait retomber sur
 * l'anglais au premier changement.
 */
export function messageAuth(brut: string | null | undefined): MessageAuth {
  const m = String(brut ?? '').toLowerCase();

  if (!m) return { texte: 'Connexion impossible pour le moment. Réessayez dans un instant.' };

  // ── LE CAS QUI FAISAIT TOURNER EN ROND ──────────────────────────────────
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return {
      texte:
        "Adresse e-mail ou mot de passe incorrect. Si vous n'avez pas encore de compte, " +
        'créez-le : il ne sert à rien de demander un nouveau mot de passe pour une adresse ' +
        "qui n'en a pas.",
      lien: { texte: 'Créer un compte', href: '/signup' },
    };
  }

  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return {
      texte:
        'Votre compte existe, mais votre adresse n\'a pas encore été confirmée. ' +
        'Ouvrez le message que nous vous avons envoyé à l\'inscription et cliquez sur le lien.',
    };
  }

  if (m.includes('already registered') || m.includes('already exists')) {
    return {
      texte: 'Un compte existe déjà avec cette adresse. Connectez-vous plutôt.',
      lien: { texte: 'Se connecter', href: '/login' },
    };
  }

  if (m.includes('rate') || m.includes('too many')) {
    return {
      texte:
        'Trop de tentatives en peu de temps. Patientez quelques minutes, puis réessayez.',
    };
  }

  if (m.includes('password') && (m.includes('least') || m.includes('short') || m.includes('weak'))) {
    return { texte: 'Le mot de passe doit contenir au moins six caractères.' };
  }

  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return { texte: "Cette adresse e-mail n'est pas valide. Vérifiez qu'elle est bien écrite." };
  }

  if (m.includes('network') || m.includes('fetch')) {
    return { texte: 'La connexion au serveur a échoué. Vérifiez votre connexion internet.' };
  }

  // ── UN MESSAGE INCONNU NE PART PAS EN ANGLAIS ──────────────────────────
  //
  // Le message brut est journalisé pour qu'on puisse l'ajouter ici plus tard.
  // La personne, elle, lit du français.
  console.warn(`[AUTH] Message non traduit : « ${brut} »`);
  return {
    texte: 'La connexion a échoué. Réessayez, ou créez un compte si vous n\'en avez pas encore.',
    lien: { texte: 'Créer un compte', href: '/signup' },
  };
}
