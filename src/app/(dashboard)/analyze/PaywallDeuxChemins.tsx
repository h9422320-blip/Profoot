"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Loader, Lock } from "lucide-react";
import { signalerEtape } from "@/components/etapes-vente";
import { usePaysAcheteur } from "@/components/usePaysAcheteur";

/**
 * La notice est chargée À LA DEMANDE, comme sur la page des tarifs.
 *
 * Elle embarque la table des moyens de paiement des 243 pays — quarante-huit
 * kilo-octets. Ce paywall s'affiche à CHAQUE visiteur gratuit qui ouvre une
 * analyse : l'imposer à tout le monde pour les quelques-uns qui cliquent
 * alourdirait la page la plus visitée du site.
 */
const NoticePaiement = dynamic(() => import("@/components/NoticePaiement"), { ssr: false });

/**
 * Le paywall à deux chemins.
 *
 * POURQUOI DEUX CHEMINS
 *
 * Le plus petit achat possible était un abonnement mensuel. Pour quelqu'un qui
 * vient de découvrir l'application, c'est un engagement — et sept inscrits sur
 * dix lancent une analyse sans jamais payer. Débloquer CE match capte
 * l'impulsion du moment et fait passer le premier paiement, qui est la vraie
 * barrière ; l'abonnement reste affiché juste en dessous comme le meilleur
 * rapport, pour ceux qui reviennent.
 *
 * CONÇU POUR UN TÉLÉPHONE
 *
 * Quasiment tous les visiteurs sont sur mobile. Les deux boutons occupent
 * chacun toute la largeur, l'un sous l'autre — jamais côte à côte, où ils
 * tomberaient sous la largeur du pouce. Chacun fait au moins 52 pixels de
 * haut. Aucun texte ne dépend d'une largeur minimale.
 */
export default function PaywallDeuxChemins({
  equipe1Id,
  equipe2Id,
  equipe1Nom,
  equipe2Nom,
  prixMatch,
  achatUniteDisponible,
  prixAbonnement,
  quotaAbonnement,
}: {
  equipe1Id: string;
  equipe2Id: string;
  equipe1Nom: string;
  equipe2Nom: string;
  prixMatch: number;
  achatUniteDisponible: boolean;
  /** Prix de l'offre d'entrée, tel que réglé dans l'administration. */
  prixAbonnement: number;
  /** Nombre d'analyses de cette offre — `null` si elle est illimitée. */
  quotaAbonnement: number | null;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Vrai quand la notice de paiement est ouverte pour l'achat du match. */
  const [notice, setNotice] = useState(false);
  const paysDetecte = usePaysAcheteur(notice);

  /**
   * ── LE CLIC OUVRE LA NOTICE, IL NE PART PLUS DIRECTEMENT ─────────────────
   *
   * Ce paywall envoyait chez Chariow sans un mot d'explication. Un acheteur à
   * Abidjan y arrivait sans savoir qu'il pouvait payer avec Wave ou Orange
   * Money — alors que la page des tarifs, elle, le lui disait depuis le 22 août.
   *
   * Or c'est ici que passe le plus gros du trafic : 1 381 visites sur la page
   * d'analyse contre 900 sur les tarifs. La moitié des acheteurs n'avaient
   * aucune aide, et aucun d'eux n'était compté.
   */
  const ouvrirNotice = () => {
    signalerEtape('offre-cliquee', 'match-unique');
    setNotice(true);
  };

  const acheterCeMatch = async (paysChoisi: string | null) => {
    setNotice(false);
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch("/api/payments/chariow/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "match",
          equipe1Id,
          equipe2Id,
          equipe1Nom,
          equipe2Nom,
          // Sert à situer l'acheteur quand l'en-tête de géolocalisation manque :
          // sans pays juste, la page de paiement propose les mauvais moyens.
          fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone,
          // Renseigné seulement si l'acheteur a corrigé son pays dans la
          // notice. Absent, le serveur détecte comme avant.
          ...(paysChoisi ? { pays: paysChoisi } : {}),
        }),
      });
      const data = await r.json();

      if (!r.ok) {
        // Le match est déjà payé : inutile de renvoyer vers un paiement, il
        // suffit de recharger pour que le serveur serve l'analyse complète.
        if (data?.code === "DEJA_DEBLOQUE") {
          window.location.reload();
          return;
        }
        // Un échec ici veut dire que personne n'atteindra la caisse : à ne pas
        // confondre avec un abandon volontaire.
        signalerEtape('echec-lien', 'match-unique');
        setErreur(data?.error ?? "Paiement indisponible pour le moment.");
        setEnCours(false);
        return;
      }

      signalerEtape('depart-caisse', 'match-unique');
      window.location.href = data.checkoutUrl;
    } catch {
      signalerEtape('echec-lien', 'match-unique');
      setErreur("Connexion interrompue. Réessayez.");
      setEnCours(false);
    }
  };

  return (
    <div
      className="w-full max-w-[340px] sm:max-w-[420px] mx-auto flex flex-col items-center rounded-[28px] px-5 py-7 sm:px-8 sm:py-9 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
      style={{ background: "rgba(22,36,46,0.94)", backdropFilter: "blur(8px)" }}
    >
      <h3
        className="text-[19px] leading-tight sm:text-2xl md:text-3xl font-black text-white mb-4 text-center"
        style={{ fontFamily: "var(--police-titre), sans-serif" }}
      >
        Tu n&apos;as accès qu&apos;à 15% de notre analyse
      </h3>

      <div className="w-full max-w-[220px] h-1.5 bg-white/10 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#10B981] to-[#2DD4BF] rounded-full"
          style={{ width: "15%" }}
        />
      </div>

      <p className="text-[13px] md:text-[14px] text-white/80 font-medium mb-6 max-w-[300px] leading-relaxed text-center">
        L&apos;analyse complète contient les probabilités exactes, les scénarios restants et les
        insights premium.
      </p>

      {achatUniteDisponible && (
        <>
          {/* LE CHEMIN COURT, MIS EN AVANT.
              C'est lui qui lève la barrière du premier achat : un montant qu'on
              engage sans réfléchir, pour un match précis, tout de suite. */}
          <button
            type="button"
            onClick={ouvrirNotice}
            disabled={enCours}
            className="w-full inline-flex items-center justify-center gap-2 font-black py-4 px-5 rounded-full transition-all text-[14px] sm:text-[15px] text-center shadow-[0_8px_32px_rgba(45,212,191,0.4)] hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-wait min-h-[52px]"
            style={{
              background: "linear-gradient(135deg, #2DD4BF 0%, #10B981 100%)",
              color: "#101c24",
            }}
          >
            {enCours ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Ouverture du paiement…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Débloquer ce match — {prixMatch.toLocaleString("fr-FR")} FCFA
              </>
            )}
          </button>

          <p className="text-[11px] text-white/45 mt-2.5 text-center leading-relaxed">
            Paiement unique par mobile money. Ce match reste débloqué pour toujours.
          </p>

          {erreur && (
            <p className="text-[12px] text-rose-400 mt-3 text-center leading-relaxed" role="alert">
              {erreur}
            </p>
          )}

          <div className="flex items-center gap-3 w-full my-5">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">ou</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </>
      )}

      {/* LE CHEMIN LONG. Second visuellement, mais présenté comme le meilleur
          rapport : c'est vrai, et c'est là que se trouve la valeur réelle. */}
      <Link
        href="/pricing"
        // Ce bouton n'ouvre aucune notice et ne mène à aucune caisse : il
        // envoie lire les prix. Il avait sa propre étiquette mais partageait
        // l'étape « offre-cliquee », et pesait à lui seul les deux tiers du
        // haut de l'entonnoir — d'où une fuite apparente de 49 % qui n'était
        // que le trajet normal vers la page des tarifs.
        onClick={() => signalerEtape('vers-tarifs')}
        className={`w-full inline-flex items-center justify-center gap-2 font-black py-4 px-5 rounded-full transition-all text-[13px] sm:text-sm text-center active:scale-95 min-h-[52px] ${
          achatUniteDisponible
            ? "bg-white/[0.07] border border-white/15 text-white hover:bg-white/[0.12]"
            : "shadow-[0_8px_32px_rgba(45,212,191,0.4)] hover:scale-[1.02]"
        }`}
        style={
          achatUniteDisponible
            ? undefined
            : { background: "linear-gradient(135deg, #2DD4BF 0%, #10B981 100%)", color: "#101c24" }
        }
      >
        {achatUniteDisponible
          ? `S'abonner — dès ${prixAbonnement.toLocaleString("fr-FR")} FCFA / mois`
          : "🔒 Débloquer l'analyse complète"}
      </Link>

      {achatUniteDisponible && (
        <p className="text-[11px] text-[#10B981] font-bold mt-2.5 text-center">
          Meilleure valeur :{" "}
          {quotaAbonnement === null
            ? "analyses illimitées"
            : `${quotaAbonnement} analyses complètes par mois`}
        </p>
      )}

      {/* ── LA MÊME NOTICE QUE SUR LA PAGE DES TARIFS ─────────────────────
          Elle n'existe QUE pendant le clic : hors de ce moment, elle n'est pas
          montée, et les quarante-huit kilo-octets de la table des moyens de
          paiement ne partent pas dans le téléphone des visiteurs qui ne
          cliquent pas — c'est-à-dire la quasi-totalité. */}
      {notice && (
        <NoticePaiement
          paysDetecte={paysDetecte}
          libelleOffre={`Analyse complète — ${equipe1Nom} contre ${equipe2Nom} · ${prixMatch.toLocaleString(
            "fr-FR"
          )} FCFA`}
          // Sans cette clé, les sorties de la notice tombaient dans un panier
          // sans nom, séparé des clics qui les avaient provoquées.
          cleOffre="match-unique"
          // Le montant sert au rappel du solde : 267 paiements ont echoue sur
          // 1 974 arrivees en caisse, et un solde insuffisant en est le motif
          // le plus banal.
          montantXof={prixMatch}
          onContinuer={(paysRetenu) => acheterCeMatch(paysRetenu)}
          onFermer={() => setNotice(false)}
        />
      )}
    </div>
  );
}
