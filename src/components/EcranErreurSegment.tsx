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
import { resumeDeLErreur } from '@/lib/erreurs-affichage';
import { estErreurReparableParRechargement, rechargerUneFois } from '@/lib/nouvelle-version';

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
//
// ── ET CE QUI LUI MANQUAIT, TROUVÉ LE 16 SEPTEMBRE 2026 ────────────────────
//
// Ce détecteur ne connaissait QUE la forme E394. La panne la plus fréquente de
// la même famille — un morceau de code renommé par une mise en ligne, que
// Turbopack signale par `ChunkLoadError: Failed to load chunk …` — passait à
// travers et tombait sur l'écran d'erreur ordinaire. C'est exactement la
// capture envoyée par le propriétaire le 16 au matin sur Atlético–Osasuna, après
// plusieurs mises en ligne.
//
// Les coupures réseau (« Failed to fetch », « Load failed »…) n'y étaient pas
// non plus, alors que `global-error.tsx` les connaissait depuis le
// 10 septembre. Trois listes recopiées avaient divergé.
//
// La reconnaissance et le rechargement vivent désormais à UN SEUL endroit,
// `nouvelle-version.ts`, partagé avec la barrière racine et avec l'écoute de la
// fenêtre. Ici la page est déjà tombée : on accepte donc aussi les coupures
// réseau, qu'un rechargement répare tout autant.

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

  // ── LA CAUSE EXACTE PART AU SERVEUR, POUR NE PLUS JAMAIS DEVINER ────────
  //
  // Le 16 septembre 2026, le plantage est revenu sur Atlético–Osasuna et je
  // n'ai PAS pu le reproduire — ni en gratuit, ni en abonné, ni en mobile. Une
  // erreur survenue dans le navigateur n'apparaît dans aucun journal du
  // serveur, et l'écran n'en disait rien. Désormais elle part ici, avant même
  // que la page ne tente de se réparer.
  //
  // `sendBeacon` d'abord : il survit à un rechargement immédiat, ce qu'un
  // simple `fetch` ne garantit pas.
  useEffect(() => {
    try {
      const e = error as Error & { digest?: string; __NEXT_ERROR_CODE?: string };
      const corps = JSON.stringify({
        code: e?.__NEXT_ERROR_CODE ?? '',
        nom: e?.name ?? '',
        message: e?.message ?? '',
        pile: String(e?.stack ?? '').slice(0, 1200),
        chemin: typeof window !== 'undefined' ? window.location.pathname : '',
        digest: e?.digest ?? '',
        version: typeof document !== 'undefined' ? document.documentElement.getAttribute('data-dpl-id') ?? '' : '',
      });
      const envoye =
        typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
          ? navigator.sendBeacon('/api/erreur-affichage', new Blob([corps], { type: 'application/json' }))
          : false;
      if (!envoye) {
        void fetch('/api/erreur-affichage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corps,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Le signalement ne doit jamais aggraver la panne.
    }
  }, [error]);

  useEffect(() => {
    if (!estErreurReparableParRechargement(error)) return;
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

        {/* ── ET LA NATURE DE LA PANNE, MÊME SANS IDENTIFIANT ───────────────
            Une erreur née dans le navigateur n'a pas de `digest` : l'écran ne
            disait alors RIEN, et chaque capture d'écran obligeait à deviner.
            Ce résumé part avec la capture sans que personne ait à y penser. */}
        {resumeDeLErreur(error) ? (
          <p className="mt-2 break-words font-mono text-[10px] leading-snug text-white/25">
            {resumeDeLErreur(error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
