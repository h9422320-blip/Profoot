"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Mail, ChevronDown, HelpCircle,
  CreditCard, Lock, Zap, RefreshCw, Users, AlertTriangle, ExternalLink
} from "lucide-react";

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqCategories = [
    {
      icon: Lock,
      title: "Compte & Connexion",
      color: "#10b981",
      faqs: [
        {
          q: "J'ai oublié mon mot de passe, comment le réinitialiser ?",
          a: "Sur la page de connexion, clique sur \"Mot de passe oublié\" et entre ton adresse e-mail. Tu recevras un lien de réinitialisation dans ta boîte mail dans quelques secondes. Vérifie aussi tes spams si tu ne le vois pas."
        },
        {
          q: "Je n'arrive pas à me connecter, que faire ?",
          a: "Vérifie d'abord que ton adresse e-mail et ton mot de passe sont corrects. Si le problème persiste, essaie de réinitialiser ton mot de passe. Si tu as toujours des difficultés, contacte-nous à contactprofootai@gmail.com."
        },
        {
          q: "Puis-je changer mon adresse e-mail ?",
          a: "Oui, tu peux modifier ton adresse e-mail depuis les paramètres de ton compte. Va dans Paramètres > Mon Compte pour effectuer cette modification."
        },
        {
          q: "Comment supprimer mon compte ?",
          a: "Pour supprimer définitivement ton compte et toutes tes données, contacte-nous à contactprofootai@gmail.com. Nous traiterons ta demande dans les 48 heures."
        },
      ]
    },
    {
      icon: CreditCard,
      title: "Accès & Paiement",
      color: "#6366f1",
      faqs: [
        {
          q: "Quels sont les moyens de paiement acceptés ?",
          a: "ProFoot AI accepte les paiements via Mobile Money (Orange Money, MTN Mobile Money, Wave et autres) ainsi que par carte bancaire (Visa, Mastercard). Tous les paiements sont 100% sécurisés."
        },
        {
          q: "Mon paiement a été débité mais mon compte n'est pas activé. Que faire ?",
          a: "Cela peut arriver dans de rares cas. Contacte-nous immédiatement à contactprofootai@gmail.com en précisant ton adresse e-mail et le montant prélevé. Nous vérifierons et activerons ton compte dans les plus brefs délais."
        },
        {
          q: "Est-ce que je peux obtenir un remboursement ?",
          a: "En raison de la nature numérique du service (accès immédiat aux analyses IA), les remboursements ne sont généralement pas accordés après utilisation. En cas de problème technique de notre côté, nous étudions chaque situation individuellement. Contacte-nous à contactprofootai@gmail.com."
        },
        {
          q: "Mon accès se renouvelle-t-il tout seul ?",
          a: "Non. Chaque achat est un paiement unique qui ouvre ton accès pour une durée fixe. Rien n'est prélevé automatiquement et il n'y a donc rien à annuler : à la fin de la période, l'accès s'arrête simplement. Si tu veux continuer, tu rachètes quand tu le souhaites."
        },
      ]
    },
    {
      icon: Zap,
      title: "Utilisation de l'IA",
      color: "#f59e0b",
      faqs: [
        {
          q: "Comment fonctionne l'analyse IA des matchs ?",
          a: "Notre moteur d'intelligence artificielle analyse des millions de données en temps réel : forme des équipes, historique des confrontations (H2H), statistiques avancées (Expected Goals, possession, tirs cadrés), compositions attendues et niveau relatif des championnats. Il génère ensuite des tendances et des scénarios pour chaque match."
        },
        {
          q: "Quelle est la fiabilité des analyses de l'IA ?",
          a: "Non, et aucun outil au monde ne peut garantir des résultats sportifs à 100%. Le football reste imprévisible. ProFoot AI est un outil d'analyse statistique qui augmente ta compréhension d'un match. Utilise-le pour mieux analyser, pas comme seule source de décision."
        },
        {
          q: "Combien d'analyses puis-je faire par jour ?",
          a: "Le nombre d'analyses dépend de ton offre. L'accès gratuit est limité. Avec un accès Premium, tu bénéficies d'analyses illimitées pour tous les matchs couverts par notre plateforme."
        },
        {
          q: "Quelles compétitions sont couvertes ?",
          a: "ProFoot AI couvre plus de 15 grandes compétitions : Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Europa League, Ligue des Champions CAF, CHAN, CAN et bien d'autres. La liste est régulièrement mise à jour."
        },
      ]
    },
    {
      icon: AlertTriangle,
      title: "Problèmes techniques",
      color: "#ef4444",
      faqs: [
        {
          q: "L'application est lente ou ne charge pas, que faire ?",
          a: "Essaie d'abord de vider le cache de ton navigateur (Ctrl+Shift+Del) ou de recharger la page (F5). Si le problème persiste, c'est peut-être une surcharge temporaire de nos serveurs. Réessaie dans quelques minutes. Si ça dure, contacte-nous."
        },
        {
          q: "Je vois une erreur sur l'analyse d'un match, c'est normal ?",
          a: "Certaines erreurs peuvent apparaître si les données du match ne sont pas encore disponibles (match récent, données manquantes de l'API). Réessaie après quelques minutes. Si l'erreur persiste sur un match déjà joué, contacte-nous en précisant les deux équipes concernées."
        },
        {
          q: "L'application ne fonctionne pas bien sur mon téléphone.",
          a: "ProFoot AI est optimisé pour les navigateurs modernes (Chrome, Firefox, Safari). Assure-toi d'avoir la dernière version de ton navigateur. Si le problème persiste, envoie-nous une capture d'écran à contactprofootai@gmail.com."
        },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-[#101c24] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#101c24]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
              <img src="/logo.png" alt="ProFoot" className="w-full h-full object-cover scale-[1.35]" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">ProFoot<span className="text-[#10b981]"> AI</span></span>
          </Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors">← Retour à l'accueil</Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#10b981]/10 border border-[#10b981]/20 rounded-full px-4 py-2 mb-6">
            <HelpCircle className="w-4 h-4 text-[#10b981]" />
            <span className="text-[#10b981] text-sm font-medium">Support & Aide</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Comment pouvons-nous<br />
            <span className="text-[#10b981]">vous aider ?</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Trouvez rapidement une réponse à vos questions ou contactez notre équipe directement.
          </p>
        </div>

        {/* ── LA CARTE « CHAT EN DIRECT » PROMETTAIT CE QUI N'EXISTE PAS ────
            Elle annonçait « Parle directement avec notre équipe support.
            Réponse rapide pendant les heures ouvrables », et son clic
            appelait `window.Tawk_API.toggle()`.

            Vérifié le 4 septembre 2026 : le composant « TawkToChat » existe
            dans le dépôt mais n'est monté par AUCUNE page. `Tawk_API` est
            donc toujours `undefined`, et le clic retombait sur un `mailto:`
            — qui, sur un téléphone sans application de courrier configurée,
            ne fait rigoureusement rien.

            C'est au pire moment que cette carte était lue. Sur la boutique,
            trois avis du 28 août disent « Je deja paye », « Ya quoi »,
            « J'ai payé déjà ». Ces personnes cherchaient quelqu'un à qui
            parler ; on leur montrait un chat qui n'a jamais existé.

            On ne remplace pas une promesse creuse par une autre : il reste
            le canal qui fonctionne réellement, et il le dit franchement. */}
        <div className="grid grid-cols-1 gap-5 mb-16">
          <a
            href="mailto:contactprofootai@gmail.com"
            className="bg-gradient-to-br from-[#10b981]/10 to-[#10b981]/5 border border-[#10b981]/30 rounded-2xl p-8 hover:border-[#10b981]/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#10b981]/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Mail className="w-6 h-6 text-[#10b981]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Écrire à l&apos;équipe</h3>
            <p className="text-white/60 text-sm mb-4 leading-relaxed">
              Pour un accès qui ne s&apos;ouvre pas, un paiement ou toute autre
              question. Précisez l&apos;adresse e-mail utilisée pour payer : c&apos;est
              elle qui permet de retrouver votre achat. Réponse sous 24 à 48 h.
            </p>
            <span className="inline-flex items-center gap-2 text-[#10b981] font-semibold text-sm">
              contactprofootai@gmail.com <ExternalLink className="w-3 h-3" />
            </span>
          </a>
        </div>

        {/* FAQ */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Questions fréquentes</h2>
            <p className="text-white/50">Les réponses aux questions que nos utilisateurs posent le plus souvent.</p>
          </div>

          <div className="space-y-8">
            {faqCategories.map((category, catIdx) => (
              <div key={catIdx}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${category.color}20` }}>
                    <category.icon className="w-5 h-5" style={{ color: category.color }} />
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: category.color }}>{category.title}</h3>
                </div>

                {/* FAQs */}
                <div className="space-y-3 pl-0 md:pl-3">
                  {category.faqs.map((faq, faqIdx) => {
                    const globalIdx = catIdx * 10 + faqIdx;
                    const isOpen = openFaq === globalIdx;
                    return (
                      <div
                        key={faqIdx}
                        className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-all duration-200 ${isOpen ? "border-white/15" : "border-white/8 hover:border-white/12"}`}
                      >
                        <button
                          className="w-full flex items-center justify-between gap-4 p-5 text-left"
                          onClick={() => setOpenFaq(isOpen ? null : globalIdx)}
                        >
                          <span className="font-semibold text-white/90 text-sm md:text-base">{faq.q}</span>
                          <ChevronDown
                            className={`w-5 h-5 text-white/40 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#10b981]" : ""}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-white/60 text-sm leading-relaxed border-t border-white/5 pt-4">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Still stuck CTA */}
        <div className="mt-16 bg-gradient-to-r from-[#10b981]/10 to-[#6366f1]/10 border border-white/10 rounded-2xl p-10 text-center">
          <Users className="w-10 h-10 text-[#10b981] mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-3">Vous n'avez pas trouvé votre réponse ?</h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            Notre équipe est là pour vous aider. Envoyez-nous un message et nous vous répondrons dans les plus brefs délais.
          </p>
          <a
            href="mailto:contactprofootai@gmail.com"
            className="inline-flex items-center gap-2 bg-[#10b981] hover:bg-[#0ea271] text-black font-bold px-8 py-4 rounded-xl transition-colors"
          >
            <Mail className="w-5 h-5" />
            Contacter le support
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 mt-16 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-sm">
          <span>© 2026 ProFoot AI — Tous droits réservés.</span>
          <div className="flex gap-6">
            <Link href="/mentions-legales" className="hover:text-white/60 transition-colors">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white/60 transition-colors">Confidentialité</Link>
            <Link href="/cgv" className="hover:text-white/60 transition-colors">CGV</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
