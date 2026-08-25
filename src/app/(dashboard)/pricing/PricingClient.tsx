"use client";

import { Check, Zap, Brain, TrendingUp, Shield, Star, Loader2, Crown, X, Flame, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fuseauDuNavigateur } from "@/lib/pays-acheteur";
import { sessionProbable } from "@/lib/session-legere";
import dynamic from "next/dynamic";
import { usePaysAcheteur } from "@/components/usePaysAcheteur";
import { signalerEtape } from "@/components/etapes-vente";

/**
 * La notice est chargee A LA DEMANDE, et c est deliberé.
 *
 * Elle embarque la table des moyens de paiement des 243 pays -- quarante-huit
 * kilo-octets. Un import classique l aurait mise dans le lot de la page des
 * tarifs, donc dans le telephone de CHAQUE visiteur, y compris l immense
 * majorite qui ne clique sur aucune offre.
 *
 * Ici, rien n est telecharge tant que personne n a choisi une offre.
 */
const NoticePaiement = dynamic(() => import("@/components/NoticePaiement"), { ssr: false });

type PlanTier = 'FREE' | 'ESSENTIAL' | 'PRO' | 'VIP';
type PlanKey = 'essential_monthly' | 'pro_monthly' | 'vip_yearly';

/**
 * Présentation des trois offres.
 *
 * Seules l'apparence et la mise en page vivent ici : les prix, les libellés
 * et le contenu de chaque offre sont ceux qui étaient déjà affichés, repris
 * mot pour mot. La logique d'achat et les droits d'accès restent inchangés et
 * continuent d'être décidés par le serveur.
 */
/**
 * Ce que le serveur transmet : uniquement les valeurs modifiables depuis
 * l'administration. Le reste — noms, couleurs, argumentaire — reste ici, car
 * il ne change pas d'un test tarifaire a l'autre.
 */
/** Marqueur remplace a l'affichage par le quota reel de l'offre. */
const QUOTA = '__QUOTA__';

export type OffresAffichees = Record<
  string,
  { prix: string; prixBrut: number; analyses: number | null; agentVip: boolean }
>;

const OFFRES = [
  {
    cle: 'essential_monthly' as PlanKey,
    tier: 'ESSENTIAL' as PlanTier,
    nom: 'Essentiel',
    prix: '2.000',
    periode: 'FCFA / mois',
    accroche: "Pour analyser à ton rythme",
    icone: Zap,
    cta: "Choisir l'Essentiel",
    // ── LE BADGE A CHANGE DE CARTE LE 24 AOUT 2026 ────────────────────────
    //
    // Il vivait sur le Pro, ou il etait FAUX : 199 des 241 acheteurs ont pris
    // l Essentiel. Mesure sur 1 974 arrivees en caisse, l Essentiel convertit
    // a 16,3 %, le Pro a 7,7 %, l Annuel a 6,2 %. La carte mise en avant etait
    // celle qui fait le plus renoncer, et elle l affirmait la plus choisie.
    badge: { texte: 'Le plus choisi', style: 'bg-sky-400 text-[#06231a]' },
    vedette: true,
    avantages: [
      QUOTA,
      'Analyses Premium',
      'Historique des analyses',
      'Fonctionnalités Premium standards',
    ],
    exclus: [],
    // Classes écrites en toutes lettres : Tailwind ne génère que les noms
    // qu'il trouve littéralement dans le code, une classe construite à la
    // volée ne produirait aucun style.
    style: {
      bordure: 'border-sky-400/30 hover:border-sky-400/60',
      // Le cadre dégradé de la carte. Celui de la vedette est le plus vif et
      // le plus épais — c'est lui qui doit accrocher l'œil en premier.
      cadre: 'from-sky-400 via-cyan-300 to-emerald-400',
      halo: 'from-sky-400/40 to-cyan-400/40',
      pastille: 'bg-sky-400/10 text-sky-400 border-sky-400/30',
      coche: 'bg-primary/15 text-primary',
      bouton: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400 text-[#04262b] shadow-lg shadow-emerald-400/30 hover:brightness-110',
      accentTexte: 'text-sky-400',
    },
  },
  {
    cle: 'pro_monthly' as PlanKey,
    tier: 'PRO' as PlanTier,
    nom: 'Pro',
    prix: '5.000',
    periode: 'FCFA / mois',
    accroche: 'Pour les vrais passionnés',
    icone: Flame,
    cta: 'Choisir le Pro',
    avantages: [
      QUOTA,
      'Analyses Premium',
      'Historique complet des analyses',
      'Fonctionnalités Premium standards',
      'Mises à jour Premium',
    ],
    exclus: [],
    style: {
      bordure: 'border-primary',
      cadre: 'from-emerald-400/55 via-teal-300/35 to-emerald-500/55',
      halo: 'from-primary to-info',
      pastille: 'bg-primary/15 text-primary border-primary/40',
      coche: 'bg-primary/20 text-primary',
      bouton: 'border-2 border-transparent [background:linear-gradient(#1d2f3a,#1d2f3a)_padding-box,linear-gradient(90deg,#34d399,#5eead4,#34d399)_border-box] text-primary hover:brightness-125',
      accentTexte: 'text-primary',
    },
  },
  {
    cle: 'vip_yearly' as PlanKey,
    tier: 'VIP' as PlanTier,
    nom: 'VIP Annuel',
    prix: '15.000',
    periode: 'FCFA / an',
    mention: 'Paiement annuel',
    // L'économie est CALCULÉE à l'affichage, à partir des prix réellement
    // pratiqués — voir `economieAnnuelle` plus bas. Écrite en dur, elle
    // deviendrait fausse au premier changement de tarif, et une économie
    // annoncée qui ne se vérifie pas est un mensonge.
    accroche: "L'accès complet, sans limite",
    icone: Crown,
    cta: 'Devenir VIP',
    badge: { texte: 'Tout illimité', style: 'bg-warning text-black' },
    avantages: [
      QUOTA,
      'Toutes les fonctionnalités Premium',
      'Agent IA VIP',
      'Fonctionnalités Premium exclusives',
      'Priorité sur les nouvelles fonctionnalités',
      'Futures améliorations Premium',
    ],
    exclus: [],
    // L'Agent IA VIP est ce qui distingue réellement cette offre : il est
    // signalé pour que la différence saute aux yeux.
    avantagePhare: 'Agent IA VIP',
    style: {
      bordure: 'border-warning/40 hover:border-warning/70',
      cadre: 'from-amber-300/65 via-yellow-200/40 to-amber-500/65',
      halo: 'from-warning/40 to-amber-500/40',
      pastille: 'bg-warning/10 text-warning border-warning/30',
      coche: 'bg-primary/15 text-primary',
      bouton: 'bg-warning hover:bg-warning/90 text-black shadow-lg shadow-warning/25',
      accentTexte: 'text-warning',
    },
  },
];

/**
 * Économie réelle de l'offre annuelle face à douze mois de Pro.
 *
 * Calculée, jamais écrite : au premier changement de tarif, une phrase figée
 * deviendrait fausse — et une économie annoncée qui ne se vérifie pas fait plus
 * de dégâts qu'une absence d'argument. Renvoie `null` quand il n'y a rien à
 * annoncer, ce qui masque la ligne au lieu d'afficher une économie négative.
 */
function economieAnnuelle(cle: PlanKey, offres: OffresAffichees): string | null {
  if (cle !== 'vip_yearly') return null;
  const annuel = offres.vip_yearly?.prixBrut;
  const mensuel = offres.pro_monthly?.prixBrut;
  if (!annuel || !mensuel) return null;

  const surUnAn = mensuel * 12;
  const economie = surUnAn - annuel;
  if (economie <= 0) return null;

  const moisOfferts = Math.round(economie / mensuel);
  return (
    `Économisez ${economie.toLocaleString('fr-FR')} FCFA par an` +
    (moisOfferts >= 1 ? `, soit ${moisOfferts} mois offerts` : '')
  );
}

export default function PricingClient({ offres }: { offres: OffresAffichees }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanTier>('FREE');
  const [checkingStatus, setCheckingStatus] = useState(true);
  /** Offre pour laquelle la notice de paiement est ouverte. Null = fermée. */
  const [noticePour, setNoticePour] = useState<PlanKey | null>(null);
  const paysDetecte = usePaysAcheteur(noticePour !== null);

  // Le niveau affiché vient du serveur : le frontend ne décide jamais des
  // droits, il se contente de refléter ce que le backend applique réellement.
  //
  // La page des tarifs est PUBLIQUE, et c'est même l'une des plus visitées :
  // beaucoup de gens y arrivent avant d'avoir un compte. Pour eux, le serveur
  // répondait 401 — une réponse qui ne pouvait rien changer à l'affichage,
  // puisque l'offre par défaut est déjà « FREE ». On ne l'interroge donc que
  // lorsqu'il y a réellement quelqu'un à reconnaître.
  useEffect(() => {
    // ── ON NE CHARGE PLUS SUPABASE POUR SAVOIR S'IL Y A QUELQU'UN ─────────
    //
    // `getSession()` imposait le client Supabase entier — 226 Ko — sur la page
    // des tarifs, alors qu'il ne servait qu'à éviter d'interroger le serveur
    // pour un visiteur non connecté. La présence du cookie répond aussi bien.
    //
    // Ce que le serveur dit ensuite reste la seule vérité sur l'offre en cours :
    // ce raccourci décide seulement s'il vaut la peine de lui poser la question.
    if (!sessionProbable()) {
      setCheckingStatus(false);
      return;
    }
    fetch('/api/payments/status')
      .then(res => res.json())
      .then(data => {
        if (data.plan) setPlan(data.plan as PlanTier);
      })
      .catch(err => console.error(err))
      .finally(() => setCheckingStatus(false));
  }, []);

  /**
   * ── LE CLIC OUVRE LA NOTICE, IL NE PART PLUS DIRECTEMENT ─────────────────
   *
   * La page de paiement appartient à Chariow : on ne peut rien y écrire. Un
   * acheteur y arrivait donc sans savoir s'il pourrait payer avec Wave ou
   * Orange Money, et beaucoup renonçaient là.
   *
   * La notice s'affiche à la seconde du clic, et repart d'elle-même au bout de
   * cinq secondes : personne n'est retenu, et celui qui hésite a le temps de
   * lire. Le paiement lui-même n'a pas changé d'une ligne — c'est
   * `lancerPaiement` ci-dessous, exactement l'ancien code.
   */
  const handleSubscribe = (selectedPlan: PlanKey) => {
    // Le dénominateur du tunnel, avec le nom de l'offre : sans lui, on ignore
    // combien de personnes ont vraiment voulu payer, et laquelle des trois
    // offres retient l'attention.
    signalerEtape('offre-cliquee', selectedPlan);
    setNoticePour(selectedPlan);
  };

  const lancerPaiement = async (selectedPlan: PlanKey, paysChoisi: string | null) => {
    setNoticePour(null);
    try {
      setLoadingPlan(selectedPlan);
      const res = await fetch('/api/payments/chariow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Le fuseau ne sert qu'en secours, si l'hébergeur ne transmet pas le
        // pays de l'acheteur : sans lui, le paiement retomberait sur un pays
        // par défaut et les moyens de paiement locaux disparaîtraient.
        //
        // `pays` n'est renseigné que si l'acheteur a corrigé le sien dans la
        // notice. Absent, le serveur détecte comme avant.
        body: JSON.stringify({
          plan: selectedPlan,
          fuseau: fuseauDuNavigateur(),
          ...(paysChoisi ? { pays: paysChoisi } : {}),
        })
      });

      // Session expirée : reconnexion plutôt qu'un message d'erreur trompeur.
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      const data = await res.json();

      if (data.checkoutUrl) {
        // ── LE DERNIER POINT DE MESURE AVANT DE QUITTER LE SITE ────────────
        //
        // C'est ici que se referme le trou du 23 août : on savait combien de
        // gens voyaient les tarifs, et combien arrivaient en caisse chez
        // Chariow, sans rien de ce qui se passait entre les deux.
        signalerEtape('depart-caisse', selectedPlan);
        window.location.href = data.checkoutUrl;
      } else {
        // Une erreur ici veut dire que personne n'atteindra jamais la caisse :
        // ces cas-là ne doivent pas se confondre avec un abandon volontaire.
        signalerEtape('echec-lien', selectedPlan);
        alert(data.error || "Une erreur est survenue lors de l'initialisation du paiement.");
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion au serveur de paiement.");
      setLoadingPlan(null);
    }
  };

  // Hiérarchie des offres : on ne propose pas d'acheter une offre déjà couverte
  // par l'abonnement en cours.
  const RANK: Record<PlanTier, number> = { FREE: 0, ESSENTIAL: 1, PRO: 2, VIP: 3 };
  const couvertPar = (tier: PlanTier) => RANK[plan] >= RANK[tier];

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 pb-20">
      {/* ── L'EN-TÊTE COÛTAIT UN DEMI-ÉCRAN ────────────────────────────────
          Mesuré sur un téléphone de 375 × 812 : 401 pixels de titre et
          d'accroche AVANT le premier prix. Sur les 474 personnes qui arrivent
          ici, 307 repartent sans choisir — et beaucoup n'ont vu aucun tarif.
          Le badge « Expérience Elite » ne disait rien de l'offre ; le titre
          occupait deux lignes en `text-4xl` ; l'accroche en faisait trois.
          Tout cela est ramené à l'essentiel : ce qu'on vend, et comment on
          paie — la mention des moyens de paiement rassure et reste. */}
      <div className="text-center space-y-1.5 pt-1">
        <h1 className="text-2xl md:text-4xl font-black text-foreground tracking-tight">
          Choisissez votre <span className="text-primary italic">offre</span>
        </h1>
        <p className="text-[13px] md:text-sm text-foreground/45 max-w-lg mx-auto leading-snug">
          Orange Money, MTN, Wave ou carte bancaire. Sans engagement.
        </p>
      </div>

      {/* ── LA HAUTEUR NE SE TRAITE PAS PAREIL SELON L'ÉCRAN ───────────────
          Sur téléphone, les cartes s'empilent : on n'en voit jamais deux
          entières à la fois, et les étirer à la même hauteur n'aiderait
          personne à comparer — cela ne ferait qu'allonger la page, qui est
          justement le défaut qu'on corrige. Chaque carte y fait donc sa
          hauteur naturelle.
          Sur ordinateur, elles sont côte à côte : là, une hauteur commune
          aligne les boutons et rend la comparaison immédiate. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start md:items-stretch">
        {OFFRES.map((offre, i) => {
          const reglee = offres[offre.cle];
          const Icone = offre.icone;
          const couvert = couvertPar(offre.tier);
          const enCours = loadingPlan === offre.cle;

          // ── PLUS D'ENTRÉE ANIMÉE SUR TÉLÉPHONE ────────────────────────────
          //
          // Les cartes arrivaient l'une après l'autre, décalées de 100 ms. Sur
          // une 4G lente, cela retarde l'affichage du prix de trois dixièmes de
          // seconde sur la carte la plus importante — pour un effet que
          // personne ne remarque. Le `div` remplace `motion.div`.
          // Ce qui reste : la pression au doigt, et la bordure au survol.
          return (
            <div
              key={offre.cle}
              className={`relative group md:h-full ${offre.vedette ? 'md:-mt-3 md:mb-3' : ''}`}
            >
              {/* ── LE HALO ────────────────────────────────────────────────
                  Il vit DERRIÈRE la carte et flou : il ne peut donc jamais
                  passer devant un prix ou un avantage. Porté de 30 à 45 % sur
                  la vedette, avec un rayon plus large — assez pour qu'on la
                  repère du coin de l'œil, pas assez pour éclaircir le fond de
                  la carte, qui reste opaque au-dessus. */}
              <div
                className={`absolute -inset-[3px] bg-gradient-to-br ${offre.style.halo} rounded-[27px] blur-lg transition-opacity duration-500 ${
                  offre.vedette ? 'opacity-45 group-hover:opacity-70' : 'opacity-[0.18] group-hover:opacity-40'
                }`}
              />

              {/* ── LA BORDURE DÉGRADÉE DE LA VEDETTE ──────────────────────
                  Un dégradé cyan → vert ne peut pas s'écrire dans `border`.
                  On enveloppe donc la carte dans un cadre d'un pixel et demi
                  rempli du dégradé : ce qui dépasse forme la bordure. Aucune
                  image, aucun pseudo-élément, aucun masque — juste un fond.
                  Les deux autres cartes n'ont pas d'enveloppe et gardent leur
                  bordure d'origine. */}
              <div
                className={`relative md:h-full rounded-[25.5px] bg-gradient-to-br ${offre.style.cadre} ${
                  offre.vedette ? 'p-[1.5px] shadow-xl shadow-emerald-500/15' : 'p-[1px]'
                }`}
              >
              {/* ── LE FOND DE LA CARTE DOIT ÊTRE OPAQUE ────────────────────
                  Première version : `bg-card/70`. Le cadre dégradé vif situé
                  DERRIÈRE transparaissait alors à travers les trente pour cent
                  manquants, et lavait toute la carte de l'Essentiel en vert
                  d'eau — au lieu de rester une bordure d'un pixel et demi.
                  Le dégradé ne doit se voir QUE sur le liseré. Même à 95 %, les
                  cinq pour cent restants teintaient encore la surface : le
                  fond est donc OPAQUE. L'effet verre vient désormais du
                  reflet en haut de carte et du liseré, pas de la
                  transparence — et il est plus net ainsi. */}
              <div
                className="relative md:h-full bg-card rounded-[24px] px-5 py-5 flex flex-col gap-4 transition-colors duration-200"
              >
                {/* ── LE REFLET QUI FAIT LE VERRE ──────────────────────────
                    Un dégradé blanc à 6 % sur les quarante premiers pixels.
                    C'est ce détail, et pas le flou seul, qui donne l'illusion
                    d'une surface vitrée. `pointer-events-none` : il ne doit
                    jamais intercepter un appui destiné au bouton. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-[24px] bg-gradient-to-b from-white/[0.07] to-transparent"
                />

                {offre.badge && (
                  <div className={`absolute -top-2.5 right-4 z-10 px-2.5 py-1 text-[9.5px] font-black rounded-full uppercase tracking-widest shadow-lg ${offre.badge.style}`}>
                    {offre.badge.texte}
                  </div>
                )}

                {/* ── ICÔNE, NOM ET POSITIONNEMENT SUR UNE SEULE LIGNE ──────
                    L'icône occupait 44 pixels de haut à elle seule, sur sa
                    propre ligne, suivie du nom sur une autre. Trois lignes pour
                    dire « Essentiel ». Elles n'en font plus qu'une. */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${offre.style.pastille}`}>
                    <Icone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-black leading-none">{offre.nom}</h3>
                    {/* Trois ou quatre mots : à qui s'adresse cette offre. Un
                        paragraphe entier répétait ce que les avantages disent
                        déjà juste en dessous. */}
                    <p className="text-[11px] text-foreground/45 leading-tight mt-1 truncate">
                      {offre.accroche}
                    </p>
                  </div>
                </div>

                {/* ── LE PRIX DE L'OFFRE MISE EN AVANT EST PLUS GROS ─────────
                    Quatre-vingt-seize pour cent du trafic est sur téléphone, où
                    les trois cartes s'empilent l'une sous l'autre. La position
                    ne suffit donc pas à distinguer : c'est la taille qui dit
                    laquelle regarder en premier. */}
                <div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {/* Le prix de la vedette porte un dégradé TRÈS clair —
                        blanc vers cyan pâle. Assez pour qu'il vibre, pas assez
                        pour perdre du contraste : le point le plus sombre du
                        dégradé reste plus clair que du blanc à 80 %. */}
                    <span
                      className={`font-black tracking-tight leading-none ${
                        offre.vedette
                          ? 'text-[2.75rem] bg-gradient-to-br from-white via-white to-cyan-100 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(56,189,248,0.25)]'
                          : 'text-[2rem] text-foreground'
                      }`}
                    >
                      {reglee?.prix ?? offre.prix}
                    </span>
                    <span className="text-foreground/45 text-[12.5px] font-bold">{offre.periode}</span>
                  </div>

                  {offre.mention && (
                    <p className="text-[10.5px] text-foreground/35 mt-1">{offre.mention}</p>
                  )}

                  {economieAnnuelle(offre.cle, offres) && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1.5 rounded-full bg-success/10 border border-success/25">
                      <Sparkles className="w-2.5 h-2.5 text-success shrink-0" />
                      <span className="text-[10px] font-black text-success">{economieAnnuelle(offre.cle, offres)}</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-2 md:flex-1">
                  {offre.avantages
                    // Le quota et l'Agent VIP sont modifiables depuis
                    // l'administration : ils ne peuvent pas être écrits en dur
                    // ici, sinon la page annoncerait un forfait que le compteur
                    // ne respecte pas.
                    .map((label) =>
                      label === QUOTA
                        ? reglee?.analyses === null
                          ? 'Analyses illimitées'
                          : `${reglee?.analyses ?? 0} analyses IA par mois`
                        : label
                    )
                    .concat(
                      reglee?.agentVip && !offre.avantages.includes('Agent IA VIP')
                        ? ['Agent IA VIP']
                        : []
                    )
                    .map((label) => {
                    const phare = label === offre.avantagePhare;
                    return (
                      <li key={label} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${offre.style.coche}`}>
                          <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
                        </div>
                        <span className={`text-[12.5px] font-semibold leading-tight ${phare ? offre.style.accentTexte : 'text-foreground/85'}`}>
                          {label}
                        </span>
                        {phare && (
                          <Crown className="w-3 h-3 text-warning shrink-0" />
                        )}
                      </li>
                    );
                  })}

                  {offre.exclus.map((label) => (
                    <li key={label} className="flex items-center gap-2.5 opacity-50">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-sidebar">
                        <X className="w-2.5 h-2.5 text-foreground/40" />
                      </div>
                      <span className="text-[12.5px] text-foreground/40 leading-tight">{label}</span>
                    </li>
                  ))}
                </ul>

                {/* Zone tactile de 48 px : en dessous, un pouce rate la cible.
                    Le prix reste DANS le bouton — c'est la dernière chose lue
                    avant le clic, et l'y répéter lève le dernier doute. */}
                <button
                  onClick={() => handleSubscribe(offre.cle)}
                  disabled={loadingPlan !== null || checkingStatus || couvert}
                  className={`w-full min-h-[48px] py-3 rounded-[16px] font-black text-[13.5px] transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                    couvert
                      ? 'bg-success/15 text-success cursor-not-allowed'
                      : offre.style.bouton
                  }`}
                >
                  {checkingStatus ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : couvert ? (
                    <>
                      {plan === offre.tier ? 'Abonnement Actif' : 'Déjà inclus'}
                      <Check className="w-4 h-4" />
                    </>
                  ) : enCours ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {offre.cta}
                      <span className="opacity-60">—</span>
                      <span>{reglee?.prix ?? offre.prix} FCFA</span>
                    </>
                  )}
                </button>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── TROIS ARGUMENTS, UNE SEULE LIGNE ───────────────────────────────
          Ces trois cartes occupaient près de trois cents pixels sous les
          offres — plus qu'une carte d'abonnement entière — pour un contenu que
          personne ne lit à ce moment-là : la décision se prend au-dessus. Les
          arguments restent, réduits à ce qu'ils disent vraiment. */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1">
        {[
          { icone: Brain, texte: 'Modèles entraînés sur 10 ans de données' },
          { icone: Shield, texte: 'Données des ligues officielles' },
          { icone: TrendingUp, texte: 'Détection des baisses de forme' },
        ].map(({ icone: Icone, texte }) => (
          <span key={texte} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/40">
            <Icone className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            {texte}
          </span>
        ))}
      </div>

      {/* ── CE QUE L ABONNEMENT ACHETE, ET CE QU IL N ACHETE PAS ──────────
          C est la page ou l on sort sa carte, donc celle ou la nature du
          produit doit etre la moins ambigue. On dit ce qui est vendu : un
          acces a des analyses. Pas un enjeu, pas une promesse de gain. */}
      <p className="text-[11px] text-foreground/40 leading-relaxed text-center max-w-2xl mx-auto pt-2">
        ProFoot AI vend un accès à un outil d&apos;analyse statistique du football.
        L&apos;abonnement ne constitue pas un enjeu et ne donne droit à aucun gain :
        il ouvre l&apos;accès aux analyses et aux statistiques de la plateforme.
        Aucune analyse ne garantit un résultat.
      </p>

      {/* La notice n existe QUE pendant le clic sur une offre. Hors de ce
          moment, elle n est pas montee : aucun encombrement ailleurs sur la
          page, et rien a charger pour les visiteurs qui n achetent pas. */}
      {noticePour && (
        <NoticePaiement
          paysDetecte={paysDetecte}
          libelleOffre={libelleDe(noticePour, offres)}
          // La meme cle que celle du clic, pour que les sorties de la notice
          // se rapportent a l offre qui les a declenchees. Sans elle, on
          // comptait 146 clics sur l Essentiel d un cote et 192 « Continuer »
          // sans offre de l autre.
          cleOffre={noticePour}
          // Le montant reel de l offre choisie, reglable depuis /admin/offres :
          // afficher un prix ecrit en dur mentirait le jour ou il change.
          montantXof={offres[noticePour]?.prixBrut}
          onContinuer={(paysRetenu) => lancerPaiement(noticePour, paysRetenu)}
          onFermer={() => setNoticePour(null)}
        />
      )}
    </div>
  );
}

/** Ce que l acheteur s apprete a payer, ecrit tel qu il l a lu sur la carte. */
function libelleDe(cle: PlanKey, offres: OffresAffichees): string {
  const offre = OFFRES.find((o) => o.cle === cle);
  const prix = offres[cle]?.prix ?? offre?.prix ?? "";
  return [offre?.nom, prix ? prix + " " + (offre?.periode ?? "") : null].filter(Boolean).join(" — ");
}

function ProBadge({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-6 rounded-[20px] bg-sidebar/50 border border-border-card space-y-3 hover:border-primary/30 transition-colors">
      <div className="w-10 h-10 rounded-[16px] bg-primary/10 flex items-center justify-center text-primary">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-bold text-sm uppercase tracking-widest">{title}</h4>
      <p className="text-xs text-foreground/50 leading-relaxed">{desc}</p>
    </div>
  );
}
