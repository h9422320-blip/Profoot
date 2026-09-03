'use client';

import { useEffect } from 'react';

/**
 * LA DERNIÈRE BARRIÈRE : PLUS JAMAIS DE PAGE NOIRE.
 *
 * ── CE QUE VOYAIT UN CLIENT LE 3 SEPTEMBRE 2026 ───────────────────────────
 *
 * Une page noire, un triangle, et « This page couldn't load — Reload to try
 * again, or go back ». En anglais, sur une application française, au moment
 * précis où son analyse allait s'afficher. Le propriétaire l'a eue en pleine
 * journée de ventes.
 *
 * Ce n'est pas une erreur du serveur : l'analyse avait abouti, elle était même
 * enregistrée en base. C'est le NAVIGATEUR qui a abandonné.
 *
 * ── POURQUOI ÇA ARRIVE ────────────────────────────────────────────────────
 *
 * L'application est découpée en morceaux de code chargés à la demande. Chaque
 * mise en ligne en change les noms. Un téléphone qui garde la page ouverte —
 * ou son cache — réclame donc un morceau qui n'existe plus, et le navigateur
 * tue l'onglet.
 *
 * Sept mises en ligne ont eu lieu le 3 septembre. Chacune pouvait casser la
 * page de quelqu'un en train d'analyser un match.
 *
 * ── CE QU'ON FAIT, ET POURQUOI C'EST SÛR ──────────────────────────────────
 *
 * Un morceau manquant se répare en rechargeant : le navigateur redemande la
 * page, obtient les nouveaux noms, et tout repart. On le fait donc
 * automatiquement, sans rien demander à quelqu'un qui n'y peut rien.
 *
 * UNE SEULE FOIS. Le drapeau posé dans la session empêche la boucle : si le
 * rechargement ne règle pas le problème, la deuxième fois on affiche un vrai
 * message plutôt que de faire clignoter le téléphone indéfiniment.
 *
 * ── ET SI CE N'EST PAS UN MORCEAU MANQUANT ────────────────────────────────
 *
 * On affiche un message en français, avec un bouton qui réessaie. Jamais une
 * page anglaise du navigateur : quelqu'un qui vient de payer doit comprendre
 * ce qu'il lit, et savoir que son accès n'est pas perdu.
 */

/** Ce qui, dans un message d'erreur, désigne un morceau de code manquant. */
const SIGNES_MORCEAU_MANQUANT = [
  'ChunkLoadError',
  'Loading chunk',
  'Loading CSS chunk',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
];

const CLE_RECHARGE = 'profoot:recharge-morceau';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const morceauManquant = SIGNES_MORCEAU_MANQUANT.some(
    (signe) =>
      String(error?.name ?? '').includes(signe) ||
      String(error?.message ?? '').includes(signe)
  );

  useEffect(() => {
    if (!morceauManquant) return;
    try {
      // Une seule tentative : deux rechargements d'affilée signifient que le
      // problème est ailleurs, et une page qui se recharge en boucle est pire
      // qu'une page en erreur.
      if (sessionStorage.getItem(CLE_RECHARGE)) return;
      sessionStorage.setItem(CLE_RECHARGE, '1');
      window.location.reload();
    } catch {
      /* Navigation privée, stockage refusé : on laisse le message s'afficher. */
    }
  }, [morceauManquant]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1418',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(16,185,129,.12)',
              color: '#34D399',
              lineHeight: '48px',
              fontSize: 24,
              margin: '0 auto 18px',
            }}
          >
            ↻
          </div>

          <h1 style={{ fontSize: 21, margin: '0 0 12px', lineHeight: 1.25 }}>
            {morceauManquant ? 'Mise à jour en cours' : 'Un souci est survenu'}
          </h1>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,.62)',
              margin: '0 0 22px',
            }}
          >
            {morceauManquant
              ? "L'application vient d'être mise à jour. On recharge la page — votre accès et vos analyses sont intacts."
              : "L'affichage s'est interrompu. Votre accès et vos analyses sont intacts : réessayez, rien n'est perdu."}
          </p>

          <button
            onClick={() => {
              try {
                sessionStorage.removeItem(CLE_RECHARGE);
              } catch {
                /* sans importance */
              }
              reset();
            }}
            style={{
              minHeight: 48,
              padding: '0 26px',
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg,#2DD4BF,#10B981)',
              color: '#101c24',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
