"use client";

import { Check, Zap, Brain, TrendingUp, Shield, Star, Loader2, Crown } from "lucide-react";
import { useState, useEffect } from "react";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plan, setPlan] = useState<'FREE' | 'MONTHLY' | 'YEARLY'>('FREE');
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    fetch('/api/payments/status')
      .then(res => res.json())
      .then(data => {
        if (data.plan === 'MONTHLY' || data.plan === 'YEARLY') setPlan(data.plan);
      })
      .catch(err => console.error(err))
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleSubscribe = async (selectedPlan: 'monthly' | 'yearly') => {
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
        // Rediriger vers la page de paiement Chariow
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

  const isMonthly = plan === 'MONTHLY';
  const isYearly = plan === 'YEARLY';

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-warning text-[10px] font-black uppercase tracking-widest">
          <Star className="w-3 h-3 fill-warning" /> Expérience Elite
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter">
          Passez au <span className="text-primary italic">Premium</span>
        </h1>
        <p className="text-foreground/50 text-lg max-w-2xl mx-auto">
          Débloquez la pleine puissance de l'IA ProFoot et accédez à des analyses de niveau professionnel. Payez facilement via Orange Money, MTN, Wave, etc.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {/* Free Plan */}
        <div className="bg-card border border-border-card rounded-[28px] p-8 space-y-8 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Standard</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">0</span>
              <span className="text-foreground/40 text-sm">FCFA</span>
            </div>
          </div>
          <p className="text-sm text-foreground/50">Pour les passionnés qui souhaitent un aperçu des prédictions IA.</p>
          <ul className="space-y-4 flex-1">
            <FeatureItem label="Analyses quotidiennes limitées" />
            <FeatureItem label="Scores probables basiques" />
            <FeatureItem label="Classements et calendriers" />
            <FeatureItem label="Publicité discrète" />
          </ul>
          <button className="w-full py-4 rounded-[20px] bg-sidebar border border-border-card text-foreground/40 font-bold cursor-not-allowed">
            {plan === 'FREE' ? 'Plan Actuel' : 'Plan de base'}
          </button>
        </div>

        {/* Premium Mensuel */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-info rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000" />
          <div className="relative bg-card border-2 border-primary rounded-[28px] p-8 space-y-8 flex flex-col h-full shadow-2xl shadow-primary/20">
            <div className="absolute top-4 right-4 px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase tracking-widest">
              Populaire
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                Premium <span className="bg-warning text-black text-[10px] px-2 py-0.5 rounded-full italic">MENSUEL</span>
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">15.000</span>
                <span className="text-foreground/40 text-sm">FCFA / mois</span>
              </div>
            </div>
            <p className="text-sm text-foreground/50">L'accès complet à l'analyseur IA et aux statistiques professionnelles.</p>
            <ul className="space-y-4 flex-1">
              <FeatureItem label="Accès complet à l'analyseur IA" pro />
              <FeatureItem label="Analyses Premium illimitées" pro />
              <FeatureItem label="Statistiques avancées (xG, xA)" pro />
              <FeatureItem label="Analyse des compétitions" pro />
              <FeatureItem label="Analyse des grands championnats" pro />
              <FeatureItem label="Historique complet des analyses" pro />
              <li className="flex items-center gap-3 opacity-60">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-sidebar">
                  <span className="text-foreground/40 text-xs font-bold">✕</span>
                </div>
                <span className="text-sm text-foreground/40">Agent IA VIP — exclusivité de l'Annuel</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe('monthly')}
              disabled={loadingPlan !== null || checkingStatus || isMonthly || isYearly}
              className={`w-full py-4 rounded-[20px] font-black shadow-lg transition-all flex items-center justify-center gap-2 ${
                isMonthly || isYearly
                  ? 'bg-success/20 text-success cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-primary/30'
              }`}
            >
              {checkingStatus ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isMonthly || isYearly ? (
                <>Abonnement Actif <Check className="w-4 h-4" /></>
              ) : loadingPlan === 'monthly' ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>S'abonner maintenant <Zap className="w-4 h-4 fill-white" /></>
              )}
            </button>
          </div>
        </div>

        {/* Premium Annuel (VIP) */}
        <div className="bg-card border border-warning/40 rounded-[28px] p-8 space-y-8 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-xl font-bold flex items-center gap-2">
              Premium <span className="bg-success text-white text-[10px] px-2 py-0.5 rounded-full italic">ANNUEL</span>
              <Crown className="w-4 h-4 text-warning" />
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">60.000</span>
              <span className="text-foreground/40 text-sm">FCFA / an</span>
            </div>
            <p className="text-xs text-success font-bold">Économisez 120 000 FCFA par rapport au mensuel</p>
          </div>
          <p className="text-sm text-foreground/50">Le niveau ultime : tout le Mensuel, plus votre analyste IA personnel disponible 24h/24.</p>
          <ul className="space-y-4 flex-1">
            <FeatureItem label="Toutes les fonctionnalités du Mensuel incluses" pro />
            <FeatureItem label="Agent IA VIP illimité — votre expert football personnel 24h/24" pro />
            <FeatureItem label="Pronostics, tactiques et transferts en temps réel via l'Agent" pro />
            <FeatureItem label="Priorité sur les nouvelles fonctionnalités" pro />
            <FeatureItem label="Toutes les futures améliorations Premium incluses" pro />
          </ul>
          <button
            onClick={() => handleSubscribe('yearly')}
            disabled={loadingPlan !== null || checkingStatus || isYearly}
            className={`w-full py-4 rounded-[20px] font-bold transition-all flex items-center justify-center gap-2 ${
              isYearly
                ? 'bg-success/20 text-success cursor-not-allowed'
                : 'bg-warning hover:bg-warning/90 text-black shadow-lg shadow-warning/20'
            }`}
          >
            {loadingPlan === 'yearly' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isYearly ? (
              <>Abonnement Actif <Check className="w-4 h-4" /></>
            ) : isMonthly ? (
              <>Passer au VIP <Crown className="w-4 h-4" /></>
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
