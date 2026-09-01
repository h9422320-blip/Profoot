'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Mail, Lock, User, AlertCircle, TrendingUp, Zap, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { signup } from '../login/actions'
import { ProFootLogo } from '@/components/ui/ProFootLogo'

/**
 * Le nom lisible d'une offre, pour l'afficher à l'inscription.
 *
 * Le PRIX n'y figure pas : l'offre arrive de l'adresse, donc de l'extérieur.
 * Afficher un montant venu de l'URL laisserait n'importe qui fabriquer un lien
 * annonçant « Essentiel — 200 FCFA ». Le vrai prix reste celui du serveur, à
 * l'étape suivante. Un nom inconnu n'affiche rien du tout.
 */
const LIBELLE_OFFRE: Record<string, string> = {
  essential_monthly: 'Essentiel',
  pro_monthly: 'Pro',
  vip_yearly: 'VIP Annuel',
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  /** La porte de sortie proposée avec le message : créer un compte, se connecter. */
  const [liensErreur, setLiensErreur] = useState<{ texte: string; href: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  /**
   * La page à rejoindre après l'inscription.
   *
   * Lue une seule fois, au premier rendu : `useSearchParams` imposerait une
   * frontière de suspense sur toute la page, pour un paramètre qui ne change
   * jamais pendant la saisie d'un formulaire.
   */
  const [suite] = useState(() => {
    if (typeof window === 'undefined') return ''
    const v = new URLSearchParams(window.location.search).get('suite') ?? ''
    // Le serveur revalide de toute façon ; ce contrôle évite seulement
    // d'envoyer une valeur qu'il rejettera en silence.
    return v.startsWith('/') && !v.startsWith('//') ? v : ''
  })

  /**
   * L'offre sur laquelle la personne vient de cliquer.
   *
   * Elle arrive dans son propre paramètre, et non dans `suite` : celui-ci
   * n'accepte qu'un chemin sans point d'interrogation, et cette contrainte
   * est ce qui empêche un lien truqué de renvoyer vers un site tiers juste
   * après la saisie du mot de passe.
   */
  const [offre] = useState(() => {
    if (typeof window === 'undefined') return ''
    const v = new URLSearchParams(window.location.search).get('offre') ?? ''
    return /^[a-z0-9_-]{1,40}$/i.test(v) ? v : ''
  })

  /**
   * L'adresse déjà payée, pré-remplie depuis le lien de l'invitation.
   *
   * C'est très exactement là qu'on perdait les gens. Le 29 août 2026, AMON a
   * payé avec `essanon231@` au lieu de `essanamon231@` — un caractère de
   * travers — et son accès ne l'a jamais retrouvé. Le champ rempli d'avance
   * supprime la faute de frappe.
   *
   * Modifiable : si la personne veut un autre compte, elle efface et retape.
   * On ne l'enferme pas, on lui évite une erreur.
   */
  const [emailInvite] = useState(() => {
    if (typeof window === 'undefined') return ''
    const v = new URLSearchParams(window.location.search).get('email') ?? ''
    return /^[^@\s]{1,64}@[^@\s]{3,255}$/.test(v) ? v.toLowerCase() : ''
  })

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signup(formData)
      if (result?.error) {
        setError(result.error)
        setLiensErreur((result as { liens?: { texte: string; href: string }[] }).liens ?? [])
        setIsLoading(false)
      }
    } catch (e: any) {
      if (e?.message?.includes('NEXT_REDIRECT')) throw e
      setError('Une erreur inattendue est survenue')
      setIsLoading(false)
    }
  }

  return (
    <div className="landing-root auth-page min-h-screen flex w-full relative">
      {/* Halos lumineux aurora (mêmes que la landing) */}
      <div className="ambient-lighting">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
      </div>
      <div className="premium-grid-bg" />

      {/* --- COLONNE GAUCHE (Présentation Produit) - Masquée sur mobile --- */}
      <div className="hidden lg:flex lg:w-1/2 relative border-r border-white/5 items-center justify-center overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
        
        {/* Logo Top Left */}
        <div className="absolute top-8 left-8 flex items-center gap-3">
           <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
             <Image src="/logo.png" alt="ProFoot" width={40} height={40} className="w-full h-full object-cover scale-[1.35]" />
           </div>
           <span className="font-black text-2xl text-white tracking-tight" style={{ fontFamily: "var(--police-titre), sans-serif" }}>ProFoot</span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg px-12">
          <h1 className="text-5xl font-black text-white leading-[1.1] mb-6" style={{ fontFamily: "var(--police-titre), sans-serif" }}>
            Analysez les matchs avec l'intelligence artificielle.
          </h1>
          <p className="text-lg text-zinc-400 font-medium mb-12 leading-relaxed">
            Rejoignez des milliers de passionnés de football qui utilisent ProFoot pour analyser les rencontres avec une précision inégalée.
          </p>

          <div className="space-y-6">
            {[
              { icon: TrendingUp, text: "Analyses basées sur l'IA", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_18px_rgba(16,185,129,0.15)]" },
              { icon: Zap, text: "Données en temps réel", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25 shadow-[0_0_18px_rgba(6,182,212,0.15)]" },
              { icon: ShieldCheck, text: "Statistiques avancées", color: "text-violet-400 bg-violet-500/10 border-violet-500/25 shadow-[0_0_18px_rgba(139,92,246,0.15)]" }
            ].map((Feature, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-transform group-hover:scale-110 ${Feature.color}`}>
                  <Feature.icon className="w-5 h-5" />
                </div>
                <span className="text-zinc-300 font-semibold text-lg">{Feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- COLONNE DROITE (Formulaire) --- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center relative px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        
        {/* Glow Top Mobile */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none lg:hidden" />

        <div className="w-full max-w-[440px] mx-auto relative z-10 bg-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(16,185,129,0.06)]">

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-12">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
              <Image src="/logo.png" alt="ProFoot" width={48} height={48} className="w-full h-full object-cover scale-[1.35]" />
            </div>
            <span className="font-black text-3xl text-white tracking-tight" style={{ fontFamily: "var(--police-titre), sans-serif" }}>ProFoot</span>
          </div>

          {/* Form Header */}
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">
              Créer un compte
            </h2>
            <p className="text-zinc-400 font-medium">
              Vous avez déjà un compte ?{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                Connectez-vous
              </Link>
            </p>

            {/* ── DIRE POURQUOI IL EST ICI ─────────────────────────────────
                Il vient de cliquer « Choisir l'Essentiel — 2 000 FCFA » et
                lisait « Créer un compte », sans un mot sur l'offre ni sur son
                prix. Certains croient s'être trompés de bouton et repartent.

                Le nom et le prix sont écrits EN DUR ici, et c'est délibéré :
                l'offre arrive de l'adresse, donc de l'extérieur. Afficher un
                prix venu de l'URL laisserait n'importe qui fabriquer un lien
                annonçant « Essentiel — 200 FCFA ». Un nom inconnu n'affiche
                rien du tout. Le vrai prix reste celui du serveur, à l'étape
                suivante. */}
            {LIBELLE_OFFRE[offre] && (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3 text-left">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
                <p className="text-[13px] font-semibold leading-snug text-zinc-200">
                  Créez votre compte pour finaliser votre accès{' '}
                  <span className="font-black text-emerald-300">{LIBELLE_OFFRE[offre]}</span>.
                  Le paiement s&apos;ouvrira juste après.
                </p>
              </div>
            )}
          </div>

          {/* Form */}
          <form action={handleSubmit} className="space-y-5">
            {/* ── D'OÙ VIENT LA PERSONNE, ET OÙ ELLE RETOURNE ─────────────
                Quelqu'un qui clique sur une offre sans compte est envoyé ici.
                Le renvoyer ensuite sur la page d'analyse lui ferait perdre son
                offre et recommencer à zéro — au moment précis où il voulait
                payer. Le champ est masqué et le serveur ne retient qu'un
                chemin interne : une adresse complète permettrait d'expédier
                quelqu'un vers un site tiers juste après son mot de passe. */}
            <input type="hidden" name="suite" value={suite} />
            <input type="hidden" name="offre" value={offre} />
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                {/* ── LES SORTIES SOUS LE TEXTE, PAS À CÔTÉ ──────────────
                    Le conteneur est une rangée « flex » : le lien se retrouvait
                    poussé à DROITE du message, écrasé sur un téléphone, et sa
                    marge « mt-2 » ne servait à rien. Il faut une colonne.

                    Et il en faut PLUSIEURS. Une seule sortie renvoyait celui
                    dont nous avions créé le compte vers l'inscription, qui le
                    renvoyait vers la connexion, qui le renvoyait vers
                    l'inscription. Un client a filmé son téléphone tournant dans
                    cette boucle le 29 août 2026. */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-red-200">{error}</p>
                  {liensErreur.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {liensErreur.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-bold text-white"
                        >
                          {l.texte}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-semibold text-zinc-300">
                Nom complet
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="block w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                  placeholder="Jean Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-zinc-300">
                Adresse e-mail
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={emailInvite}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-zinc-300">
                Mot de passe
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="block w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                Doit contenir au moins 6 caractères.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="hero-cta-primary group w-full justify-center !text-base disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 focus:ring-offset-[#101c24]"
              >
                <span className="relative flex items-center gap-2">
                  {isLoading ? 'Création en cours...' : 'Créer mon compte'}
                  {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </div>
            
            <p className="text-xs text-center text-zinc-500 font-medium pt-4">
              En créant un compte, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
            </p>
          </form>
        </div>
      </div>

    </div>
  )
}

