'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Mail, AlertCircle, ArrowLeft, MailCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

/**
 * Demande de réinitialisation du mot de passe.
 *
 * Supabase envoie un lien à usage unique vers /reinitialiser-mot-de-passe.
 * Le message de confirmation est volontairement identique que l'adresse existe
 * ou non : afficher « ce compte n'existe pas » permettrait à un inconnu de
 * découvrir quelles adresses sont inscrites sur ProFoot.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
      })

      // Seules les erreurs techniques sont montrées (limite d'envoi atteinte,
      // service indisponible). Une adresse inconnue ne renvoie pas d'erreur.
      if (error) {
        setError(
          error.message.toLowerCase().includes('rate')
            ? "Trop de demandes en peu de temps. Patientez quelques minutes avant de réessayer."
            : "L'envoi a échoué. Réessayez dans un instant."
        )
        setIsLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError("Erreur de connexion. Vérifiez votre connexion internet.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="landing-root auth-page min-h-screen flex w-full relative items-center justify-center px-6 py-12">
      <div className="ambient-lighting">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
      </div>
      <div className="premium-grid-bg" />

      <div className="w-full max-w-[440px] relative z-10 bg-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(16,185,129,0.06)]">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
            <Image src="/logo.png" alt="ProFoot" width={48} height={48} className="w-full h-full object-cover scale-[1.35]" />
          </div>
          <span className="font-black text-3xl text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>ProFoot</span>
        </div>

        {sent ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <MailCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white tracking-tight">Vérifiez votre boîte mail</h2>
              <p className="text-zinc-400 font-medium leading-relaxed">
                Si un compte ProFoot est associé à <span className="text-white font-semibold">{email}</span>,
                vous recevez un lien pour choisir un nouveau mot de passe.
              </p>
              <p className="text-sm text-zinc-500">
                Le lien est valable une heure. Pensez à regarder dans les courriers indésirables.
              </p>
            </div>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Mot de passe oublié</h2>
              <p className="text-zinc-400 font-medium">
                Indiquez votre adresse e-mail : nous vous envoyons un lien pour en choisir un nouveau.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                    placeholder="vous@exemple.com"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="hero-cta-primary group w-full justify-center !text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative flex items-center gap-2">
                    {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
                    {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
