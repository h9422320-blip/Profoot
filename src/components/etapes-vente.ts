'use client';

/**
 * LES ÉTAPES DU TUNNEL DE VENTE, MESURÉES.
 *
 * ── LE TROU QU'ON VIENT COMBLER ───────────────────────────────────────────
 *
 * Le 23 août 2026, on connaissait les deux bouts et rien du milieu :
 *
 *     900 visiteurs voient les tarifs        (mesure maison)
 *       ?  cliquent sur une offre            ← inconnu
 *       ?  lisent la notice de paiement      ← inconnu
 *       ?  partent vers Chariow              ← inconnu
 *     417 arrivent en caisse                 (Chariow)
 *      48 paient                             (Chariow)
 *
 * Trois cent soixante-neuf personnes atteignaient la caisse et repartaient sans
 * payer. Impossible de savoir où elles décrochaient — donc impossible de
 * corriger autrement qu'au hasard.
 *
 * ── POURQUOI AUCUNE NOUVELLE TABLE ────────────────────────────────────────
 *
 * Ces étapes s'enregistrent dans `visites_pages`, exactement comme une page
 * vue, sous un chemin qui commence par `/~`. Elles héritent donc de tout ce qui
 * existe déjà : l'identifiant de visite qui relie les étapes entre elles, le
 * pays, le support, la limite d'écriture, le signal qui survit à la fermeture
 * de l'onglet.
 *
 * Créer une table aurait demandé une manipulation de plus dans Supabase, pour
 * un résultat identique. Le préfixe `/~` les distingue des vraies pages, et la
 * lecture les écarte des statistiques de fréquentation.
 *
 * ── CE QUI N'EST PAS ENREGISTRÉ ───────────────────────────────────────────
 *
 * Ni qui, ni quel montant, ni quel moyen de paiement. Seulement l'étape
 * atteinte et l'offre concernée — de quoi savoir OÙ ça casse, jamais QUI est
 * concerné.
 */

/** Les étapes, du clic jusqu'au départ vers la caisse. */
export type EtapeVente =
  /** L'acheteur a cliqué sur une offre : la notice s'ouvre. */
  | 'offre-cliquee'
  /** Il a cliqué lui-même sur « Continuer vers le paiement ». */
  | 'notice-continuer'
  /** Il a fermé la notice sans aller au paiement. */
  | 'notice-fermee'
  /** Il n'a rien fait : la redirection automatique s'est déclenchée. */
  | 'notice-auto'
  /** Le lien de paiement est obtenu, le navigateur part vers Chariow. */
  | 'depart-caisse'
  /** La création du lien a échoué : personne n'atteindra la caisse. */
  | 'echec-lien';

const CLE_VISITE = 'pf_visite';

function identifiantDeVisite(): string {
  try {
    const existant = sessionStorage.getItem(CLE_VISITE);
    if (existant) return existant;
    const neuf = crypto.randomUUID().slice(0, 18);
    sessionStorage.setItem(CLE_VISITE, neuf);
    return neuf;
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Enregistre une étape du tunnel.
 *
 * Ne renvoie rien et n'attend rien : une mesure qui ferait patienter quelqu'un
 * au moment de payer coûterait infiniment plus cher que ce qu'elle apprend.
 *
 * `sendBeacon` est utilisé parce que l'étape la plus importante — le départ
 * vers Chariow — se produit juste avant que la page soit détruite. Un `fetch`
 * ordinaire serait annulé par le navigateur, et l'on ne mesurerait que les
 * gens qui restent.
 */
export function signalerEtape(etape: EtapeVente, offre?: string): void {
  try {
    const charge = JSON.stringify({
      type: 'arrivee',
      vueId: crypto.randomUUID().slice(0, 18),
      visiteId: identifiantDeVisite(),
      // Le chemin porte l'étape et l'offre : « /~offre-cliquee/pro_monthly ».
      chemin: `/~${etape}${offre ? `/${offre}` : ''}`,
      // Les étapes ne s'ordonnent pas comme des pages : le rang n'a pas de
      // sens ici, et le mettre à 1 les ferait passer pour des arrivées.
      ordre: 99,
      mobile: window.matchMedia('(max-width: 767px)').matches,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/mesure', new Blob([charge], { type: 'application/json' }));
      return;
    }
    void fetch('/api/mesure', {
      method: 'POST',
      body: charge,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Une mesure ne doit jamais gêner un achat. Un échec est silencieux.
  }
}
