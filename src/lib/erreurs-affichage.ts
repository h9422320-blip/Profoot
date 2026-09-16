/**
 * CE QU'ON RETIENT D'UNE ERREUR D'AFFICHAGE, ET OÙ ON LE RANGE.
 *
 * Voir `src/app/api/erreur-affichage/route.ts` pour la raison d'être : depuis
 * le 16 septembre 2026, chaque écran « Cette page n'a pas pu s'afficher » vu
 * par quelqu'un envoie sa cause exacte ici, pour qu'on cesse de la deviner à
 * partir d'une capture d'écran.
 *
 * Aucune donnée personnelle : seulement ce qui décrit la PANNE.
 */

export interface ErreurAffichage {
  quand: string;
  /** Le code interne du cadre quand il en donne un — E394, par exemple. */
  code: string;
  nom: string;
  message: string;
  pile: string;
  chemin: string;
  /** L'identifiant d'une erreur venue du serveur, quand il existe. */
  digest: string;
  /** La version du site que le navigateur avait chargée. */
  version: string;
  navigateur: string;
  pays: string;
}

/** Le préfixe commun à toutes les erreurs d'une journée. */
export const prefixeDuJour = (jour: string) => `erreurs-affichage:${jour}:`;

/**
 * Une clé par ERREUR, qui ne peut pas se répéter.
 *
 * Une clé par jour obligeait à relire la liste avant de la réécrire — et,
 * éprouvé le 16 septembre 2026, trois signalements n'en laissaient qu'un. Le
 * jour ouvre la clé pour qu'on puisse les retrouver par préfixe ; l'heure à la
 * milliseconde et un tirage au hasard la rendent unique.
 */
export function cleDUneErreur(quand: string): string {
  const hasard = Math.random().toString(36).slice(2, 10);
  return `${prefixeDuJour(quand.slice(0, 10))}${quand.slice(11, 23)}-${hasard}`;
}

/**
 * Le résumé d'une erreur en quelques caractères, pour l'écran.
 *
 * Écrit petit sous le bouton : celui qui n'en a pas besoin ne le remarque pas,
 * celui qui fait une capture d'écran transmet la cause sans le savoir.
 */
export function resumeDeLErreur(error: unknown): string {
  const e = error as { message?: unknown; name?: unknown; __NEXT_ERROR_CODE?: unknown; digest?: unknown } | null;
  if (!e) return '';
  const code = String(e.__NEXT_ERROR_CODE ?? '').trim();
  const nom = String(e.name ?? '').trim();
  const message = String(e.message ?? '').trim().slice(0, 70);
  return [code, nom && nom !== 'Error' ? nom : '', message].filter(Boolean).join(' · ');
}
