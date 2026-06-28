import Link from "next/link";
import { FileText, CreditCard, AlertTriangle, RefreshCw, Scale, Mail } from "lucide-react";

export const metadata = {
  title: "Conditions Générales — ProFoot AI",
  description: "Conditions générales d'utilisation et de vente de ProFoot AI.",
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-[#070e13] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#070e13]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full overflow-hidden drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
              <img src="/logo.png" alt="ProFoot" className="w-full h-full object-cover scale-[1.35]" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">ProFoot<span className="text-[#10b981]"> AI</span></span>
          </Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white transition-colors">← Retour à l'accueil</Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Page Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-[#10b981]/10 border border-[#10b981]/20 rounded-full px-4 py-2 mb-6">
            <FileText className="w-4 h-4 text-[#10b981]" />
            <span className="text-[#10b981] text-sm font-medium">Documents contractuels</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Conditions Générales</h1>
          <p className="text-white/50 text-lg">Dernière mise à jour : Juin 2026</p>
        </div>

        <div className="space-y-10">

          {/* Section 1 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">1. Objet du service</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                ProFoot AI est une plateforme en ligne (disponible sur <strong className="text-white">profoot-ai.com</strong>) qui propose des analyses 
                statistiques de matchs de football générées par intelligence artificielle. Notre moteur croise des millions de données 
                (forme des équipes, historique des confrontations, statistiques avancées telles que les Expected Goals, compositions probables) 
                pour produire des rapports d'analyse, des probabilités et des scénarios tactiques.
              </p>
              <p>
                En accédant et en utilisant ProFoot AI, l'utilisateur accepte pleinement et sans réserve les présentes Conditions Générales.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">2. Abonnement et Paiement</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                ProFoot AI propose un accès <strong className="text-white">gratuit limité</strong> et des formules d'abonnement 
                <strong className="text-white"> Premium</strong> permettant d'accéder à l'ensemble des fonctionnalités de la plateforme.
              </p>
              <p>
                Le paiement de l'abonnement Premium s'effectue de manière sécurisée via les moyens suivants :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="bg-white/5 border border-white/8 rounded-xl p-5">
                  <p className="text-white font-semibold mb-2">📱 Mobile Money</p>
                  <p className="text-sm text-white/60">Orange Money, MTN Mobile Money, Wave, et autres services disponibles dans votre pays.</p>
                </div>
                <div className="bg-white/5 border border-white/8 rounded-xl p-5">
                  <p className="text-white font-semibold mb-2">💳 Carte bancaire</p>
                  <p className="text-sm text-white/60">Visa, Mastercard et autres cartes bancaires internationales.</p>
                </div>
              </div>
              <p className="mt-4">
                Les tarifs en vigueur sont affichés sur la page de tarification du site. ProFoot AI se réserve le droit de modifier 
                ses tarifs à tout moment, avec un préavis communiqué aux utilisateurs inscrits.
              </p>
            </div>
          </section>

          {/* Section 3 - TRÈS IMPORTANT */}
          <section className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-amber-400">3. Limitation de responsabilité (Clause essentielle)</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p className="text-amber-300/80 font-medium">
                Cette clause est fondamentale. Veuillez la lire attentivement.
              </p>
              <p>
                ProFoot AI est un <strong className="text-white">outil d'aide à l'analyse statistique du football</strong>. 
                Les prédictions, probabilités, scénarios et rapports générés par notre intelligence artificielle sont fournis 
                <strong className="text-white"> à des fins d'information et d'analyse sportive uniquement</strong>.
              </p>
              <p>
                ProFoot AI <strong className="text-amber-300">ne garantit pas</strong> l'exactitude ni la réalisation des prédictions émises. 
                Le football reste un sport soumis à de nombreux facteurs imprévisibles (blessures de dernière minute, erreurs arbitrales, 
                conditions climatiques, état psychologique des joueurs, etc.).
              </p>
              <p>
                <strong className="text-amber-300">ProFoot AI n'est pas un conseiller financier et ne saurait être tenu responsable</strong> de 
                toute perte financière ou dommage subi par l'utilisateur dans le cadre de paris sportifs, de pronostics ou de toute autre 
                décision prise sur la base des analyses fournies par la plateforme.
              </p>
              <p>
                L'utilisateur reconnaît utiliser ProFoot AI sous sa seule et entière responsabilité. ProFoot AI décline toute 
                responsabilité en cas de résultat différent des prédictions générées.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">4. Politique de remboursement</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                En raison de la nature numérique et instantanée du service fourni par ProFoot AI (accès immédiat aux analyses IA 
                dès la souscription), <strong className="text-white">aucun remboursement ne sera accordé</strong> après l'activation 
                d'un abonnement Premium, conformément aux règles applicables aux biens et services numériques.
              </p>
              <p>
                En cas de problème technique avéré de notre côté (panne de la plateforme, erreur de facturation), nous nous engageons 
                à trouver une solution adaptée. Contactez-nous à : 
                <a href="mailto:contactprofootai@gmail.com" className="text-[#10b981] hover:underline ml-1">contactprofootai@gmail.com</a>
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">5. Obligations de l'utilisateur</h2>
            </div>
            <div className="space-y-3 text-white/70 leading-relaxed">
              <p>En utilisant ProFoot AI, l'utilisateur s'engage à :</p>
              <ul className="space-y-2 mt-3">
                {[
                  "Fournir des informations exactes lors de son inscription (adresse e-mail valide).",
                  "Ne pas partager ses identifiants de connexion avec des tiers.",
                  "Ne pas utiliser la plateforme à des fins illégales ou contraires aux présentes conditions.",
                  "Ne pas tenter de contourner les restrictions d'accès liées à l'abonnement.",
                  "Utiliser les analyses fournies dans le respect des lois en vigueur dans son pays.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">6. Contact</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>Pour toute question relative aux présentes conditions générales :</p>
              <a 
                href="mailto:contactprofootai@gmail.com" 
                className="inline-flex items-center gap-2 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl px-5 py-3 text-[#10b981] hover:bg-[#10b981]/20 transition-colors font-medium"
              >
                <Mail className="w-4 h-4" />
                contactprofootai@gmail.com
              </a>
            </div>
          </section>

          {/* Navigation bottom */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/mentions-legales" className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl p-5 hover:bg-white/[0.06] hover:border-[#10b981]/30 transition-all group text-center">
              <p className="text-sm text-white/50 mb-1">Voir aussi</p>
              <p className="font-semibold group-hover:text-[#10b981] transition-colors">Mentions Légales →</p>
            </Link>
            <Link href="/confidentialite" className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl p-5 hover:bg-white/[0.06] hover:border-[#10b981]/30 transition-all group text-center">
              <p className="text-sm text-white/50 mb-1">Voir aussi</p>
              <p className="font-semibold group-hover:text-[#10b981] transition-colors">Politique de Confidentialité →</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-white/30 text-sm">
          © 2026 ProFoot AI — Tous droits réservés.
        </div>
      </div>
    </div>
  );
}
