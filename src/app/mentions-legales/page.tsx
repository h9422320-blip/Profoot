import Link from "next/link";
import { Shield, Mail, Globe, Server } from "lucide-react";

export const metadata = {
  title: "Mentions Légales — ProFoot AI",
  description: "Mentions légales de ProFoot AI, la plateforme d'analyse football propulsée par l'intelligence artificielle.",
};

export default function MentionsLegalesPage() {
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
            <Shield className="w-4 h-4 text-[#10b981]" />
            <span className="text-[#10b981] text-sm font-medium">Informations légales</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Mentions Légales</h1>
          <p className="text-white/50 text-lg">Dernière mise à jour : Juin 2026</p>
        </div>

        <div className="space-y-10">
          {/* Section 1 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">1. Éditeur du site</h2>
            </div>
            <div className="space-y-3 text-white/70 leading-relaxed">
              <p><span className="text-white font-semibold">Nom du service :</span> ProFoot AI</p>
              <p><span className="text-white font-semibold">Site web :</span> profoot-ai.com</p>
              <p><span className="text-white font-semibold">Nature :</span> Plateforme SaaS d'analyse de matchs de football propulsée par l'intelligence artificielle.</p>
              <p><span className="text-white font-semibold">Contact :</span> contactprofootai@gmail.com</p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">2. Hébergement</h2>
            </div>
            <div className="space-y-3 text-white/70 leading-relaxed">
              <p>Le site ProFoot AI est hébergé par la société :</p>
              <div className="bg-white/5 rounded-xl p-5 mt-4 border border-white/5">
                <p className="text-white font-semibold">Vercel Inc.</p>
                <p>440 N Barranca Ave #4133</p>
                <p>Covina, CA 91723, États-Unis</p>
                <p className="mt-2"><span className="text-white/50">Site web :</span> <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-[#10b981] hover:underline">vercel.com</a></p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#10b981]" />
              </div>
              <h2 className="text-xl font-bold">3. Responsabilité et Contact</h2>
            </div>
            <div className="space-y-4 text-white/70 leading-relaxed">
              <p>
                ProFoot AI est un outil d'analyse statistique des matchs de football basé sur l'intelligence artificielle. 
                Les analyses, prédictions et scénarios fournis par la plateforme sont générés à des fins 
                <strong className="text-white"> d'information et d'analyse sportive uniquement</strong>. 
                Ils ne constituent en aucun cas des conseils financiers ou des certitudes de résultats sportifs.
              </p>
              <p>
                Pour toute question ou demande concernant le site et son contenu, vous pouvez nous contacter à l'adresse suivante :
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

          {/* Section 4 */}
          <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-6">4. Propriété intellectuelle</h2>
            <div className="space-y-3 text-white/70 leading-relaxed">
              <p>
                L'ensemble des contenus présents sur le site ProFoot AI (textes, graphiques, logos, images, interface) sont protégés 
                par les droits de propriété intellectuelle. Toute reproduction, distribution ou utilisation sans autorisation expresse 
                est strictement interdite.
              </p>
              <p>
                Les données footballistiques utilisées par notre moteur d'intelligence artificielle proviennent de sources officielles 
                et de partenaires agréés.
              </p>
            </div>
          </section>

          {/* Navigation bottom */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/cgv" className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl p-5 hover:bg-white/[0.06] hover:border-[#10b981]/30 transition-all group text-center">
              <p className="text-sm text-white/50 mb-1">Voir aussi</p>
              <p className="font-semibold group-hover:text-[#10b981] transition-colors">Conditions Générales →</p>
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
