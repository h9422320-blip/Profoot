'use client';

import { useEffect, useState } from 'react';
import { fuseauDuNavigateur } from '@/lib/pays-acheteur';

/**
 * D'où l'acheteur regarde la page — demandé au serveur, jamais deviné ici.
 *
 * ── POURQUOI LE NAVIGATEUR NE PEUT PAS RÉPONDRE SEUL ──────────────────────
 *
 * Le pays se lit dans les en-têtes posés par Cloudflare, que seul le serveur
 * reçoit. Le navigateur ne connaît que son fuseau horaire, et la base des
 * fuseaux fait pointer Bamako, Conakry, Dakar et Ouagadougou vers
 * « Africa/Abidjan » : utile en secours, insuffisant seul. Le fuseau est donc
 * transmis au serveur, qui tranche.
 *
 * ── L'APPEL N'A LIEU QU'AU MOMENT UTILE ───────────────────────────────────
 *
 * `actif` reste faux tant que la notice n'est pas ouverte. La page des tarifs
 * est l'une des plus visitées du site, et l'immense majorité des visiteurs ne
 * cliquent sur aucune offre : réveiller une fonction serveur pour chacun
 * d'eux coûterait du quota sans rien apporter.
 *
 * Renvoie `null` tant que la réponse n'est pas là, ou si le pays n'est pas
 * servi par la boutique. La notice affiche alors sa version générique — jamais
 * un pays inventé.
 */
export function usePaysAcheteur(actif: boolean): string | null {
  const [pays, setPays] = useState<string | null>(null);
  const [demande, setDemande] = useState(false);

  useEffect(() => {
    if (!actif || demande) return;
    setDemande(true);

    const url = `/api/paiement/pays?fuseau=${encodeURIComponent(fuseauDuNavigateur() ?? '')}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setPays(d?.pays ?? null))
      // Une détection qui échoue n'est pas une panne : la notice générique
      // reste juste, et le paiement part comme avant.
      .catch(() => setPays(null));
  }, [actif, demande]);

  return pays;
}
