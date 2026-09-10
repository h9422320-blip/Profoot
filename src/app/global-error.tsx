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

/**
 * ── CE QUI, DANS UN MESSAGE, DÉSIGNE UNE COUPURE RÉPARABLE PAR RECHARGEMENT ─
 *
 * Les six premiers signes visaient le morceau de code manquant après une mise
 * en ligne. Les suivants ont été ajoutés le 10 septembre 2026 : sur un
 * téléphone à 16 % de batterie, en 3G, ce n'est pas toujours le morceau qui
 * manque — c'est la requête qui n'aboutit pas. Le navigateur dit alors
 * « Failed to fetch », « Load failed » (Safari) ou « NetworkError », et
 * l'ancienne liste ne reconnaissait rien : le visiteur restait bloqué sur un
 * écran définitif alors qu'un simple rechargement suffisait.
 */
const SIGNES_MORCEAU_MANQUANT = [
  'ChunkLoadError',
  'Loading chunk',
  'Loading CSS chunk',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  // Une coupure réseau pendant le chargement d'un morceau ou d'une page.
  'Failed to fetch',
  'NetworkError',
  'Load failed',
  'Failed to load',
  'network error',
  'Connection closed',
  'Connection terminated',
];

const CLE_RECHARGE = 'profoot:recharge-morceau';

export default function GlobalError({
  error,
  // ── « retry », ET NON « reset » ────────────────────────────────────────
  //
  // Le bouton recevait `reset`. Or, dans cette version de Next, `reset()`
  // « efface l'état d'erreur et re-rend les enfants SANS aller rechercher le
  // contenu » — il rejoue donc exactement le rendu qui vient d'échouer. Sur
  // une panne côté serveur, la seule chose qu'il pouvait produire était le
  // même écran, instantanément.
  //
  // C'est ce qu'un client payant a photographié le 10 septembre 2026 à
  // 11 h 46 : il appuyait sur « Réessayer », et rien ne se passait.
  //
  // `retry()` va, lui, RECHERCHER le contenu avant de re-rendre. Les deux
  // sont acceptés ici — le nom a changé selon les versions — et si aucun
  // n'est fourni, on recharge la page, ce qui répare toujours.
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const texte = `${error?.name ?? ''} ${error?.message ?? ''}`;
  const morceauManquant = SIGNES_MORCEAU_MANQUANT.some((signe) => texte.includes(signe));

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
              // ── LE BOUTON DOIT TOUJOURS FAIRE QUELQUE CHOSE ──────────────
              //
              // `retry` d'abord : il redemande le contenu au serveur. À
              // défaut, un rechargement complet, qui répare tout ce qu'un
              // re-rendu ne peut pas réparer. Ne jamais appeler `reset` seul :
              // il rejoue le rendu qui vient d'échouer.
              if (typeof retry === 'function') {
                retry();
                return;
              }
              try {
                window.location.reload();
              } catch {
                reset?.();
              }
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

          {/* ── L'IDENTIFIANT, POUR QUE LA CAPTURE D'ÉCRAN SERVE À QUELQUE CHOSE ──
              En production, le message d'une erreur venue du serveur est
              volontairement générique : il ne dit rien de la cause. Seul
              `digest` — un condensé posé par le cadre — permet de retrouver
              la ligne correspondante dans les traces du serveur.

              Sans lui, un client envoie une photo de cet écran et il ne reste
              qu'à deviner. C'est ce qui s'est passé le 10 septembre 2026.

              Il est écrit petit et sans couleur : celui qui n'en a pas besoin
              ne le remarque pas, celui qui aide le client l'a sous les yeux. */}
          {error?.digest ? (
            <p
              style={{
                margin: '18px 0 0',
                fontSize: 11,
                letterSpacing: '.04em',
                color: 'rgba(255,255,255,.34)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              réf. {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
