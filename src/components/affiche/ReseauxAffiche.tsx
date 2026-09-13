/**
 * LES QUATRE RÉSEAUX, ET CE QU'ON PEUT VRAIMENT FAIRE AVEC EUX.
 *
 * ── LA VÉRITÉ TECHNIQUE, QU'IL VAUT MIEUX ÉCRIRE UNE FOIS ────────────────
 *
 * Aucun de ces quatre réseaux n'accepte qu'une page web lui envoie une IMAGE.
 * Ni TikTok, ni Instagram, ni WhatsApp, ni Facebook : leurs adresses de partage
 * ne prennent qu'un lien ou du texte. Un bouton « publier sur TikTok » qui
 * enverrait l'affiche n'existe pas et ne peut pas exister.
 *
 * Ce qui existe, et qui marche : la FEUILLE DE PARTAGE DU TÉLÉPHONE. Quand le
 * navigateur sait partager un fichier (`navigator.canShare({ files })`), on lui
 * passe le PNG et le système ouvre sa liste d'applications — WhatsApp,
 * Instagram, TikTok, Facebook y sont tous, avec l'image déjà attachée. C'est
 * le chemin le plus court qui aboutisse vraiment.
 *
 * Les quatre boutons servent donc à ça : ils produisent l'affiche et ouvrent
 * cette feuille. La personne y tape le réseau qu'elle avait en tête — le geste
 * qu'elle attendait.
 *
 * ── ET QUAND LE PARTAGE DE FICHIER N'EXISTE PAS ──────────────────────────
 *
 * Sur un ordinateur, la plupart des navigateurs ne savent pas partager un
 * fichier. L'affiche est alors ENREGISTRÉE, et le réseau ouvert dans un onglet
 * pour qu'il n'y ait plus qu'à la déposer. Un bouton qui ne fait rien serait
 * pire que tout.
 */
'use client';

export type Reseau = 'whatsapp' | 'tiktok' | 'instagram' | 'facebook';

export const RESEAUX: { cle: Reseau; nom: string; couleur: string }[] = [
  { cle: 'whatsapp', nom: 'WhatsApp', couleur: '#25D366' },
  { cle: 'tiktok', nom: 'TikTok', couleur: '#FE2C55' },
  { cle: 'instagram', nom: 'Instagram', couleur: '#E1306C' },
  { cle: 'facebook', nom: 'Facebook', couleur: '#1877F2' },
];

/**
 * Où envoyer la personne quand le téléphone ne sait pas partager un fichier.
 *
 * WhatsApp et Facebook acceptent un texte ou un lien : on leur passe l'adresse
 * du site, qui est de toute façon ce qu'on veut faire circuler. TikTok et
 * Instagram n'ont aucune adresse de publication : on ouvre l'application, et
 * l'affiche vient d'être enregistrée dans les images.
 */
export function lienDeSecours(reseau: Reseau): string {
  const texte = encodeURIComponent('Mon activité d’analyse du jour avec ProFoot AI — https://profootai.com');
  switch (reseau) {
    case 'whatsapp':
      return `https://wa.me/?text=${texte}`;
    case 'facebook':
      return 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fprofootai.com';
    case 'tiktok':
      return 'https://www.tiktok.com/upload';
    case 'instagram':
      return 'https://www.instagram.com/';
  }
}

/** Les glyphes, dessinés à la main : aucune bibliothèque ne porte ces marques. */
export function GlypheReseau({ reseau, taille = 20 }: { reseau: Reseau; taille?: number }) {
  const commun = { width: taille, height: taille, viewBox: '0 0 24 24', fill: 'currentColor' as const };

  if (reseau === 'whatsapp')
    return (
      <svg {...commun} aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.25-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.43 9.89-9.88 9.89m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41" />
      </svg>
    );

  if (reseau === 'tiktok')
    return (
      <svg {...commun} aria-hidden="true">
        <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07" />
      </svg>
    );

  if (reseau === 'facebook')
    return (
      <svg {...commun} aria-hidden="true">
        <path d="M9.2 21.5h4v-8.01h3.6l.4-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.4 3.98h2.4v8.01z" />
      </svg>
    );

  // Instagram : le carré arrondi, l'objectif et le témoin. Dessiné en traits
  // plutôt qu'en aplat — un aplat rendrait un rectangle plein illisible.
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
