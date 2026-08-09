'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Lock, AlertCircle, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

/**
 * Choix du nouveau mot de passe, après avoir cliqué sur le lien reçu par e-mail.
 *
 * Le lien de Supabase ouvre une session temporaire de récupération. Tant que
 * cette session n'est pas établie, le formulaire reste masqué : sans elle,
 * `updateUser` échouerait et l'utilisateur croirait avoir changé son mot de
 * passe alors que rien n'aurait été enregistré.
 */
type Step = 'verification' | 'attente-confirmation' | 'formulaire' | 'lien-invalide' | 'termine'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('verification')
  const [jeton, setJeton] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  /** Efface les jetons de la barre d'adresse : ils ne doivent pas rester dans l'historique. */
  const nettoyerUrl = () =>
    window.history.replaceState({}, '', window.location.pathname)

  useEffect(() => {
    const supabase = createClient()
    let annule = false

    async function analyserLien() {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const requete = new URLSearchParams(window.location.search)

      const erreurLien =
        fragment.get('error_description') || fragment.get('error') ||
        requete.get('error_description') || requete.get('error')

      if (erreurLien) {
        if (!annule) setStep('lien-invalide')
        return
      }

      // ── Cas normal : le lien porte un jeton à usage unique ──
      //
      // On NE le vérifie PAS ici. Les messageries et les navigateurs ouvrent
      // automatiquement les liens contenus dans les e-mails pour détecter
      // l'hameçonnage ; comme un jeton se consume à la première ouverture, le
      // robot le brûlerait avant l'utilisateur, qui verrait « lien expiré »
      // quelques secondes après avoir reçu son e-mail.
      // La vérification n'a donc lieu qu'au clic sur le bouton : un robot
      // n'appuie sur aucun bouton.
      const tokenHash = requete.get('token_hash')
      if (tokenHash) {
        if (!annule) {
          setJeton(tokenHash)
          setStep('attente-confirmation')
        }
        return
      }

      // ── Anciens liens, déjà envoyés avant cette correction ──
      // Ils portent la session directement dans l'adresse. On continue de les
      // accepter pour ne pas laisser sans solution ceux qui en ont un en attente.
      const accessToken = fragment.get('access_token')
      const refreshToken = fragment.get('refresh_token')
      const code = requete.get('code')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        nettoyerUrl()
        if (!annule) setStep(error ? 'lien-invalide' : 'formulaire')
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        nettoyerUrl()
        if (!annule) setStep(error ? 'lien-invalide' : 'formulaire')
        return
      }

      // Aucun jeton dans l'URL. Une session déjà ouverte dans le navigateur ne
      // vaut PAS autorisation : sinon quelqu'un arrivant sur cette page avec le
      // compte d'un autre pourrait changer le mot de passe de ce compte.
      if (!annule) setStep('lien-invalide')
    }

    analyserLien()

    return () => {
      annule = true
    }
  }, [])

  /** Consomme le jeton — déclenché uniquement par un clic humain. */
  async function confirmerIdentite() {
    if (!jeton) return
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: jeton,
      type: 'recovery',
    })

    nettoyerUrl()
    setIsLoading(false)
    setStep(error ? 'lien-invalide' : 'formulaire')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne sont pas identiques.')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(
          error.message.toLowerCase().includes('should be different')
            ? "Ce mot de passe est identique à l'ancien. Choisissez-en un autre."
            : error.message
        )
        setIsLoading(false)
        return
      }

      setStep('termine')
      // La session ouverte par le lien vaut connexion : on entre directement
      // dans l'application avec le nouveau mot de passe déjà enregistré.
      setTimeout(() => router.push('/analyze'), 2500)
    } catch {
      setError('Erreur de connexion. Réessayez.')
      setIsLoading(false)
    }
  }

  return (
    <div className="landing-root min-h-screen flex w-full relative items-center justify-center px-6 py-12">
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

        {step === 'verification' && (
          <div className="text-center space-y-4 py-6">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-zinc-400 font-medium">Vérification du lien...</p>
          </div>
        )}

        {step === 'lien-invalide' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white tracking-tight">Lien expiré ou déjà utilisé</h2>
              <p className="text-zinc-400 font-medium leading-relaxed">
                Ce lien n'est plus valable. Les liens de réinitialisation expirent au bout d'une heure
                et ne fonctionnent qu'une seule fois.
              </p>
            </div>
            <Link href="/mot-de-passe-oublie" className="hero-cta-primary group w-full justify-center !text-base inline-flex">
              <span className="relative flex items-center gap-2">
                Demander un nouveau lien
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        )}

        {step === 'termine' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white tracking-tight">Mot de passe modifié</h2>
              <p className="text-zinc-400 font-medium">
                Vous êtes connecté. Redirection vers l'application...
              </p>
            </div>
          </div>
        )}

        {step === 'attente-confirmation' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white tracking-tight">Confirmez que c'est bien vous</h2>
              <p className="text-zinc-400 font-medium leading-relaxed">
                Cliquez ci-dessous pour choisir votre nouveau mot de passe.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <button
              onClick={confirmerIdentite}
              disabled={isLoading}
              className="hero-cta-primary group w-full justify-center !text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative flex items-center gap-2">
                {isLoading ? 'Vérification...' : 'Choisir un nouveau mot de passe'}
                {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Cette étape protège votre compte : elle garantit qu'une personne, et non un
              programme automatique, est à l'origine de la demande.
            </p>
          </div>
        )}

        {step === 'formulaire' && (
          <>
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Nouveau mot de passe</h2>
              <p className="text-zinc-400 font-medium">Choisissez un mot de passe d'au moins 6 caractères.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-zinc-300">
                  Nouveau mot de passe
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmation" className="block text-sm font-semibold text-zinc-300">
                  Confirmer le mot de passe
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="confirmation"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 focus:bg-white/10 transition-all text-base sm:text-sm shadow-sm"
                    placeholder="••••••••"
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
                    {isLoading ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
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
