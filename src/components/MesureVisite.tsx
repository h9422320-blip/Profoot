'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * LA MESURE MAISON : CE QUE LE VISITEUR REGARDE, ET COMBIEN DE TEMPS.
 *
 * ── POURQUOI ON NE S'EN REMET PLUS À CLARITY ──────────────────────────────
 *
 * Microsoft plafonne à dix appels par jour et rend ses chiffres avec un à trois
 * jours de retard. Le 22 août 2026 au soir, le quota a été épuisé en ouvrant
 * deux pages d'administration trois fois de suite : plus aucun chiffre pendant
 * trente-six heures.
 *
 * Les questions qui comptent — où les gens arrivent, où ils s'attardent, où ils
 * ferment — se répondent avec ce que l'application voit elle-même. Sans
 * plafond, en temps réel, et sur NOTRE tunnel de vente, que Microsoft ignore.
 *
 * ── CE QUI EST ENVOYÉ, ET RIEN D'AUTRE ────────────────────────────────────
 *
 * Le chemin de la page, l'instant d'arrivée, la durée, et un numéro tiré au
 * hasard pour relier les pages d'un même passage. Pas de cookie, pas
 * d'identifiant durable, rien de personnel : le numéro est oublié dès que
 * l'onglet se ferme.
 *
 * ── POURQUOI DEUX SIGNAUX PLUTÔT QU'UN ────────────────────────────────────
 *
 * L'arrivée est enregistrée tout de suite. Le départ complète la ligne avec la
 * durée.
 *
 * N'envoyer qu'au départ aurait été plus économe, mais une fermeture brutale —
 * réseau coupé, onglet tué par le téléphone — aurait effacé la visite entière.
 * Or ces visites-là sont précisément les plus instructives : ce sont celles où
 * quelque chose s'est mal passé. Une page vue sans durée reste une page vue.
 *
 * ── `sendBeacon`, ET PAS `fetch` ──────────────────────────────────────────
 *
 * Au moment où l'on quitte une page, le navigateur annule les requêtes en
 * cours : un `fetch` classique n'arriverait jamais. `sendBeacon` est fait pour
 * ça — il confie le message au navigateur, qui l'expédie même après la
 * fermeture. Sans lui, on ne mesurerait que les gens qui restent.
 */

const CLE_VISITE = 'pf_visite';
const CLE_ORDRE = 'pf_ordre';

/** Un identifiant court, au hasard, sans rien de reconnaissable. */
function tirerAuHasard(): string {
  try {
    return crypto.randomUUID().slice(0, 18);
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * L'identifiant du passage en cours.
 *
 * Il vit dans `sessionStorage` : effacé à la fermeture de l'onglet, jamais
 * partagé entre deux onglets. C'est exactement la définition d'une visite.
 */
function identifiantDeVisite(): string {
  try {
    const existant = sessionStorage.getItem(CLE_VISITE);
    if (existant) return existant;
    const neuf = tirerAuHasard();
    sessionStorage.setItem(CLE_VISITE, neuf);
    return neuf;
  } catch {
    // Navigation privée stricte : on mesure quand même, sans recoller le chemin.
    return tirerAuHasard();
  }
}

function prochainOrdre(): number {
  try {
    const n = Number(sessionStorage.getItem(CLE_ORDRE) ?? '0') + 1;
    sessionStorage.setItem(CLE_ORDRE, String(n));
    return n;
  } catch {
    return 1;
  }
}

function envoyer(charge: Record<string, unknown>): void {
  try {
    const corps = JSON.stringify(charge);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/mesure', new Blob([corps], { type: 'application/json' }));
      return;
    }
    // Navigateurs anciens : `keepalive` demande la même chose à `fetch`.
    void fetch('/api/mesure', {
      method: 'POST',
      body: corps,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // La mesure ne doit jamais gêner la personne qui visite. Un échec est
    // silencieux : perdre une ligne de statistique est sans conséquence,
    // afficher une erreur au visiteur en aurait une.
  }
}

export default function MesureVisite() {
  const chemin = usePathname();
  const vueRef = useRef<string | null>(null);
  const debutRef = useRef<number>(0);
  const envoyeRef = useRef(false);

  useEffect(() => {
    if (!chemin) return;

    // L'administration ne se mesure pas elle-même : ce sont les visiteurs qu'on
    // observe, pas le propriétaire en train de les observer.
    if (chemin.startsWith('/admin')) return;

    const vueId = tirerAuHasard();
    vueRef.current = vueId;
    debutRef.current = Date.now();
    envoyeRef.current = false;

    envoyer({
      type: 'arrivee',
      vueId,
      visiteId: identifiantDeVisite(),
      chemin,
      ordre: prochainOrdre(),
      mobile: window.matchMedia('(max-width: 767px)').matches,
    });

    const partir = () => {
      // Une seule fois : `pagehide` et `visibilitychange` se déclenchent
      // souvent tous les deux, et compteraient la page en double.
      if (envoyeRef.current) return;
      envoyeRef.current = true;
      envoyer({ type: 'depart', vueId, dureeMs: Date.now() - debutRef.current });
    };

    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') partir();
    };

    // `pagehide` couvre la fermeture et la navigation ; `visibilitychange`
    // rattrape le cas du téléphone qu'on verrouille ou de l'application qu'on
    // met en arrière-plan — très fréquent sur mobile, et invisible autrement.
    window.addEventListener('pagehide', partir);
    document.addEventListener('visibilitychange', surVisibilite);

    return () => {
      window.removeEventListener('pagehide', partir);
      document.removeEventListener('visibilitychange', surVisibilite);
      // Changement de page à l'intérieur du site : le départ se note ici.
      partir();
    };
  }, [chemin]);

  return null;
}
