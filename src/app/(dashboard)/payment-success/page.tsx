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
    const nettoyages: (() => void)[] = [];

    const params = new URLSearchParams(window.location.search);
    // Un achat à l'unité ne rend pas « premium » : c'est le déblocage de CE
    // match qu'il faut attendre. Sans cette distinction, la page tournerait
    // indéfiniment sur un acces qui ne viendra jamais.
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

    // ── L'ATTENTE N'EST PLUS LA MÊME DEPUIS MAKETOU ─────────────────────────
    //
    // Chariow renvoyait l'acheteur ici DÈS que le paiement était accepté : la
    // page s'ouvrait à la fin du paiement, et trente secondes suffisaient.
    //
    // MakeTou n'a aucun réglage de redirection — vérifié dans l'éditeur du
    // produit le 28 août 2026. La boutique s'ouvre donc dans un second onglet
    // et cette page attend AVANT le paiement, pas après. Trente secondes se
    // seraient écoulées pendant que l'acheteur compose encore son code Orange
    // Money, et il serait revenu sur une page ayant renoncé.
    const viaMaketou = params.get('via') === 'maketou';
    const maxTentatives = viaMaketou ? 450 : 15; // 15 minutes, ou 30 secondes.

    let abouti = false;
    const reussir = () => {
      if (abouti || cancelled) return;
      abouti = true;
      setState('active');
      setTimeout(() => window.location.replace(destination), cleMatch ? 0 : 1200);
    };

    // ── LE RETOUR SUR L'ONGLET EST LE VRAI SIGNAL ───────────────────────────
    //
    // Pendant que l'acheteur paie sur la boutique, cet onglet-ci est en
    // arrière-plan, et les navigateurs y ralentissent les minuteries jusqu'à
    // une fois par minute. Sans cette écoute, quelqu'un qui revient aurait pu
    // attendre encore une minute devant « Activation en cours » alors que son
    // accès était déjà ouvert.
    const auRetour = async () => {
      if (document.visibilityState !== 'visible' || abouti || cancelled) return;
      try {
        if (await checkStatus()) reussir();
      } catch {
        /* Un aller-retour raté ne doit pas interrompre l'attente. */
      }
    };
    document.addEventListener('visibilitychange', auRetour);
    nettoyages.push(() => document.removeEventListener('visibilitychange', auRetour));

    (async () => {
      try {
        // ── LA RÉCONCILIATION SE REFAIT PENDANT TOUTE L'ATTENTE ──────────────
        //
        // Elle n'était tentée QU'UNE FOIS, à la seconde où la page s'ouvrait.
        // Or le mobile money confirme avec du retard : à cet instant précis, la
        // boutique répond encore « en attente de paiement », la réconciliation
        // ne trouve rien, et les trente secondes suivantes n'interrogent plus
        // que NOTRE base — qui ne changera jamais si la notification se perd.
        //
        // C'est exactement ce qui est arrivé le 18 août 2026 à deux clients :
        // payé, page quittée, notification perdue, aucun accès. L'un d'eux a
        // écrit le lendemain matin pour se plaindre.
        //
        // On la retente donc toutes les quatre tentatives, soit environ toutes
        // les huit secondes : dès que la boutique marque la vente encaissée, le
        // passage suivant l'attrape.
        //
        // Elle n'a de sens que pour l'ancienne boutique : elle interroge
        // Chariow. Une vente MakeTou est ouverte par son pulse, et l'appeler
        // ici ne ferait qu'ajouter des requêtes inutiles pendant un quart
        // d'heure.
        const reconcilier = () =>
          viaMaketou
            ? Promise.resolve()
            : fetch('/api/payments/chariow/verify', { method: 'POST' }).catch(() => {});

        await reconcilier();

        // Vérifie les droits. La fenêtre est large — trente secondes — parce
        // que le mobile money confirme parfois avec plusieurs secondes de
        // retard : abandonner trop tôt renverrait l'acheteur sur un contenu
        // encore verrouillé, ce qui est exactement ce qu'il vient de payer
        // pour éviter.
        for (let attempt = 0; attempt < maxTentatives && !cancelled; attempt++) {
          if (attempt > 0 && attempt % 4 === 0) await reconcilier();
          if (abouti) return;
          if (await checkStatus()) {
            // Retour immédiat sur l'analyse payée. `replace` et non `push` :
            // le bouton « précédent » ne doit pas ramener sur une page de
            // paiement déjà consommée.
            //
            // L'abonné aussi part sur l'analyse, et plus seulement l'acheteur
            // d'un match. Il venait de payer et se retrouvait devant un bouton
            // à cliquer : un pas de plus, juste après celui qu'il avait déjà
            // fallu franchir pour payer.
            reussir();
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (!cancelled && !abouti) setState('pending');
      } catch {
        if (!cancelled && !abouti) setState('pending');
      }
    })();

    return () => {
      cancelled = true;
      nettoyages.forEach((f) => f());
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
                {achatMatch ? 'Paiement confirmé' : 'En attente de votre paiement…'}
              </h1>
              {/* ── CETTE PAGE S'OUVRE AVANT LE PAIEMENT, PAS APRÈS ──────────
                  La boutique s'affiche dans l'autre onglet ; celui-ci attend.
                  Écrire « nous confirmons votre paiement » ferait croire à
                  quelqu'un qui n'a pas encore payé que c'est fait, et il
                  fermerait tout. */}
              <p className="text-foreground/50 leading-relaxed">
                {achatMatch
                  ? 'Déblocage de votre analyse en cours. Vous y serez ramené automatiquement dans un instant.'
                  : 'Terminez votre paiement dans l’onglet de la boutique. Dès qu’il est validé, votre accès s’ouvre ici tout seul et votre analyse démarre — laissez cette page ouverte.'}
              </p>
            </>
          )}
          {state === 'active' && (
            <>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Paiement réussi !</h1>
              <p className="text-foreground/50 leading-relaxed">
                {achatMatch
                  ? 'Votre analyse complète est débloquée. Ouverture…'
                  : "Félicitations, votre accès ProFoot AI est maintenant actif. Bienvenue dans l'élite !"}
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
                  : 'Si vous avez payé, votre accès s’ouvrira automatiquement d’ici quelques minutes — vous pouvez déjà naviguer dans l’application. Pensez à avoir payé avec l’adresse e-mail de votre compte : c’est elle qui relie votre paiement à votre accès. Un souci ? Écrivez à contactprofootai@gmail.com.'}
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
