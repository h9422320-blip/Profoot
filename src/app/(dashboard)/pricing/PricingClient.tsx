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
    accroche: "Pour découvrir l'analyse IA à votre rythme.",
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
      halo: 'from-sky-400/40 to-cyan-400/40',
      pastille: 'bg-sky-400/10 text-sky-400 border-sky-400/30',
      coche: 'bg-sky-400/15 text-sky-400',
      bouton: 'bg-sky-500/15 border border-sky-400/40 text-sky-300 hover:bg-sky-500/25',
      accentTexte: 'text-sky-400',
    },
  },
  {
    cle: 'pro_monthly' as PlanKey,
    tier: 'PRO' as PlanTier,
    nom: 'Pro',
    prix: '5.000',
    periode: 'FCFA / mois',
    accroche: 'Le meilleur équilibre pour analyser sérieusement.',
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
      halo: 'from-primary to-info',
      pastille: 'bg-primary/15 text-primary border-primary/40',
      coche: 'bg-primary/20 text-primary',
      bouton: 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/30',
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
    accroche: "L'offre la plus complète, sans aucune limite.",
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
      halo: 'from-warning/40 to-amber-500/40',
      pastille: 'bg-warning/10 text-warning border-warning/30',
      coche: 'bg-warning/15 text-warning',
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
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-warning text-[10px] font-black uppercase tracking-widest">
          <Star className="w-3 h-3 fill-warning" /> Expérience Elite
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter">
          Choisissez votre <span className="text-primary italic">offre</span>
        </h1>
        <p className="text-foreground/50 text-lg max-w-2xl mx-auto">
          Débloquez la pleine puissance de l'IA ProFoot et accédez à des analyses de niveau professionnel. Payez facilement via Orange Money, MTN, Wave, etc.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {OFFRES.map((offre, i) => {
          const reglee = offres[offre.cle];
          const Icone = offre.icone;
          const couvert = couvertPar(offre.tier);
          const enCours = loadingPlan === offre.cle;

          return (
            <motion.div
              key={offre.cle}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className={`relative group ${offre.vedette ? 'md:-mt-4 md:mb-4' : ''}`}
            >
              {/* Halo coloré : donne du relief à la carte sans masquer le texte */}
              <div
                className={`absolute -inset-[3px] bg-gradient-to-br ${offre.style.halo} rounded-[32px] blur-lg transition-opacity duration-700 ${
                  offre.vedette ? 'opacity-30 group-hover:opacity-60' : 'opacity-0 group-hover:opacity-35'
                }`}
              />

              <div
                className={`relative h-full bg-card border-2 ${offre.style.bordure} rounded-[28px] p-8 pt-9 flex flex-col gap-7 transition-colors duration-300 ${
                  offre.vedette ? 'shadow-2xl shadow-primary/20' : ''
                }`}
              >
                {offre.badge && (
                  <div className={`absolute -top-3 right-6 px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg ${offre.badge.style}`}>
                    {offre.badge.texte}
                  </div>
                )}

                {/* En-tête : icône, nom, prix */}
                <div className="space-y-3">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${offre.style.pastille}`}>
                    <Icone className="w-5 h-5" />
                  </div>

                  <h3 className="text-xl font-bold">{offre.nom}</h3>

                  {/* ── LE PRIX DE L'OFFRE MISE EN AVANT EST PLUS GROS ─────
                      Quatre-vingt-douze pour cent du trafic est sur téléphone,
                      où les trois cartes s'empilent l'une sous l'autre. La
                      position ne suffit donc pas à distinguer : c'est la taille
                      qui dit laquelle regarder en premier. */}
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`font-black tracking-tight ${
                        offre.vedette ? 'text-5xl sm:text-[3.25rem]' : 'text-3xl'
                      }`}
                    >
                      {reglee?.prix ?? offre.prix}
                    </span>
                    <span className="text-foreground/40 text-sm font-semibold">{offre.periode}</span>
                  </div>

                  {offre.mention && (
                    <p className="text-xs text-foreground/40">{offre.mention}</p>
                  )}

                  {economieAnnuelle(offre.cle, offres) && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/25">
                      <Sparkles className="w-3 h-3 text-success" />
                      <span className="text-[11px] font-black text-success">{economieAnnuelle(offre.cle, offres)}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-foreground/50 leading-relaxed">{offre.accroche}</p>

                <ul className="space-y-3.5 flex-1">
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
                      <li key={label} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${offre.style.coche}`}>
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                        <span className={`text-sm font-bold ${phare ? offre.style.accentTexte : 'text-foreground'}`}>
                          {label}
                        </span>
                        {phare && (
                          <Crown className="w-3.5 h-3.5 text-warning shrink-0" />
                        )}
                      </li>
                    );
                  })}

                  {offre.exclus.map((label) => (
                    <li key={label} className="flex items-center gap-3 opacity-50">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-sidebar">
                        <X className="w-3 h-3 text-foreground/40" />
                      </div>
                      <span className="text-sm text-foreground/40">{label}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(offre.cle)}
                  disabled={loadingPlan !== null || checkingStatus || couvert}
                  className={`w-full py-4 rounded-[20px] font-black text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
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
            </motion.div>
          );
        })}
      </div>

      {/* Pro Features Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
        <ProBadge icon={Brain} title="IA Neuronale" desc="Modèles prédictifs entraînés sur 10 ans de données réelles." />
        <ProBadge icon={Shield} title="Data Vérifiée" desc="Source directe des ligues officielles pour une précision totale." />
        <ProBadge icon={TrendingUp} title="Smart Insights" desc="Détection automatique des baisses de forme et opportunités." />
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
