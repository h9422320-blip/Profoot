'use client';

import { useEffect } from 'react';

/**
 * RATTRAPER UN MORCEAU DE CODE MANQUANT AVANT QUE L'ONGLET NE MEURE.
 *
 * ── POURQUOI `global-error.tsx` NE SUFFIT PAS ─────────────────────────────
 *
 * La barrière de Next.js n'attrape que ce qui casse PENDANT le rendu d'un
 * composant. Or un morceau de code qui manque échoue le plus souvent AILLEURS :
 *
 *   • dans un import à la demande, qui rend une promesse rejetée ;
 *   • au chargement d'une balise script, qui déclenche un `error` de fenêtre.
 *
 * Ni l'un ni l'autre ne passe par React. Le navigateur, lui, finit par
 * abandonner l'onglet — c'est la page noire « This page couldn't load » qu'un
 * client a vue le 3 septembre 2026 au moment où son analyse allait s'afficher.
 *
 * ── CE QU'ON ÉCOUTE ───────────────────────────────────────────────────────
 *
 * Les deux, au niveau de la fenêtre, dès le premier rendu. C'est le seul
 * endroit où l'on voit passer ces échecs-là.
 *
 * ── POURQUOI RECHARGER EST LA BONNE RÉPONSE ───────────────────────────────
 *
 * Un morceau manquant vient toujours de la même cause : l'application a été
 * remise en ligne, les noms de fichiers ont changé, et le téléphone réclame les
 * anciens. Recharger redemande la page, obtient les nouveaux noms, et tout
 * repart. Il n'y a rien d'autre à faire, et surtout rien à demander à quelqu'un
 * qui n'y peut rien.
 *
 * ── UNE SEULE FOIS, ET C'EST ESSENTIEL ────────────────────────────────────
 *
 * Le drapeau de session interdit la boucle. Si le rechargement ne règle rien,
 * la deuxième fois on laisse l'erreur remonter jusqu'au message en français
 * plutôt que de faire clignoter le téléphone indéfiniment.
 *
 * Le drapeau est retiré au bout de dix secondes de fonctionnement normal :
 * sans cela, un incident du matin empêcherait le rattrapage de l'après-midi.
 */

const SIGNES = [
  'ChunkLoadError',
  'Loading chunk',
  'Loading CSS chunk',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
];

const CLE = 'profoot:recharge-morceau';

export default function RecuperationChargement() {
  useEffect(() => {
    const concerne = (v: unknown) => {
      const texte = String(
        (v as any)?.message ?? (v as any)?.name ?? v ?? ''
      );
      return SIGNES.some((s) => texte.includes(s));
    };

    const recharger = () => {
      try {
        if (sessionStorage.getItem(CLE)) return;
        sessionStorage.setItem(CLE, '1');
      } catch {
        /* Stockage refusé : on recharge quand même, une fois. */
      }
      window.location.reload();
    };

    const surErreur = (e: ErrorEvent) => {
      if (concerne(e.error) || concerne(e.message)) recharger();
    };
    const surRejet = (e: PromiseRejectionEvent) => {
      if (concerne(e.reason)) recharger();
    };

    window.addEventListener('error', surErreur);
    window.addEventListener('unhandledrejection', surRejet);

    // Dix secondes sans incident : la page tourne, le drapeau peut partir.
    const oubli = setTimeout(() => {
      try {
        sessionStorage.removeItem(CLE);
      } catch {
        /* sans importance */
      }
    }, 10_000);

    return () => {
      window.removeEventListener('error', surErreur);
      window.removeEventListener('unhandledrejection', surRejet);
      clearTimeout(oubli);
    };
  }, []);

  return null;
}
