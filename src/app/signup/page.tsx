'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Mail, Lock, User, AlertCircle, TrendingUp, Zap, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { signup } from '../login/actions'
import { ProFootLogo } from '@/components/ui/ProFootLogo'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signup(formData)
      if (result?.error) {
        setError(result.error)
        setIsLoading(false)
      }
    } catch (e: any) {
      if (e?.message?.includes('NEXT_REDIRECT')) throw e
      setError('Une erreur inattendue est survenue')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex w-full bg-[#050505]">
      
      {/* --- COLONNE GAUCHE (Présentation Produit) - Masquée sur mobile --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0a0a0a] border-r border-white/5 items-center justify-center overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
        
        {/* Logo Top Left */}
        <div className="absolute top-8 left-8 flex items-center gap-3">
           <Image src="/logo.png" alt="ProFoot" width={40} height={40} className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
           <span className="font-black text-2xl text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ProFoot</span>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg px-12">
          <h1 className="text-5xl font-black text-white leading-[1.1] mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Analysez les matchs avec l'intelligence artificielle.
          </h1>
          <p className="text-lg text-zinc-400 font-medium mb-12 leading-relaxed">
            Rejoignez des milliers de parieurs et de passionnés qui utilisent ProFoot pour prédire les résultats avec une précision inégalée.
          </p>

          <div className="space-y-6">
            {[
              { icon: TrendingUp, text: "Prédictions basées sur l'IA" },
              { icon: Zap, text: "Données en temps réel" },
              { icon: ShieldCheck, text: "Statistiques avancées" }
            ].map((Feature, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
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

        <div className="w-full max-w-[400px] mx-auto relative z-10">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-12">
            <Image src="/logo.png" alt="ProFoot" width={48} height={48} className="w-12 h-12 object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
            <span className="font-black text-3xl text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ProFoot</span>
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
          </div>

          {/* Form */}
          <form action={handleSubmit} className="space-y-5">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
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
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent rounded-xl text-base font-bold text-white bg-emerald-500 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-[#050505] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
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

