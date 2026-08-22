/**
 * Pays de l'acheteur, au moment où il clique sur « s'abonner ».
 *
 * Pourquoi ce module existe : la session de paiement est créée par notre
 * serveur, pas par le navigateur du client. Le prestataire de paiement, qui
 * devine le pays à partir de l'adresse IP de l'appel, voyait donc celle de
 * Vercel — aux États-Unis — et renvoyait un lien de paiement estampillé
 * `country=US`. Résultat : un acheteur à Abidjan se voyait proposer Apple Pay
 * et Cash App au lieu de Wave et Orange Money, et abandonnait.
 *
 * Le seul moment où l'on dispose vraiment de l'adresse IP de l'acheteur, c'est
 * quand SON navigateur appelle NOTRE route. C'est là qu'il faut relever le
 * pays, et c'est tout l'objet de ce fichier.
 */

/**
 * Repli quand le fuseau horaire est le seul indice disponible.
 *
 * Ce repli est volontairement grossier. La base des fuseaux fait pointer
 * Bamako, Conakry, Dakar, Lomé et Ouagadougou vers « Africa/Abidjan » : un
 * navigateur ouest-africain annonce donc souvent Abidjan quel que soit le pays.
 * On ne peut pas mieux faire à partir du fuseau seul — mais viser la Côte
 * d'Ivoire place l'acheteur dans la bonne zone de paiement (Wave, Orange Money,
 * MTN), et il lui reste le sélecteur de pays s'il faut corriger. C'est
 * infiniment mieux que les États-Unis.
 */
const PAYS_PAR_FUSEAU: Record<string, string> = {
  'Africa/Abidjan': 'CI',
  'Africa/Dakar': 'SN',
  'Africa/Conakry': 'GN',
  'Africa/Bamako': 'ML',
  'Africa/Ouagadougou': 'BF',
  'Africa/Niamey': 'NE',
  'Africa/Lome': 'TG',
  'Africa/Porto-Novo': 'BJ',
  'Africa/Nouakchott': 'MR',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Freetown': 'SL',
  'Africa/Monrovia': 'LR',
  'Africa/Banjul': 'GM',
  'Africa/Douala': 'CM',
  'Africa/Kinshasa': 'CD',
  'Africa/Lubumbashi': 'CD',
  'Africa/Brazzaville': 'CG',
  'Africa/Libreville': 'GA',
  'Africa/Ndjamena': 'TD',
  'Africa/Bangui': 'CF',
  'Africa/Bujumbura': 'BI',
  'Africa/Kigali': 'RW',
  'Africa/Casablanca': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Djibouti': 'DJ',
  'Indian/Antananarivo': 'MG',
  'Indian/Mauritius': 'MU',
  'Indian/Comoro': 'KM',
  'Indian/Mahe': 'SC',
  'Europe/Paris': 'FR',
  'Europe/Brussels': 'BE',
  'Europe/Zurich': 'CH',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Port-au-Prince': 'HT',
};

/**
 * Pays retenu quand aucun indice n'aboutit. La très grande majorité des
 * acheteurs de ProFoot est en Afrique de l'Ouest : y renvoyer en dernier
 * recours reste bien plus juste que le repli américain du prestataire.
 */
export const PAYS_PAR_DEFAUT = 'CI';

export interface PaysDetecte {
  /** Code ISO à deux lettres, en majuscules. */
  code: string;
  /** D'où vient l'information — journalisé pour pouvoir vérifier la détection. */
  /** 'choix' quand l acheteur a corrige son pays lui-meme dans la notice. */
  source: 'ip' | 'fuseau' | 'defaut' | 'choix';
}

/**
 * Détermine le pays de l'acheteur, du signal le plus fiable au moins fiable.
 *
 * L'en-tête posé par Vercel porte l'adresse IP réelle du navigateur qui nous
 * appelle : c'est le signal de référence. Le fuseau horaire, transmis par la
 * page, ne sert que si cet en-tête manque — en développement local, ou derrière
 * un hébergeur qui ne le pose pas.
 */
export function detecterPaysAcheteur(entetes: Headers, fuseauClient?: unknown): PaysDetecte {
  // ── CLOUDFLARE D'ABORD, ET C'EST DÉSORMAIS VITAL ──────────────────────────
  //
  // Depuis que le domaine passe par Cloudflare (19 août 2026), Vercel ne voit
  // plus l'adresse de l'acheteur : il voit celle du point de présence
  // Cloudflare qui a relayé la requête. Or Cloudflare fait passer l'Afrique de
  // l'Ouest par LONDRES.
  //
  // Relevé sur `profootai.com/cdn-cgi/trace` depuis la Guinée :
  //
  //     colo = LHR      <- le relais est à Londres
  //     loc  = GN       <- le pays réel est la Guinée
  //
  // `x-vercel-ip-country` valait donc GB, et la page de paiement s'ouvrait en
  // livres sterling avec Alipay et Amazon Pay. Un acheteur ouest-africain ne
  // pouvait plus payer du tout — il n'y avait aucun moyen de paiement qu'il
  // possède.
  //
  // Cloudflare, lui, connaît le vrai pays et le pose dans `CF-IPCountry`.
  // C'est maintenant le signal de référence ; Vercel devient le repli, utile
  // le jour où le domaine ne passerait plus par Cloudflare.
  //
  // « XX » et « T1 » sont les valeurs que Cloudflare renvoie quand il ne sait
  // pas (réseau Tor, client inconnu) : elles ne doivent pas être prises pour
  // un pays.
  const parCloudflare = (entetes.get('cf-ipcountry') || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(parCloudflare) && parCloudflare !== 'XX' && parCloudflare !== 'T1')
    return { code: parCloudflare, source: 'ip' };

  const parIp = (entetes.get('x-vercel-ip-country') || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(parIp)) return { code: parIp, source: 'ip' };

  if (typeof fuseauClient === 'string') {
    const parFuseau = PAYS_PAR_FUSEAU[fuseauClient];
    if (parFuseau) return { code: parFuseau, source: 'fuseau' };
  }

  return { code: PAYS_PAR_DEFAUT, source: 'defaut' };
}

/** Plages réservées : une IP interne ne dit rien du pays de l'acheteur. */
const IP_PRIVEE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|[fF][cCdD])/;

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

/**
 * Adresse IP réelle de l'acheteur, à transmettre au prestataire de paiement.
 *
 * Sans elle, Chariow retient l'adresse de l'appelant — notre serveur Vercel — et
 * enregistre « États-Unis » dans le contexte de chaque vente, quel que soit le
 * pays réel du client. Le champ `customer_ip` de leur API existe exactement pour
 * ça : il détermine les moyens de paiement et l'attribution analytique.
 *
 * L'en-tête peut contenir une chaîne de relais séparés par des virgules ; la
 * première adresse est celle du client.
 */
export function ipAcheteur(entetes: Headers): string | undefined {
  // `cf-connecting-ip` porte l'adresse VRAIE de l'acheteur, telle que
  // Cloudflare l'a reçue. Les autres en-têtes, derrière Cloudflare, peuvent
  // commencer par l'adresse du relais londonien — ce qui ferait enregistrer
  // « Royaume-Uni » dans le contexte de chaque vente guinéenne.
  const brut =
    entetes.get('cf-connecting-ip') ||
    entetes.get('x-forwarded-for') ||
    entetes.get('x-real-ip') ||
    entetes.get('x-vercel-forwarded-for') ||
    '';

  const premiere = brut.split(',')[0]?.trim().replace(/^\[|\]$/g, '');
  if (!premiere) return undefined;
  if (!IPV4.test(premiere) && !IPV6.test(premiere)) return undefined;
  // Une adresse privée passerait la validation de format sans rien apprendre à
  // personne : mieux vaut ne rien envoyer que d'envoyer « 127.0.0.1 ».
  if (IP_PRIVEE.test(premiere)) return undefined;
  return premiere;
}

/**
 * Fuseau horaire du navigateur, joint à la demande de paiement en secours.
 * Ne sert que si l'en-tête de géolocalisation manque.
 */
export function fuseauDuNavigateur(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
