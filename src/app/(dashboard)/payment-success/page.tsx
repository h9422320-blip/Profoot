"use client";

import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Page de retour après paiement Chariow.
 * L'activation réelle est faite par le webhook côté serveur ; cette page
 * déclenche en plus une réconciliation (filet de sécurité si le webhook
 * n'est pas encore arrivé) puis vérifie les droits réels.
 */
export default function PaymentSuccessPage() {
  const [state, setState] = useState<'checking' | 'active' | 'pending'>('checking');

  useEffect(() => {
    let cancelled = false;

    const checkStatus = async (): Promise<boolean> => {
      const res = await fetch('/api/payments/status');
      const data = await res.json();
      return !!data.premium;
    };

    (async () => {
      try {
        // 1. Réconciliation : rattache les ventes Chariow non encore traitées.
        await fetch('/api/payments/chariow/verify', { method: 'POST' }).catch(() => {});

        // 2. Vérifie les droits, avec quelques tentatives le temps que le
        //    webhook arrive (10 s max).
        for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
          if (await checkStatus()) {
            if (!cancelled) setState('active');
            return;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        if (!cancelled) setState('pending');
      } catch {
        if (!cancelled) setState('pending');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="bg-card border border-border-card rounded-3xl p-10 max-w-md w-full text-center space-y-6">
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
              <h1 className="text-3xl font-black text-foreground">Activation en cours…</h1>
              <p className="text-foreground/50">
                Nous confirmons votre paiement auprès de Chariow. Cela ne prend que quelques secondes.
              </p>
            </>
          )}
          {state === 'active' && (
            <>
              <h1 className="text-3xl font-black text-foreground">Paiement Réussi !</h1>
              <p className="text-foreground/50">
                Félicitations, votre abonnement ProFoot AI est maintenant actif. Bienvenue dans l'élite !
              </p>
            </>
          )}
          {state === 'pending' && (
            <>
              <h1 className="text-3xl font-black text-foreground">Paiement en cours de confirmation</h1>
              <p className="text-foreground/50">
                Votre paiement est en cours de traitement. Votre abonnement sera activé automatiquement
                d'ici quelques minutes — vous pouvez déjà naviguer dans l'application.
              </p>
            </>
          )}
        </div>

        <Link
          href="/analyze"
          className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-colors"
        >
          Commencer l'analyse <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
