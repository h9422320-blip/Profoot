"use client";

import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Page de retour après paiement Chariow.
 *
 * L'activation réelle est faite par le webhook côté serveur ; cette page
 * déclenche en plus une réconciliation (filet de sécurité si le webhook n'est
 * pas encore arrivé) puis vérifie les droits réels.
 *
 * POUR UN MATCH ACHETÉ À L'UNITÉ, ELLE NE S'ARRÊTE PAS LÀ.
 *
 * L'acheteur d'un match repartait sur une page d'analyse VIERGE : l'analyse
 * qu'il venait de payer vivait dans l'état React de son navigateur, perdu au
 * moment de partir vers la page de paiement. Il avait payé et ne voyait rien —
 * il devait deviner qu'il fallait resélectionner les deux équipes et relancer.
 *
 * Dès que le déblocage est confirmé, on le renvoie donc AUTOMATIQUEMENT sur
 * l'analyse exacte qu'il a payée, qui se relance seule et s'affiche complète.
 */
export default function PaymentSuccessPage() {
  const [state, setState] = useState<'checking' | 'active' | 'pending'>('checking');
  const [achatMatch, setAchatMatch] = useState(false);
  const [lienAnalyse, setLienAnalyse] = useState('/analyze');

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams(window.location.search);
    // Un achat à l'unité ne rend pas « premium » : c'est le déblocage de CE
    // match qu'il faut attendre. Sans cette distinction, la page tournerait
    // indéfiniment sur un abonnement qui ne viendra jamais.
    const cleMatch = params.get('match');
    const t1 = params.get('t1');
    const t2 = params.get('t2');

    // Les équipes permettent de relancer l'analyse payée. Si elles manquent
    // (lien tronqué, retour manuel), on retombe sur la page d'analyse nue
    // plutôt que de bloquer l'acheteur.
    const destination = t1 && t2
      ? `/analyze?t1=${encodeURIComponent(t1)}&t2=${encodeURIComponent(t2)}`
      : '/analyze';

    setAchatMatch(!!cleMatch);
    setLienAnalyse(destination);

    const checkStatus = async (): Promise<boolean> => {
      const url = cleMatch
        ? `/api/payments/status?match=${encodeURIComponent(cleMatch)}`
        : '/api/payments/status';
      const res = await fetch(url);
      const data = await res.json();
      return cleMatch ? !!data.matchDebloque : !!data.premium;
    };

    (async () => {
      try {
        // 1. Réconciliation : rattache les ventes Chariow non encore traitées.
        await fetch('/api/payments/chariow/verify', { method: 'POST' }).catch(() => {});

        // 2. Vérifie les droits. La fenêtre est large — trente secondes — parce
        //    que le mobile money confirme parfois avec plusieurs secondes de
        //    retard : abandonner trop tôt renverrait l'acheteur sur un contenu
        //    encore verrouillé, ce qui est exactement ce qu'il vient de payer
        //    pour éviter.
        for (let attempt = 0; attempt < 15 && !cancelled; attempt++) {
          if (await checkStatus()) {
            if (cancelled) return;
            setState('active');
            // Retour immédiat sur l'analyse payée. `replace` et non `push` :
            // le bouton « précédent » ne doit pas ramener sur une page de
            // paiement déjà consommée.
            if (cleMatch) window.location.replace(destination);
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (!cancelled) setState('pending');
      } catch {
        if (!cancelled) setState('pending');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="bg-card border border-border-card rounded-[28px] p-6 sm:p-10 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          {state === 'checking' ? (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          ) : (
            <CheckCircle className="w-10 h-10 text-success" />
          )}
        </div>

        <div className="space-y-2">
          {state === 'checking' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                {achatMatch ? 'Paiement confirmé' : 'Activation en cours…'}
              </h1>
              <p className="text-foreground/50 leading-relaxed">
                {achatMatch
                  ? 'Déblocage de votre analyse en cours. Vous y serez ramené automatiquement dans un instant.'
                  : 'Nous confirmons votre paiement auprès de Chariow. Cela ne prend que quelques secondes.'}
              </p>
            </>
          )}
          {state === 'active' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Paiement réussi !</h1>
              <p className="text-foreground/50 leading-relaxed">
                {achatMatch
                  ? 'Votre analyse complète est débloquée. Ouverture…'
                  : "Félicitations, votre abonnement ProFoot AI est maintenant actif. Bienvenue dans l'élite !"}
              </p>
            </>
          )}
          {state === 'pending' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                Paiement en cours de confirmation
              </h1>
              <p className="text-foreground/50 leading-relaxed">
                {achatMatch
                  ? "Votre paiement est bien enregistré. Le déblocage arrive d'ici quelques instants — ouvrez votre analyse, elle s'affichera complète dès que c'est prêt."
                  : 'Votre paiement est en cours de traitement. Votre abonnement sera activé automatiquement d’ici quelques minutes — vous pouvez déjà naviguer dans l’application.'}
              </p>
            </>
          )}
        </div>

        <Link
          href={lienAnalyse}
          className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-[16px] font-bold hover:bg-primary-hover transition-colors min-h-[52px]"
        >
          {achatMatch ? 'Voir mon analyse' : "Commencer l'analyse"} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
