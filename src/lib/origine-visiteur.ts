/**
 * D'où vient un visiteur, et avec quoi.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 18 août 2026, des acheteurs du Maroc, d'Algérie et de France n'arrivaient
 * pas à payer. Pour comprendre, il a fallu croiser les pays enregistrés dans
 * `payment_intents` — c'est-à-dire uniquement ceux des gens allés jusqu'au clic
 * « s'abonner ». Six cent trente-six comptes sur huit cent soixante-trois
 * n'avaient aucun pays. Quelqu'un qui ouvre le site au Maroc et repart ne
 * laissait strictement aucune trace.
 *
 * On relève donc l'origine dès la création du compte, et à chaque connexion.
 *
 * CE QUI EST RELEVÉ, ET CE QUI NE L'EST PAS
 *
 * Le pays, le système, le navigateur, et le fait d'être sur téléphone. Rien
 * d'autre : ni l'adresse IP, ni l'agent complet, ni quoi que ce soit qui
 * permette de reconnaître une personne d'un site à l'autre. C'est ce qu'il faut
 * pour savoir OÙ ça casse, et pas un octet de plus.
 *
 * LES NAVIGATEURS INTÉGRÉS SONT RELEVÉS À PART
 *
 * Le trafic arrive par Instagram, TikTok et WhatsApp. Ces applications ouvrent
 * les liens dans leur PROPRE navigateur, qui n'est ni Chrome ni Safari et qui
 * gère différemment les cookies et les redirections. Un blocage qui ne toucherait
 * qu'eux serait invisible si on les rangeait avec les autres.
 */

export interface OrigineVisiteur {
  /** Code pays à deux lettres, ou `null` si l'hébergeur ne l'a pas posé. */
  pays: string | null;
  /** `ip` quand l'hébergeur a géolocalisé, `inconnu` sinon. */
  paysSource: 'ip' | 'inconnu';
  /** iOS, Android, Windows, macOS, Linux… */
  systeme: string;
  /** Safari, Chrome, Firefox, Samsung Internet, ou le nom de l'application. */
  navigateur: string;
  /** Vrai pour un téléphone ou une tablette. */
  mobile: boolean;
  /** Nom de l'application quand le lien est ouvert dans son navigateur intégré. */
  navigateurIntegre: string | null;
  /** Horodatage du relevé. */
  vuLe: string;
}

/** Applications qui ouvrent les liens dans leur propre navigateur. */
const APPLICATIONS_INTEGREES: [RegExp, string][] = [
  [/Instagram/i, 'Instagram'],
  [/\bFBAN\b|\bFBAV\b|FB_IAB/i, 'Facebook'],
  [/musical_ly|Bytedance|TikTok/i, 'TikTok'],
  [/WhatsApp/i, 'WhatsApp'],
  [/Snapchat/i, 'Snapchat'],
  [/Twitter/i, 'X'],
  [/Telegram/i, 'Telegram'],
  [/Line\//i, 'Line'],
];

function systemeDe(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'inconnu';
}

function navigateurDe(ua: string): string {
  // L'ORDRE COMPTE : presque tous les navigateurs se déclarent aussi « Safari »
  // et beaucoup se déclarent « Chrome ». Tester du plus spécifique au plus
  // général est la seule façon de ne pas ranger un Edge parmi les Chrome.
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/UCBrowser/i.test(ua)) return 'UC Browser';
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
  // Sur iOS, TOUS les navigateurs utilisent le moteur de Safari : un « Chrome »
  // sur iPhone est un Safari déguisé, et un défaut d'affichage l'y touchera
  // aussi. On le note donc tel qu'il se présente, mais le système dira iOS.
  if (/CriOS/i.test(ua)) return 'Chrome iOS';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'inconnu';
}

/**
 * Lit l'origine à partir des en-têtes de la requête.
 *
 * Ne lève jamais : une mesure qui ferait échouer une inscription serait pire
 * que l'absence de mesure.
 */
export function lireOrigine(entetes: Headers): OrigineVisiteur {
  try {
    const ua = entetes.get('user-agent') || '';
    const brut = (entetes.get('x-vercel-ip-country') || '').trim().toUpperCase();
    const pays = /^[A-Z]{2}$/.test(brut) ? brut : null;

    const integre = APPLICATIONS_INTEGREES.find(([motif]) => motif.test(ua))?.[1] ?? null;

    return {
      pays,
      paysSource: pays ? 'ip' : 'inconnu',
      systeme: systemeDe(ua),
      navigateur: navigateurDe(ua),
      mobile: /Mobi|Android|iPhone|iPad|iPod/i.test(ua),
      navigateurIntegre: integre,
      vuLe: new Date().toISOString(),
    };
  } catch {
    return {
      pays: null,
      paysSource: 'inconnu',
      systeme: 'inconnu',
      navigateur: 'inconnu',
      mobile: false,
      navigateurIntegre: null,
      vuLe: new Date().toISOString(),
    };
  }
}

/**
 * Forme rangée dans les métadonnées du compte.
 *
 * Les métadonnées plutôt qu'une table dédiée, et c'est délibéré : la mesure est
 * urgente, et une nouvelle table demanderait une migration à exécuter à la main
 * avant que quoi que ce soit ne soit relevé. Ici, la mesure démarre au
 * déploiement. Si le besoin grandit, la reprise vers une table sera triviale —
 * les données seront déjà là.
 */
export function metadonneesOrigine(o: OrigineVisiteur) {
  return {
    pays: o.pays,
    pays_source: o.paysSource,
    systeme: o.systeme,
    navigateur: o.navigateur,
    mobile: o.mobile,
    navigateur_integre: o.navigateurIntegre,
    origine_vue_le: o.vuLe,
  };
}
