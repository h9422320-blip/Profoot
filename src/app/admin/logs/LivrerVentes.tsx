"use client";

import { useState, useTransition } from "react";
import { PackageCheck, Loader2 } from "lucide-react";
import { livrerVentesSansCompteMaintenant } from "../users/actions";

/**
 * LE BOUTON QUI LIVRE CEUX QUI ONT PAYÉ SANS COMPTE.
 *
 * ── POURQUOI IL EXISTE ALORS QUE L'ENTRETIEN LE FAIT DÉJÀ ─────────────────
 *
 * L'entretien quotidien ne repasse qu'une fois par vingt heures. Quelqu'un qui
 * paie à 18 h 46 et n'a pas de compte attendrait donc jusqu'au lendemain matin
 * — et c'est exactement ce qui s'est produit le 29 août 2026, deux fois.
 *
 * Une alerte arrive dans la boîte de l'administrateur à la seconde où la vente
 * tombe. Elle dit « il faut agir maintenant ». Il fallait donc un endroit où
 * agir maintenant, sans attendre une horloge.
 *
 * ── CE QUE LE BOUTON DÉCLENCHE ────────────────────────────────────────────
 *
 * Pour chaque vente encaissée restée sans compte : le compte est créé, l'accès
 * crédité, et un lien pour choisir son mot de passe est envoyé. Rien n'est
 * fait deux fois — chaque vente livrée laisse sa trace.
 */
export default function LivrerVentes() {
  const [retour, setRetour] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div className="rounded-[16px] border border-[#10B981]/25 bg-[#10B981]/[0.05] p-4">
      <p className="text-[12px] font-black uppercase tracking-wider text-[#34D399]">
        Ventes payées sans compte
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50">
        Crée le compte de chaque acheteur resté sans accès, crédite son abonnement,
        et lui envoie un lien pour choisir son mot de passe. Sans attendre
        l&apos;entretien de la nuit.
      </p>

      {retour && (
        <p className="mt-3 whitespace-pre-line text-[12.5px] font-semibold text-white/75">
          {retour}
        </p>
      )}

      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setRetour(null);
            setRetour(await livrerVentesSansCompteMaintenant());
          })
        }
        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-[#10B981] px-4 py-2.5 text-[13px] font-black text-[#04140d] transition-opacity disabled:opacity-50"
      >
        {enCours ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Livraison en cours…
          </>
        ) : (
          <>
            <PackageCheck className="w-4 h-4" /> Livrer maintenant
          </>
        )}
      </button>
    </div>
  );
}
