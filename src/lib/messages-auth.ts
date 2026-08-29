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

/**
 * ── LA DEUXIÈME BOUCLE, DÉCOUVERTE LE 29 AOÛT 2026 ────────────────────────
 *
 * Une seule porte de sortie ne suffisait pas, parce qu'il existe désormais des
 * comptes dont le propriétaire n'a JAMAIS choisi de mot de passe : depuis ce
 * soir, l'application crée le compte de celui qui a payé sans en avoir un.
 *
 * Pour cette personne, les deux écrans se renvoyaient l'un à l'autre :
 *
 *   Connexion  → « mot de passe incorrect, sinon CRÉEZ UN COMPTE »
 *   Inscription → « ce compte existe déjà, CONNECTEZ-VOUS plutôt »
 *   Connexion  → …
 *
 * Un client a filmé son téléphone en train de tourner dans cette boucle. Il
 * avait payé, son abonnement était actif, et l'application ne lui a jamais
 * proposé la seule action qui l'aurait fait entrer : demander un lien pour
 * choisir son mot de passe.
 *
 * D'où deux sorties et non plus une. Aucune ne confirme si le compte existe —
 * le message reste le même pour tout le monde — mais aucune situation ne se
 * retrouve plus sans issue.
 */

/** Ce qu'on montre, et vers où l'on envoie. */
export interface MessageAuth {
  texte: string;
  /**
   * Les portes de sortie. Jamais zéro quand la personne est bloquée : c'est
   * l'absence de sortie qui fabrique les boucles.
   */
  liens?: { texte: string; href: string }[];
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
        'Adresse e-mail ou mot de passe incorrect. Deux raisons possibles. ' +
        "Si vous avez payé et que nous avons créé votre compte pour vous, vous n'avez " +
        'pas encore choisi de mot de passe : demandez le lien qui vous permettra d\'en ' +
        "choisir un. Si vous n'avez jamais eu de compte ici, créez-le.",
      liens: [
        { texte: 'Choisir mon mot de passe', href: '/mot-de-passe-oublie' },
        { texte: 'Créer un compte', href: '/signup' },
      ],
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
      texte:
        'Un compte existe déjà avec cette adresse. Si vous ne connaissez pas son mot de ' +
        'passe — par exemple parce que nous avons créé ce compte pour vous après votre ' +
        "paiement — demandez le lien qui vous permettra d'en choisir un.",
      liens: [
        { texte: 'Choisir mon mot de passe', href: '/mot-de-passe-oublie' },
        { texte: 'Se connecter', href: '/login' },
      ],
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
    texte: 'La connexion a échoué. Réessayez, ou choisissez une de ces deux voies.',
    liens: [
      { texte: 'Choisir mon mot de passe', href: '/mot-de-passe-oublie' },
      { texte: 'Créer un compte', href: '/signup' },
    ],
  };
}
