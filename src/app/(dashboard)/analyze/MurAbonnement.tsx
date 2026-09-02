'use client';

import Link from 'next/link';
import { signalerEtape } from '@/components/etapes-vente';

/**
 * LE MUR DE PAIEMENT, POSÉ SUR L'ANALYSE FLOUTÉE.
 *
 * ── IL A EU DEUX CHEMINS, IL N'EN A PLUS QU'UN ────────────────────────────
 *
 * Jusqu'au 2 septembre 2026, ce mur proposait deux issues : débloquer LA
 * rencontre pour 600 FCFA, ou prendre un abonnement. Le premier a été supprimé
 * du catalogue par le propriétaire ; il ne reste que les trois abonnements —
 * 2 000, 5 000 et 15 000 FCFA.
 *
 * L'achat à l'unité avait produit DEUX ventes en tout, les 13 août, par la même
 * personne, sur des rencontres jouées depuis longtemps. Il occupait le bouton
 * principal du mur le plus vu du site pour 1 200 FCFA de recettes cumulées.
 *
 * ── CE QUE SON RETRAIT CHANGE À L'ÉCRAN ───────────────────────────────────
 *
 * Le bouton d'abonnement était le second, en gris, sous un séparateur « ou ».
 * Il devient le seul, et reprend l'aspect appuyé qui revenait au chemin court.
 * Un mur qui offre un choix unique n'a pas besoin de hiérarchie : il a besoin
 * d'être clair.
 *
 * ── CE QU'IL NE FAUT PAS Y REMETTRE ───────────────────────────────────────
 *
 * Ni achat à l'unité, ni essai gratuit, ni analyse offerte. Le contenu payant
 * s'ouvre contre un abonnement, et rien d'autre. Toute autre idée est une
 * décision commerciale qui appartient au propriétaire — elle ne se prend pas
 * dans un fichier de code.
 *
 * ── POURQUOI IL N'APPELLE AUCUNE CAISSE ───────────────────────────────────
 *
 * Il envoie lire les prix, et c'est tout. La notice de paiement, la détection
 * du pays et l'appel à la caisse vivent sur `/pricing`, en un seul exemplaire.
 * Les dupliquer ici avait un coût réel : quarante-huit kilo-octets de table des
 * moyens de paiement chargés sur l'écran d'analyse, et deux chemins d'achat à
 * maintenir d'accord entre eux.
 */
export default function MurAbonnement({
  prixOffreComplete,
  quotaOffreComplete,
}: {
  /** Prix de l'offre d'entrée, tel que réglé dans l'administration. */
  prixOffreComplete: number;
  /** Nombre d'analyses de cette offre — `null` si elle est illimitée. */
  quotaOffreComplete: number | null;
}) {
  return (
    <div
      className="w-full max-w-[340px] sm:max-w-[420px] mx-auto flex flex-col items-center rounded-[28px] px-5 py-7 sm:px-8 sm:py-9 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
      style={{ background: 'rgba(22,36,46,0.94)', backdropFilter: 'blur(8px)' }}
    >
      <h3
        className="text-[19px] leading-tight sm:text-2xl md:text-3xl font-black text-white mb-4 text-center"
        style={{ fontFamily: 'var(--police-titre), sans-serif' }}
      >
        Tu n&apos;as accès qu&apos;à 15% de notre analyse
      </h3>

      {/* La jauge dit la même chose que le titre, en une image. Elle vaut mieux
          qu'une phrase de plus : l'écran est déjà chargé, et le pouce est loin. */}
      <div className="w-full max-w-[220px] h-1.5 bg-white/10 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#10B981] to-[#2DD4BF] rounded-full"
          style={{ width: '15%' }}
        />
      </div>

      <p className="text-[13px] md:text-[14px] text-white/80 font-medium mb-6 max-w-[300px] leading-relaxed text-center">
        L&apos;analyse complète contient les indices de performance, les scénarios restants et les
        insights premium.
      </p>

      <Link
        href="/pricing"
        // Ce bouton n'ouvre aucune notice et ne mène à aucune caisse : il envoie
        // lire les prix. Il porte donc « vers-tarifs » et non « offre-cliquee » —
        // les confondre gonflait le haut de l'entonnoir et faisait apparaître une
        // fuite de 49 % qui n'était que le trajet normal vers la page des tarifs.
        onClick={() => signalerEtape('vers-tarifs')}
        className="w-full inline-flex items-center justify-center gap-2 font-black py-4 px-5 rounded-full transition-all text-[14px] sm:text-[15px] text-center shadow-[0_8px_32px_rgba(45,212,191,0.4)] hover:scale-[1.02] active:scale-95 min-h-[52px]"
        style={{
          background: 'linear-gradient(135deg, #2DD4BF 0%, #10B981 100%)',
          color: '#101c24',
        }}
      >
        🔒 Débloquer l&apos;analyse complète
      </Link>

      {/* Le prix est annoncé ICI, sous le bouton, et pas dessus. Un bouton qui
          porte un montant se lit comme un prélèvement immédiat ; celui-ci ne
          fait qu'ouvrir la page des tarifs. */}
      <p className="text-[11.5px] text-white/55 mt-3 text-center leading-relaxed">
        À partir de{' '}
        <strong className="text-white">
          {prixOffreComplete.toLocaleString('fr-FR')} FCFA / mois
        </strong>{' '}
        —{' '}
        {quotaOffreComplete === null
          ? 'analyses illimitées'
          : `${quotaOffreComplete} analyses complètes`}
      </p>
    </div>
  );
}
