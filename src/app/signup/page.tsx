'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mail, Lock, User, AlertCircle, Brain } from 'lucide-react'
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
    <div className="min-h-[100dvh] sm:min-h-screen bg-[#050505] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md mx-auto relative z-10">
        <Link href="/" className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-2 mb-8 sm:mb-8">
          <div className="w-16 h-16 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[20px] sm:rounded-xl flex items-center justify-center text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <Brain className="w-8 h-8 sm:w-5 sm:h-5" />
          </div>
          <span className="text-3xl sm:text-2xl font-black text-white tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>ProFoot</span>
        </Link>
        <h2 className="mt-2 sm:mt-6 text-center text-3xl sm:text-3xl font-black text-white tracking-tight">
          Créer un compte
        </h2>
        <p className="mt-3 sm:mt-2 text-center text-sm sm:text-sm text-zinc-400 font-medium">
          Ou{' '}
          <Link href="/login" className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
            connectez-vous à un compte existant
          </Link>
        </p>
      </div>

      <div className="mt-10 sm:mt-8 w-full max-w-md mx-auto relative z-10">
        <div className="bg-[#0a0a0a]/80 backdrop-blur-xl py-10 px-6 sm:py-8 sm:px-10 shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-white/5 rounded-[32px] sm:rounded-2xl">
          <form action={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
                Nom complet
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="appearance-none block w-full pl-11 pr-4 py-4 sm:pl-10 sm:pr-3 sm:py-3 border border-white/10 rounded-[16px] sm:rounded-xl bg-white/5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-base sm:text-sm"
                  placeholder="Jean Dupont"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                Adresse email
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full pl-11 pr-4 py-4 sm:pl-10 sm:pr-3 sm:py-3 border border-white/10 rounded-[16px] sm:rounded-xl bg-white/5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-base sm:text-sm"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                Mot de passe
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="appearance-none block w-full pl-11 pr-4 py-4 sm:pl-10 sm:pr-3 sm:py-3 border border-white/10 rounded-[16px] sm:rounded-xl bg-white/5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-base sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Doit contenir au moins 6 caractères.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-4 sm:py-3 px-4 border border-transparent rounded-[16px] sm:rounded-xl text-base sm:text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-[#050505] transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-lg shadow-emerald-500/20"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
                <span className="relative flex items-center gap-2">
                  {isLoading ? 'Création en cours...' : 'Créer mon compte'}
                  {!isLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
