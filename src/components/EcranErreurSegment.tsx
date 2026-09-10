'use client';

/**
 * L'ÉCRAN QU'ON MONTRE QUAND UNE SECTION TOMBE — ET UNE SEULE FOIS ÉCRIT.
 *
 * ── POURQUOI IL EXISTE ───────────────────────────────────────────────────
 *
 * Le 10 septembre 2026 à 11 h 46, un client payant a photographié un écran
 * noir plein cadre : « Un souci est survenu ». Plus de menu, plus de logo,
 * plus rien. Et le bouton « Réessayer » ne faisait rien du tout.
 *
 * Deux causes, réparées ensemble :
 *
 *   1. `global-error.tsx` était la SEULE barrière d'erreur du projet. Elle
 *      remplace le gabarit racine : tout ce qui échouait, n'importe où,
 *      remontait jusqu'à elle et emportait l'application entière.
 *
 *   2. Le bouton appelait `reset()`. Dans cette version du cadre, `reset()`
 *      « efface l'état d'erreur et re-rend les enfants SANS aller rechercher
 *      le contenu » : sur une panne serveur, il rejoue l'échec à l'identique,
 *      instantanément. C'est `retry()` qui redemande au serveur.
 *
 * ── POURQUOI UN COMPOSANT PARTAGÉ ────────────────────────────────────────
 *
 * Chaque segment a besoin de son `error.tsx`, et ils diraient tous la même
 * chose. Deux copies divergent toujours — ce projet en a déjà fait les frais
 * avec le banc d'essai qui mesurait un moteur différent de la production.
 * Le texte, le bouton et l'identifiant vivent donc ici, à un seul endroit.
 */

export interface ProprietesErreurSegment {
  error: Error & { digest?: string };
  /** Redemande le contenu au serveur. Le nom retenu par cette version. */
  retry?: () => void;
  /** Ancien nom, accepté en repli — il ne recherche rien à lui seul. */
  reset?: () => void;
  /** Le titre, adapté à ce que le visiteur était en train de faire. */
  titre?: string;
}

export default function EcranErreurSegment({
  error,
  retry,
  reset,
  titre = 'Cette page n’a pas pu s’afficher',
}: ProprietesErreurSegment) {
  const reessayer = () => {
    // `retry` d'abord : lui seul va rechercher le contenu. À défaut, un
    // rechargement complet, qui répare ce qu'un re-rendu ne peut pas réparer.
    if (typeof retry === 'function') {
      retry();
      return;
    }
    try {
      window.location.reload();
    } catch {
      reset?.();
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: 'rgba(16,185,129,.12)', color: '#34D399' }}
        >
          ↻
        </div>

        <h2 className="mb-3 text-xl font-bold text-white">{titre}</h2>

        <p className="mb-6 text-sm leading-relaxed text-white/60">
          Votre accès et vos analyses sont intacts, rien n’est perdu. Réessayez —
          ou passez par le menu pour continuer ailleurs.
        </p>

        <button
          onClick={reessayer}
          className="min-h-[48px] rounded-full px-7 text-sm font-extrabold"
          style={{ background: 'linear-gradient(135deg,#2DD4BF,#10B981)', color: '#101c24' }}
        >
          Réessayer
        </button>

        {/* ── L'IDENTIFIANT REND LA CAPTURE D'ÉCRAN EXPLOITABLE ──────────────
            En production, le message d'une erreur venue du serveur est
            volontairement générique : il ne dit rien de la cause. Seul
            `digest` permet de retrouver la ligne correspondante dans les
            traces du serveur. Sans lui, il ne reste qu'à deviner — c'est
            exactement ce qui s'est passé le 10 septembre 2026.

            Écrit petit et sans couleur : celui qui n'en a pas besoin ne le
            remarque pas, celui qui aide le client l'a sous les yeux. */}
        {error?.digest ? (
          <p className="mt-5 font-mono text-[11px] tracking-wide text-white/30">
            réf. {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
