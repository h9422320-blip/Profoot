'use client';

/**
 * UNE BARRIÈRE AUTOUR D'UN SEUL MORCEAU D'ÉCRAN.
 *
 * ── POURQUOI ELLE EXISTE ─────────────────────────────────────────────────
 *
 * Les 14 et 15 septembre 2026, le propriétaire a vu quatre ou cinq fois
 * « Cette page n'a pas pu s'afficher » au bout d'une analyse, dont deux fois
 * sur le match mis en avant de la page d'accueil. Ses mots : « ils vont
 * directement quitter l'application, ils vont dire que c'est de l'arnaque,
 * même le gratuit ne marche pas ».
 *
 * La cause principale — un déploiement qui change la version sous les pieds
 * d'une session ouverte — est traitée ailleurs, deux fois : `deploymentId`
 * dans `next.config.ts`, et le rechargement automatique dans
 * `EcranErreurSegment`.
 *
 * Mais aucune relecture de code ne peut PROMETTRE qu'aucun autre défaut
 * d'affichage n'existera jamais. L'audit du 15 septembre 2026 en a d'ailleurs
 * trouvé un, resté invisible des mois : sur un match terminé, le score annoncé
 * peut valoir `null`, et `result.score.split('-')` faisait alors tomber toute
 * la page.
 *
 * ── CE QU'ELLE CHANGE ────────────────────────────────────────────────────
 *
 * Sans elle, la moindre erreur dans l'affichage d'une analyse remonte jusqu'à
 * la barrière du segment, et TOUT le contenu disparaît — l'abonné se retrouve
 * devant un écran d'erreur, son analyse perdue.
 *
 * Avec elle, l'erreur s'arrête au morceau fautif. L'abonné garde la page, garde
 * le formulaire, et lit un message qui lui dit quoi faire. Le reste de
 * l'application ne bouge pas d'un pixel.
 *
 * ── ELLE NE CACHE RIEN ───────────────────────────────────────────────────
 *
 * L'erreur est journalisée telle quelle dans la console : un défaut d'affichage
 * doit rester trouvable. Elle est seulement CONTENUE, pas étouffée.
 */

import { Component, type ReactNode } from 'react';

interface Proprietes {
  children: ReactNode;
  /** Ce que lit l'abonné à la place du morceau tombé. */
  message?: string;
  /** Pour retrouver l'endroit dans les journaux. */
  ou?: string;
}

interface Etat {
  tombe: boolean;
}

export default class BarriereDeRendu extends Component<Proprietes, Etat> {
  state: Etat = { tombe: false };

  static getDerivedStateFromError(): Etat {
    return { tombe: true };
  }

  componentDidCatch(erreur: Error) {
    // Journalisé, jamais étouffé : sans cette ligne, un défaut d'affichage
    // deviendrait invisible et vivrait des mois.
    console.error(`[AFFICHAGE${this.props.ou ? ' ' + this.props.ou : ''}]`, erreur);
  }

  render() {
    if (!this.state.tombe) return this.props.children;

    return (
      <div
        className="rounded-[20px] border px-5 py-6 text-center"
        style={{ borderColor: 'rgba(255,255,255,.08)', background: 'rgba(29,47,58,.6)' }}
      >
        <p className="text-sm font-bold text-white">
          {this.props.message ?? 'Ce bloc n’a pas pu s’afficher.'}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
          Le reste de la page fonctionne, et rien n’est perdu. Relancez l’analyse —
          ou choisissez un autre match.
        </p>
      </div>
    );
  }
}
