/**
 * QUI A LE DROIT DE DÉCLENCHER UNE TÂCHE PLANIFIÉE.
 *
 * ── LE REPLI QUI N'EN ÉTAIT PAS UN ────────────────────────────────────────
 *
 * Les deux routes de tâches planifiées portaient ce raisonnement :
 *
 *     if (secret) { exiger le jeton }
 *     else if (!estVercelCron) { refuser }
 *
 * Autrement dit : si `CRON_SECRET` n'était pas configuré, il suffisait que
 * l'en-tête `user-agent` contienne « vercel-cron » pour être accepté. Un
 * en-tête que n'importe qui écrit en trois secondes.
 *
 * Vérifié en production le 23 août 2026 : sans en-tête, la route rendait 401 ;
 * avec `-A "vercel-cron/1.0"`, elle se mettait à travailler.
 *
 * ── CE QUE ÇA COÛTAIT ─────────────────────────────────────────────────────
 *
 * `cron/refresh` recharge l'état de toutes les compétitions chez le fournisseur
 * de données football. C'est la ressource la plus rare du projet : son quota a
 * frôlé les 100 % le 16 août 2026, et au-delà, plus aucune analyse ne
 * fonctionne pour personne. Quelqu'un qui appelait cette route en boucle
 * pouvait donc éteindre l'application entière, gratuitement.
 *
 * ── POURQUOI L'INTENTION DE DÉPART ÉTAIT BONNE ────────────────────────────
 *
 * Le commentaire d'origine disait « pour ne pas bloquer la mise en place ».
 * C'était juste : sans ce repli, les tâches auraient été inertes tant que la
 * variable n'était pas ajoutée, sans que rien ne le signale.
 *
 * La réponse n'est pas d'ouvrir la porte, c'est de dire qu'elle est fermée. Un
 * refus faute de secret est journalisé en toutes lettres, avec la marche à
 * suivre — on ne cherche plus pourquoi une tâche ne part pas.
 */

export interface VerdictCron {
  autorise: boolean;
  /** Pourquoi le refus, quand il y a lieu. */
  raison?: string;
}

/**
 * Contrôle l'appel d'une tâche planifiée.
 *
 * Vercel envoie automatiquement `Authorization: Bearer <CRON_SECRET>` dès que
 * la variable existe dans le projet. C'est le seul laissez-passer accepté.
 *
 * La comparaison est faite à durée constante : une comparaison naïve révèle,
 * par le temps qu'elle met à échouer, combien de caractères initiaux sont
 * corrects — de quoi retrouver le secret lettre par lettre.
 */
export function autoriserCron(requete: Request, nom: string): VerdictCron {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // Un refus par défaut, mais jamais silencieux : c'est ce qui distingue une
    // protection d'une panne.
    console.error(
      `[CRON ${nom}] REFUSÉ : CRON_SECRET n'est pas configuré sur le serveur. ` +
        `La tâche ne partira pas tant que la variable ne sera pas ajoutée dans ` +
        `Vercel (Settings → Environment Variables), suivie d'un redéploiement.`
    );
    return { autorise: false, raison: 'CRON_SECRET absent du serveur' };
  }

  const fourni = requete.headers.get('authorization') ?? '';
  const attendu = `Bearer ${secret}`;

  if (fourni.length !== attendu.length) {
    console.warn(`[CRON ${nom}] Refusé : jeton de longueur inattendue.`);
    return { autorise: false, raison: 'jeton invalide' };
  }

  // Comparaison à durée constante, sans dépendance : on parcourt toute la
  // chaîne quoi qu'il arrive.
  let ecart = 0;
  for (let i = 0; i < attendu.length; i++) {
    ecart |= fourni.charCodeAt(i) ^ attendu.charCodeAt(i);
  }

  if (ecart !== 0) {
    console.warn(`[CRON ${nom}] Refusé : jeton incorrect.`);
    return { autorise: false, raison: 'jeton invalide' };
  }

  return { autorise: true };
}
