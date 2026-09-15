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

import { useEffect, useState } from 'react';

/**
 * ── LA PANNE QUI N'EN EST PAS UNE : LE DÉCALAGE DE VERSION ────────────────
 *
 * CE QUI SE PASSE
 *
 * Le navigateur garde la version qu'il a chargée en arrivant. Chaque mise en
 * ligne change celle du serveur. Quand l'abonné déclenche alors une action —
 * lancer une analyse, changer de page — le serveur répond dans une version que
 * son navigateur ne sait plus lire. Next abandonne avec, mot pour mot :
 *
 *     An unexpected response was received from the server.   (code E394)
 *
 * Relevé en production le 15 septembre 2026, l'erreur en main, sur une session
 * ouverte avant une mise en ligne.
 *
 * POURQUOI ÇA TOMBE SUR L'ANALYSE
 *
 * Une analyse dure une minute et demie : c'est la fenêtre la plus large de
 * toute l'application pour qu'une mise en ligne tombe au milieu. Le
 * propriétaire l'a rencontrée quatre ou cinq fois en deux jours, dont deux fois
 * sur le match mis en avant de la page d'accueil — celui qu'ouvre justement
 * quelqu'un qui découvre l'application. Il voit une page d'erreur, il s'en va,
 * et il n'achète jamais.
 *
 * CE QU'IL FAUT COMPRENDRE : IL N'Y A RIEN DE CASSÉ.
 *
 * Le contenu est intact, le compte est intact. Il suffit de recharger pour
 * prendre la nouvelle version. C'est exactement ce qu'on fait ici, tout seul,
 * sans rien demander à personne.
 *
 * `deploymentId` (voir `next.config.ts`) fait normalement ce rechargement plus
 * tôt, avant même l'erreur. Mais il ne protège QUE les navigateurs qui ont déjà
 * chargé une version qui le porte : le jour où on l'installe, tous ceux qui
 * sont déjà sur le site passent à côté. Ce filet-ci, lui, rattrape aussi
 * ceux-là — et toute panne de la même famille qu'on n'aurait pas prévue.
 */
const ERREUR_DE_VERSION = (error: unknown): boolean => {
  const e = error as { message?: unknown; __NEXT_ERROR_CODE?: unknown } | null;
  if (!e) return false;
  if (String(e.__NEXT_ERROR_CODE ?? '') === 'E394') return true;
  return /unexpected response was received from the server/i.test(String(e.message ?? ''));
};

/**
 * Un rechargement, pas deux.
 *
 * Si le serveur est RÉELLEMENT en panne et répond mal à chaque fois, recharger
 * en boucle ferait clignoter la page à l'infini — bien pire que l'écran
 * d'erreur. On note donc l'heure du rechargement : au-delà d'un par demi-minute,
 * on s'arrête et on montre l'écran normal, qui laisse la main.
 */
const CLE_RECHARGEMENT = 'profoot_rechargement_version';
const ENTRE_DEUX_MS = 30_000;

function rechargerUneFois(): boolean {
  try {
    const dernier = Number(sessionStorage.getItem(CLE_RECHARGEMENT) ?? 0);
    if (Number.isFinite(dernier) && Date.now() - dernier < ENTRE_DEUX_MS) return false;
    sessionStorage.setItem(CLE_RECHARGEMENT, String(Date.now()));
  } catch {
    // Navigation privée, stockage refusé : on recharge quand même une fois.
    // Le pire cas est un second rechargement, pas une boucle — l'erreur de
    // version disparaît dès que la nouvelle version est chargée.
  }
  try {
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

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
  // Vrai le temps que le rechargement parte : on ne montre pas « ça a raté »
  // à quelqu'un dont la page est déjà en train de se réparer.
  const [enTrainDeReparer, setEnTrainDeReparer] = useState(false);

  useEffect(() => {
    if (!ERREUR_DE_VERSION(error)) return;
    if (rechargerUneFois()) setEnTrainDeReparer(true);
  }, [error]);

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

        <h2 className="mb-3 text-xl font-bold text-white">
          {enTrainDeReparer ? 'Un instant, on actualise…' : titre}
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-white/60">
          {enTrainDeReparer
            ? 'Une nouvelle version vient d’être mise en ligne. La page se recharge toute seule — vos analyses et votre accès sont intacts.'
            : 'Votre accès et vos analyses sont intacts, rien n’est perdu. Réessayez — ou passez par le menu pour continuer ailleurs.'}
        </p>

        {/* Pendant le rechargement, le bouton n'a plus rien à faire : le
            proposer inviterait à cliquer sur une page qui s'en va déjà. */}
        {enTrainDeReparer ? null : (
          <button
            onClick={reessayer}
            className="min-h-[48px] rounded-full px-7 text-sm font-extrabold"
            style={{ background: 'linear-gradient(135deg,#2DD4BF,#10B981)', color: '#101c24' }}
          >
            Réessayer
          </button>
        )}

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
