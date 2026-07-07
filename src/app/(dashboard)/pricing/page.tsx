"use client";

import { Check, Zap, Brain, TrendingUp, Shield, Star, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà Pro
    fetch('/api/payments/moneroo/status')
      .then(res => res.json())
      .then(data => {
        setIsPro(data.isPro);
      })
      .catch(err => console.error(err))
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleSubscribe = async (plan: string) => {
    try {
      setLoadingPlan(plan);
      const res = await fetch('/api/payments/moneroo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      
      const data = await res.json();
      
      if (data.checkoutUrl) {
        // Rediriger vers la page de paiement Moneroo
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

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-warning text-[10px] font-black uppercase tracking-widest">
          <Star className="w-3 h-3 fill-warning" /> Expérience Elite
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter">
          Passez au <span className="text-primary italic">Plan Pro</span>
        </h1>
        <p className="text-foreground/50 text-lg max-w-2xl mx-auto">
          Débloquez la pleine puissance de l'IA ProFoot et accédez à des analyses de niveau professionnel. Payez facilement via Orange Money, MTN, Wave, etc.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {/* Free Plan */}
        <div className="bg-card border border-border-card rounded-3xl p-8 space-y-8 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Standard</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">0</span>
              <span className="text-foreground/40 text-sm">FCFA / mois</span>
            </div>
          </div>
          <p className="text-sm text-foreground/50">Pour les passionnés qui souhaitent un aperçu des prédictions IA.</p>
          <ul className="space-y-4 flex-1">
            <FeatureItem label="Analyses quotidiennes limitées" />
            <FeatureItem label="Scores probables basiques" />
            <FeatureItem label="Classements et calendriers" />
            <FeatureItem label="Publicité discrète" />
          </ul>
          <button className="w-full py-4 rounded-2xl bg-sidebar border border-border-card text-foreground/40 font-bold cursor-not-allowed">
            Plan Actuel
          </button>
        </div>

        {/* Pro Monthly Plan */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-info rounded-[2rem] blur opacity-25 group-hover:opacity-50 transition duration-1000" />
          <div className="relative bg-card border-2 border-primary rounded-3xl p-8 space-y-8 flex flex-col h-full shadow-2xl shadow-primary/20">
            <div className="absolute top-4 right-4 px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase tracking-widest">
              Recommandé
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                Pro <span className="bg-warning text-black text-[10px] px-2 py-0.5 rounded italic">MENSUEL</span>
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">2.000</span>
                <span className="text-foreground/40 text-sm">FCFA / mois</span>
              </div>
            </div>
            <p className="text-sm text-foreground/50">L'outil ultime pour les experts et analystes de données football.</p>
            <ul className="space-y-4 flex-1">
              <FeatureItem label="Analyses IA Illimitées" pro />
              <FeatureItem label="Détails tactiques profonds (xG, xA)" pro />
              <FeatureItem label="États physiques & Blessures réels" pro />
              <FeatureItem label="Historique Head-to-Head illimité" pro />
              <FeatureItem label="Accès Coupe du Monde 2026" pro />
              <FeatureItem label="Zéro Publicité" pro />
            </ul>
            <button 
              onClick={() => handleSubscribe('monthly')}
              disabled={loadingPlan !== null || checkingStatus || isPro}
              className={`w-full py-4 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2 ${
                isPro 
                  ? 'bg-success/20 text-success cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-primary/30'
              }`}
            >
              {checkingStatus ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPro ? (
                <>Abonnement Actif <Check className="w-4 h-4" /></>
              ) : loadingPlan === 'monthly' ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>S'abonner maintenant <Zap className="w-4 h-4 fill-white" /></>
              )}
            </button>
          </div>
        </div>

        {/* Pro Lifetime Plan */}
        <div className="bg-card border border-border-card rounded-3xl p-8 space-y-8 flex flex-col">
          <div className="space-y-2">
            <h3 className="text-xl font-bold flex items-center gap-2">
              Pro <span className="bg-success text-white text-[10px] px-2 py-0.5 rounded italic">À VIE</span>
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">2.000</span>
              <span className="text-foreground/40 text-sm">FCFA</span>
            </div>
          </div>
          <p className="text-sm text-foreground/50">Payez une seule fois, profitez de ProFoot AI pour toujours.</p>
          <ul className="space-y-4 flex-1">
            <FeatureItem label="Toutes les fonctionnalités Pro" pro />
            <FeatureItem label="Paiement unique (pas d'abonnement)" pro />
            <FeatureItem label="Mises à jour futures incluses" pro />
            <FeatureItem label="Support prioritaire" pro />
          </ul>
          <button 
            onClick={() => handleSubscribe('lifetime')}
            disabled={loadingPlan !== null || checkingStatus || isPro}
            className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
              isPro 
                ? 'bg-sidebar border border-border-card text-foreground/40 cursor-not-allowed'
                : 'bg-sidebar border border-border-card text-white hover:bg-sidebar-hover'
            }`}
          >
            {loadingPlan === 'lifetime' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPro ? (
              'Déjà Pro'
            ) : (
              'Acheter l\'accès à vie'
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
    <div className="p-6 rounded-2xl bg-sidebar/50 border border-border-card space-y-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-bold text-sm uppercase tracking-widest">{title}</h4>
      <p className="text-xs text-foreground/50 leading-relaxed">{desc}</p>
    </div>
  );
}
