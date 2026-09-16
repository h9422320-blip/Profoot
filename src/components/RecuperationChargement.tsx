'use client';

import { useEffect } from 'react';
import { estErreurDeVersion, estFichierDuSite, rechargerUneFois } from '@/lib/nouvelle-version';

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
 * ── POURQUOI RECHARGER EST LA BONNE RÉPONSE ───────────────────────────────
 *
 * Un morceau manquant vient toujours de la même cause : l'application a été
 * remise en ligne, les noms de fichiers ont changé, et le téléphone réclame les
 * anciens. Recharger redemande la page, obtient les nouveaux noms, et tout
 * repart. Il n'y a rien d'autre à faire, et surtout rien à demander à quelqu'un
 * qui n'y peut rien.
 *
 * ── LE DÉFAUT QUI L'A RENDU MUET PENDANT TROIS JOURS ──────────────────────
 *
 * Réparé le 16 septembre 2026. Ce composant lisait `message ?? name` — donc le
 * message dès qu'il existe, jamais le nom — et comparait à une liste de signes
 * écrite pour Webpack (« Loading chunk 123 failed »). Le projet se construit
 * désormais avec Turbopack, qui lève :
 *
 *     name    ChunkLoadError
 *     message Failed to load chunk … from module …
 *
 * Le message ne contenait aucun signe connu, et le nom n'était jamais lu : le
 * rattrapage ne s'est JAMAIS déclenché. Démontré en rejouant l'erreur exacte
 * sur l'ancien code. C'est la cause des écrans d'erreur des 14, 15 et
 * 16 septembre 2026, et de la baisse des ventes de ces jours-là.
 *
 * La reconnaissance vit maintenant à UN SEUL endroit, `nouvelle-version.ts`,
 * partagé avec les deux barrières d'erreur : trois listes recopiées avaient
 * fini par diverger, et c'est précisément ce qui a laissé passer la panne.
 *
 * ── CE QU'ON ÉCOUTE ───────────────────────────────────────────────────────
 *
 * Les erreurs et les promesses rejetées de la fenêtre — et, EN CAPTURE, les
 * balises `<script>` et `<link>` du site qui reviennent en erreur : un échec de
 * chargement de ressource ne remonte pas jusqu'à la fenêtre, et l'ancienne
 * écoute ne le voyait donc jamais.
 *
 * On n'écoute ICI que la panne de VERSION, jamais les coupures réseau : un
 * compteur de visites qui n'aboutit pas ne doit pas recharger la page en pleine
 * analyse.
 *
 * ── UNE SEULE FOIS PAR DEMI-MINUTE, ET C'EST ESSENTIEL ────────────────────
 *
 * Le garde-fou est partagé avec les barrières d'erreur : si le rechargement ne
 * règle rien, on laisse l'erreur remonter jusqu'au message en français plutôt
 * que de faire clignoter le téléphone indéfiniment.
 */
export default function RecuperationChargement() {
  useEffect(() => {
    const surErreur = (evenement: Event) => {
      // Une balise <script> ou <link> du site revenue en erreur : un morceau
      // renommé par une mise en ligne.
      const cible = evenement.target as (HTMLScriptElement & HTMLLinkElement) | null;
      if (cible && (cible.tagName === 'SCRIPT' || cible.tagName === 'LINK')) {
        if (estFichierDuSite(cible.src || cible.href)) rechargerUneFois();
        return;
      }
      const e = evenement as ErrorEvent;
      if (estErreurDeVersion(e.error) || estErreurDeVersion(e.message)) rechargerUneFois();
    };
    const surRejet = (e: PromiseRejectionEvent) => {
      if (estErreurDeVersion(e.reason)) rechargerUneFois();
    };

    // En capture : sans elle, l'échec d'une balise <script> ne passe pas.
    window.addEventListener('error', surErreur, true);
    window.addEventListener('unhandledrejection', surRejet);
    return () => {
      window.removeEventListener('error', surErreur, true);
      window.removeEventListener('unhandledrejection', surRejet);
    };
  }, []);

  return null;
}
