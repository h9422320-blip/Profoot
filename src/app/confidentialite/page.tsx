import Link from "next/link";
import { Eye, Lock, Database, BarChart2, Mail, UserX } from "lucide-react";

export const metadata = {
  title: "Politique de Confidentialité — ProFoot AI",
  description: "Politique de confidentialité et protection des données personnelles de ProFoot AI.",
};

export default function ConfidentialitePage() {
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
            <Lock className="w-4 h-4 text-[#10b981]" />
            <span className="text-[#10b981] text-sm font-medium">Protection de vos données</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Politique de Confidentialité</h1>
          <p className="text-white/50 text-lg">Dernière mise à jour : Juin 2026</p>
        </div>

        <div className="space-y-10">

          {/* Intro */}
          <section className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-8">
            <p className="text-white/80 leading-relaxed text-lg">
              Chez ProFoot AI, la protection de vos données personnelles est une priorité. Cette politique explique 
              de façon simple et transparente quelles données nous collectons, pourquoi, et comment nous les utilisons.
              <strong className="text-white"> Nous ne vendons jamais vos données à des tiers.</strong>
            </p>
          </section>

          {/* Section 1 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">1. Données que nous collectons</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>Lorsque vous utilisez ProFoot AI, nous collectons uniquement les données strictement nécessaires au fonctionnement du service :</p>
              <div className="space-y-3 mt-4">
                {[
                  { label: "Adresse e-mail", detail: "Utilisée pour créer votre compte, vous connecter et vous envoyer des informations importantes concernant votre abonnement." },
                  { label: "Mot de passe", detail: "Chiffré et sécurisé. Nous n'y avons jamais accès en clair. Stocké de manière cryptée par notre infrastructure de sécurité (Supabase)." },
                  { label: "Historique d'analyses", detail: "Les analyses de matchs que vous avez effectuées sur la plateforme, conservées pour vous permettre de les retrouver dans votre historique." },
                  { label: "Données de paiement", detail: "Nous ne stockons pas vos informations bancaires. Les paiements sont traités directement et de façon sécurisée par notre prestataire de paiement." },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-5">
                    <p className="text-white font-semibold mb-1">✓ {item.label}</p>
                    <p className="text-sm text-white/60">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">2. Utilisation des données</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>Vos données sont utilisées exclusivement pour :</p>
              <ul className="space-y-2 mt-3">
                {[
                  "Créer et gérer votre compte utilisateur sur ProFoot AI.",
                  "Vous donner accès aux fonctionnalités de la plateforme selon votre abonnement.",
                  "Vous contacter en cas de question ou de problème technique.",
                  "Améliorer les performances de notre moteur d'intelligence artificielle (de façon anonyme et agrégée).",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">3. Sécurité de vos données</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                Vos données sont stockées de manière sécurisée par <strong className="text-white">Supabase</strong>, 
                une infrastructure de base de données de niveau professionnel qui utilise les standards de sécurité les plus avancés 
                (chiffrement SSL/TLS, mots de passe hachés avec bcrypt).
              </p>
              <p>
                Nous mettons tout en œuvre pour protéger vos informations personnelles contre tout accès non autorisé, 
                divulgation, altération ou destruction.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">4. Outils tiers (Analytique)</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                ProFoot AI utilise <strong className="text-white">Vercel Web Analytics</strong> pour mesurer l'audience 
                du site (nombre de visiteurs, pages les plus visitées, pays des visiteurs). Cet outil :
              </p>
              <ul className="space-y-2 mt-3">
                {[
                  "Ne dépose pas de cookies sur votre appareil.",
                  "Ne collecte pas votre adresse IP complète.",
                  "Ne vous suit pas d'un site à un autre.",
                  "Respecte votre vie privée de façon native.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <UserX className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">5. Vos droits</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>Conformément aux lois de protection des données, vous disposez des droits suivants concernant vos informations personnelles :</p>
              <ul className="space-y-2 mt-3">
                {[
                  "Droit d'accès : demander à consulter les données que nous détenons sur vous.",
                  "Droit de rectification : demander la correction de vos informations.",
                  "Droit à l'effacement : demander la suppression complète de votre compte et de vos données.",
                  "Droit d'opposition : vous opposer à l'utilisation de vos données à des fins d'analyse.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] mt-2 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4">
                Pour exercer l'un de ces droits, contactez-nous simplement à :
              </p>
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
            <Link href="/cgv" className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl p-5 hover:bg-white/[0.06] hover:border-[#10b981]/30 transition-all group text-center">
              <p className="text-sm text-white/50 mb-1">Voir aussi</p>
              <p className="font-semibold group-hover:text-[#10b981] transition-colors">Conditions Générales →</p>
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
