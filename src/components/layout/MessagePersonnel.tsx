"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/**
 * Un mot adressé à UN abonné, et à lui seul.
 *
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Le 18 août 2026, deux clients ont payé deux mille francs et n'ont rien reçu :
 * la notification de la boutique s'est perdue. L'un d'eux a écrit le lendemain
 * matin pour dire qu'il ne voyait rien, sans obtenir de réponse — parce que
 * personne ne savait encore que ça s'était produit.
 *
 * Réparer l'accès ne suffit pas. Quelqu'un qui a payé et attendu doit
 * APPRENDRE qu'on s'en est aperçu, qu'on s'excuse, et ce qu'on lui offre. Un
 * abonnement qui se prolonge sans explication ne répare rien : le client, lui,
 * garde le souvenir d'avoir payé pour rien.
 *
 * OÙ IL S'AFFICHE, ET POURQUOI LÀ
 *
 * Juste au-dessus du compteur d'analyses — l'endroit exact que regarde
 * quelqu'un qui se demande ce à quoi il a droit.
 *
 * COMMENT ON L'ADRESSE À QUELQU'UN
 *
 * Le texte vit dans les métadonnées du compte, sous `message_personnel`. Aucune
 * migration, aucune table : il suffit de l'écrire sur le compte concerné pour
 * qu'il apparaisse à la connexion suivante. Le lecteur peut le fermer ; il ne
 * revient plus.
 */

interface Message {
  titre?: string;
  texte: string;
  /** Identifiant libre : fermer le message le retient sous cette clé. */
  cle?: string;
}

export default function MessagePersonnel() {
  const [message, setMessage] = useState<Message | null>(null);
  const [ferme, setFerme] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const brut = data?.user?.user_metadata?.message_personnel;
        if (!vivant || !brut || typeof brut !== "object" || !brut.texte) return;

        // Déjà lu et fermé : on ne le remontre pas à chaque page.
        const cle = `profoot_message_lu_${brut.cle ?? "defaut"}`;
        try {
          if (localStorage.getItem(cle) === "1") return;
        } catch {
          /* stockage refusé (navigation privée) : le message s'affichera, tant pis */
        }
        setMessage(brut as Message);
      } catch {
        /* jamais bloquant : un message d'excuse ne doit pas casser la barre latérale */
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  if (!message || ferme) return null;

  const fermer = () => {
    setFerme(true);
    try {
      localStorage.setItem(`profoot_message_lu_${message.cle ?? "defaut"}`, "1");
    } catch {
      /* sans stockage, il réapparaîtra — c'est le moindre mal */
    }
  };

  return (
    <div className="relative rounded-[18px] border border-[#FBBF24]/35 bg-gradient-to-br from-[#FBBF24]/[0.12] to-transparent p-4 pr-9">
      <button
        onClick={fermer}
        aria-label="Fermer ce message"
        className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-2.5">
        <Gift className="w-4 h-4 text-[#FDE047] shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          {message.titre && (
            <p className="text-[12px] font-black text-[#FDE047] leading-tight">{message.titre}</p>
          )}
          <p className="text-[11.5px] text-white/75 leading-relaxed whitespace-pre-line">
            {message.texte}
          </p>
        </div>
      </div>
    </div>
  );
}
