'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mail, Lock, User, AlertCircle, Brain, TrendingUp, Zap, ShieldCheck } from 'lucide-react'
import { signup } from '../login/actions'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    
    const result = await signup(formData)
    
    if (result?.error) {
      setError(result.error)
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
        
        {/* Contenu */}
        <div className="relative z-10 w-full max-w-xl px-12 xl:px-20">
          <Link href="/" className="flex items-center gap-3 mb-16 group w-max">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
              <Brain className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>ProFoot</span>
          </Link>
          
          <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.1] mb-6">
            Analysez les matchs avec l'intelligence artificielle.
          </h1>
          <p className="text-lg text-zinc-400 font-medium mb-12 leading-relaxed">
            Rejoignez des milliers de parieurs et de passionnés qui utilisent ProFoot pour prédire les résultats avec une précision inégalée.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-zinc-300 font-medium text-lg">Prédictions basées sur l'IA</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-zinc-300 font-medium text-lg">Données en temps réel</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-zinc-300 font-medium text-lg">Statistiques avancées</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- COLONNE DROITE (Formulaire) --- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center relative px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        {/* Glow effect on mobile only */}
        <div className="lg:hidden absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] h-[300px] bg-emerald-500/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[400px] mx-auto relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <Link href="/" className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[18px] flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                <Brain className="w-7 h-7" />
              </div>
              <span className="text-2xl font-black text-white tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>ProFoot</span>
            </Link>
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
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                  placeholder="••••••••"
                />
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

