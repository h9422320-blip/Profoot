"use client";

import { Check, Zap, Brain, TrendingUp, Shield, Star, Loader2, Crown, X } from "lucide-react";
import { useState, useEffect } from "react";

type PlanTier = 'FREE' | 'ESSENTIAL' | 'PRO' | 'VIP';
type PlanKey = 'essential_monthly' | 'pro_monthly' | 'vip_yearly';

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanTier>('FREE');
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Le niveau affiché vient du serveur : le frontend ne décide jamais des
  // droits, il se contente de refléter ce que le backend applique réellement.
  useEffect(() => {
    fetch('/api/payments/status')
      .then(res => res.json())
      .then(data => {
        if (data.plan) setPlan(data.plan as PlanTier);
      })
      .catch(err => console.error(err))
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleSubscribe = async (selectedPlan: PlanKey) => {
    try {
      setLoadingPlan(selectedPlan);
      const res = await fetch('/api/payments/chariow/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan })
      });

      // Session expirée : reconnexion plutôt qu'un message d'erreur trompeur.
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      const data = await res.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
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
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-warning text-[10px] font-black uppercase tracking-widest">
          <Star className="w-3 h-3 fill-warning" /> Expérience Elite
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter">
          Choisissez votre <span className="text-primary italic">offre</span>
        </h1>
        <p className="text-foreground/50 text-lg max-w-2xl mx-auto">
          Débloquez la pleine puissance de l'IA ProFoot et accédez à des analyses de niveau professionnel. Payez facilement via Orange Money, MTN, Wave, etc.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

        {/* ── ESSENTIEL ── */}
        <div className="bg-card border border-border-card rounded-[28px] p-8 space-y-8 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Essentiel</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">9.000</span>
              <span className="text-foreground/40 text-sm">FCFA / mois</span>
            </div>
          </div>
          <p className="text-sm text-foreground/50">Pour découvrir l'analyse IA à votre rythme.</p>
          <ul className="space-y-4 flex-1">
            <FeatureItem label="10 analyses IA par mois" pro />
            <FeatureItem label="Analyses Premium" pro />
            <FeatureItem label="Statistiques avancées" pro />
            <FeatureItem label="Analyse des compétitions" pro />
            <FeatureItem label="Historique des analyses" pro />
            <FeatureItem label="Fonctionnalités Premium standards" pro />
            <ExcludedItem label="Agent IA VIP non inclus" />
          </ul>
          <button
            onClick={() => handleSubscribe('essential_monthly')}
            disabled={loadingPlan !== null || checkingStatus || couvertPar('ESSENTIAL')}
            className={`w-full py-4 rounded-[20px] font-bold transition-all flex items-center justify-center gap-2 ${
              couvertPar('ESSENTIAL')
                ? 'bg-success/20 text-success cursor-not-allowed'
                : 'bg-sidebar border border-border-card text-white hover:bg-sidebar-hover'
            }`}
          >
            {checkingStatus ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : couvertPar('ESSENTIAL') ? (
              <>{plan === 'ESSENTIAL' ? 'Abonnement Actif' : 'Déjà inclus'} <Check className="w-4 h-4" /></>
            ) : loadingPlan === 'essential_monthly' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Choisir l'Essentiel"
            )}
          </button>
        </div>

        {/* ── PRO (offre mise en avant) ── */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-info rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000" />
          <div className="relative bg-card border-2 border-primary rounded-[28px] p-8 space-y-8 flex flex-col h-full shadow-2xl shadow-primary/20">
            <div className="absolute top-4 right-4 px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase tracking-widest">
              Plus populaire
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">15.000</span>
                <span className="text-foreground/40 text-sm">FCFA / mois</span>
              </div>
            </div>
            <p className="text-sm text-foreground/50">Le meilleur équilibre pour analyser sérieusement.</p>
            <ul className="space-y-4 flex-1">
              <FeatureItem label="20 analyses IA par mois" pro />
              <FeatureItem label="Analyses Premium" pro />
              <FeatureItem label="Statistiques avancées" pro />
              <FeatureItem label="Analyse des compétitions" pro />
              <FeatureItem label="Historique complet des analyses" pro />
              <FeatureItem label="Fonctionnalités Premium standards" pro />
              <FeatureItem label="Mises à jour Premium" pro />
              <ExcludedItem label="Agent IA VIP non inclus" />
            </ul>
            <button
              onClick={() => handleSubscribe('pro_monthly')}
              disabled={loadingPlan !== null || checkingStatus || couvertPar('PRO')}
              className={`w-full py-4 rounded-[20px] font-black shadow-lg transition-all flex items-center justify-center gap-2 ${
                couvertPar('PRO')
                  ? 'bg-success/20 text-success cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-primary/30'
              }`}
            >
              {checkingStatus ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : couvertPar('PRO') ? (
                <>{plan === 'PRO' ? 'Abonnement Actif' : 'Déjà inclus'} <Check className="w-4 h-4" /></>
              ) : loadingPlan === 'pro_monthly' ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>Choisir le Pro <Zap className="w-4 h-4 fill-white" /></>
              )}
            </button>
          </div>
        </div>

        {/* ── VIP ANNUEL ── */}
        <div className="bg-card border border-warning/40 rounded-[28px] p-8 space-y-8 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-xl font-bold flex items-center gap-2">
              VIP Annuel <Crown className="w-4 h-4 text-warning" />
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">60.000</span>
              <span className="text-foreground/40 text-sm">FCFA / an</span>
            </div>
            <p className="text-xs text-foreground/40">Paiement annuel</p>
          </div>
          <p className="text-sm text-foreground/50">L'offre la plus complète, sans aucune limite.</p>
          <ul className="space-y-4 flex-1">
            <FeatureItem label="Analyses illimitées" pro />
            <FeatureItem label="Toutes les fonctionnalités Premium" pro />
            <FeatureItem label="Agent IA VIP" pro />
            <FeatureItem label="Fonctionnalités Premium exclusives" pro />
            <FeatureItem label="Priorité sur les nouvelles fonctionnalités" pro />
            <FeatureItem label="Futures améliorations Premium" pro />
          </ul>
          <button
            onClick={() => handleSubscribe('vip_yearly')}
            disabled={loadingPlan !== null || checkingStatus || couvertPar('VIP')}
            className={`w-full py-4 rounded-[20px] font-bold transition-all flex items-center justify-center gap-2 ${
              couvertPar('VIP')
                ? 'bg-success/20 text-success cursor-not-allowed'
                : 'bg-warning hover:bg-warning/90 text-black shadow-lg shadow-warning/20'
            }`}
          >
            {checkingStatus ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : couvertPar('VIP') ? (
              <>Abonnement Actif <Check className="w-4 h-4" /></>
            ) : loadingPlan === 'vip_yearly' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Devenir VIP <Crown className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>

      {/* Pro Features Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
        <ProBadge icon={Brain} title="IA Neuronale" desc="Modèles prédictifs entraînés sur 10 ans de données réelles." />
        <ProBadge icon={Shield} title="Data Vérifiée" desc="Source directe des ligues officielles pour une précision totale." />
        <ProBadge icon={TrendingUp} title="Smart Insights" desc="Détection automatique des baisses de forme et opportunités." />
      </div>
    </div>
  );
}

function FeatureItem({ label, pro }: { label: string; pro?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${pro ? "bg-primary/20" : "bg-sidebar"}`}>
        <Check className={`w-3 h-3 ${pro ? "text-primary" : "text-foreground/20"}`} />
      </div>
      <span className={`text-sm ${pro ? "font-bold text-foreground" : "text-foreground/40"}`}>{label}</span>
    </li>
  );
}

/** Fonctionnalité explicitement NON incluse — annoncer clairement ce qui est
 *  verrouillé évite la déception après paiement. */
function ExcludedItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3 opacity-60">
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-sidebar">
        <X className="w-3 h-3 text-foreground/40" />
      </div>
      <span className="text-sm text-foreground/40">{label}</span>
    </li>
  );
}

function ProBadge({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-6 rounded-[20px] bg-sidebar/50 border border-border-card space-y-3">
      <div className="w-10 h-10 rounded-[16px] bg-primary/10 flex items-center justify-center text-primary">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-bold text-sm uppercase tracking-widest">{title}</h4>
      <p className="text-xs text-foreground/50 leading-relaxed">{desc}</p>
    </div>
  );
}
