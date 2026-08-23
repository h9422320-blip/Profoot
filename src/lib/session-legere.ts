/**
 * « CETTE PERSONNE EST-ELLE CONNECTÉE ? » — SANS CHARGER DE BIBLIOTHÈQUE.
 *
 * ── LE PROBLÈME ───────────────────────────────────────────────────────────
 *
 * La page d'accueil chargeait le client Supabase entier — 226 Ko de code, une
 * soixantaine une fois compressé — pour une seule décision : le bouton
 * principal doit-il mener vers `/analyze` ou vers `/signup` ?
 *
 * C'est la page que voient tous les nouveaux visiteurs, sur un téléphone, en
 * 3G. Payer soixante kilo-octets pour choisir entre deux adresses est hors de
 * proportion.
 *
 * ── CE QU'ON FAIT À LA PLACE ──────────────────────────────────────────────
 *
 * Supabase dépose sa session dans un cookie nommé `sb-<référence>-auth-token`,
 * lisible depuis la page. Sa simple PRÉSENCE suffit à répondre : il y a une
 * session, ou il n'y en a pas.
 *
 * ── CE QUE CETTE RÉPONSE NE VAUT PAS ──────────────────────────────────────
 *
 * Elle ne prouve rien. Le cookie peut être expiré, révoqué, ou appartenir à un
 * compte supprimé. Elle ne doit donc JAMAIS servir à ouvrir un accès : les
 * droits sont vérifiés par le serveur, à chaque requête, et cela ne change pas.
 *
 * Elle sert uniquement à orienter un lien. Dans le pire des cas — cookie
 * périmé — la personne arrive sur `/analyze` et le serveur la renvoie vers la
 * connexion. C'est exactement ce qui se passait déjà quand la session avait
 * expiré entre deux visites.
 */

/**
 * Y a-t-il une session Supabase dans ce navigateur ?
 *
 * Renvoie `false` côté serveur : sans `document`, il n'y a rien à lire, et
 * `/signup` est le bon défaut pour un visiteur dont on ignore tout.
 */
export function sessionProbable(): boolean {
  if (typeof document === 'undefined') return false;

  // La référence du projet est le premier morceau de l'adresse Supabase :
  // `https://abcdefgh.supabase.co` -> `abcdefgh`. Elle est publique — c'est
  // déjà elle qui figure dans chaque requête du navigateur.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const reference = url.replace(/^https?:\/\//, '').split('.')[0];
  if (!reference) return false;

  // Supabase découpe parfois le cookie en plusieurs morceaux numérotés quand
  // le jeton est long : `...auth-token.0`, `.1`. Chercher le préfixe les
  // couvre tous.
  const prefixe = `sb-${reference}-auth-token`;
  return document.cookie.split(';').some((c) => c.trim().startsWith(prefixe));
}
