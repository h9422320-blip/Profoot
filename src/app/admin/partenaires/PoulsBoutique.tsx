"use client";

import { useEffect, useRef, useState } from "react";
import { verifierPoulsBoutique } from "./actions";

/**
 * LE BATTEMENT QUI GARDE LA PAGE VIVANTE.
 *
 * ── CE QUE CE COMPOSANT NE FAIT PAS ───────────────────────────────────────
 *
 * Il ne calcule rien, n'affiche aucun montant, et ne reçoit aucune donnée de
 * vente. Il demande seulement au serveur, à intervalle régulier : « est-ce
 * que quelque chose a bougé depuis le rendu que j'ai sous les yeux ? » Quand
 * la réponse est oui, c'est le serveur lui-même qui refait la page.
 *
 * Tout le reste — les recettes, les frais, la part du partenaire — continue
 * d'être calculé côté serveur et de n'arriver ici que sous forme de page
 * rendue. Aucune donnée d'acheteur ne descend dans le navigateur pour être
 * tenue à jour.
 *
 * ── VINGT SECONDES, ET RIEN QUAND ON NE REGARDE PAS ───────────────────────
 *
 * Assez court pour qu'une vente apparaisse pendant qu'on a la page ouverte,
 * assez long pour ne pas relire la base trois fois par minute. L'onglet caché
 * ne bat pas du tout : une page laissée ouverte toute la nuit interrogerait
 * la base quatre mille fois pour personne. Au retour sur l'onglet, un
 * battement immédiat rattrape ce qui s'est passé pendant l'absence.
 */
const INTERVALLE_MS = 20_000;

export default function PoulsBoutique({ signature }: { signature: string }) {
  // La signature du rendu actuellement à l'écran. Elle change à chaque
  // reconstruction : c'est elle qu'on renvoie au serveur pour comparaison.
  const derniere = useRef(signature);
  const enCours = useRef(false);
  const [verifieA, setVerifieA] = useState<string | null>(null);
  const [panne, setPanne] = useState(false);

  useEffect(() => {
    derniere.current = signature;
  }, [signature]);

  useEffect(() => {
    let monte = true;

    async function battre() {
      // Un battement à la fois : une base lente ne doit pas faire s'empiler
      // les requêtes jusqu'à ce que la page devienne le problème.
      if (!monte || enCours.current) return;
      if (document.visibilityState === "hidden") return;

      enCours.current = true;
      try {
        await verifierPoulsBoutique(derniere.current);
        if (!monte) return;
        setPanne(false);
        setVerifieA(
          new Date().toLocaleTimeString("fr-FR", {
            timeZone: "Africa/Conakry",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch {
        // Une coupure réseau ne doit pas faire disparaître le témoin : elle
        // doit se voir. Un indicateur « en direct » qui ment est pire que pas
        // d'indicateur du tout.
        if (monte) setPanne(true);
      } finally {
        enCours.current = false;
      }
    }

    const minuteur = setInterval(battre, INTERVALLE_MS);
    const auRetour = () => {
      if (document.visibilityState === "visible") void battre();
    };
    document.addEventListener("visibilitychange", auRetour);

    return () => {
      monte = false;
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide ${
        panne
          ? "border-amber-400/30 bg-amber-400/[0.07] text-amber-200/70"
          : "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200/80"
      }`}
      title={
        panne
          ? "Le contrôle automatique n'a pas abouti. Rechargez la page."
          : "La page se refait d'elle-même dès qu'une vente entre chez MakeTou."
      }
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {!panne && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            panne ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
      </span>
      {panne ? (
        <>Contrôle interrompu</>
      ) : (
        <>
          En direct
          {verifieA && (
            <span className="font-normal text-emerald-200/45 tabular-nums">· {verifieA}</span>
          )}
        </>
      )}
    </span>
  );
}
