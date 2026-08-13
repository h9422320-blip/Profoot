'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Veuillez remplir tous les champs.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect(destinationApres(formData))
}

/**
 * Où renvoyer l'utilisateur après connexion.
 *
 * Presque toujours la page d'analyse. Mais un acheteur qui revient de sa banque
 * avec une session expirée arrive ici en portant l'identité du match qu'il vient
 * de payer. Le renvoyer sur une page d'analyse nue lui ferait perdre exactement
 * ce qu'il a acheté — c'est le même écran vide que le bug d'origine, atteint par
 * un autre chemin.
 *
 * Seules deux valeurs sont reprises, et jamais une adresse fournie par
 * l'appelant : une redirection ouverte permettrait d'envoyer quelqu'un vers un
 * site tiers depuis notre propre page de connexion.
 */
function destinationApres(formData: FormData): string {
  const propre = (v: FormDataEntryValue | null) =>
    typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null

  const t1 = propre(formData.get('t1'))
  const t2 = propre(formData.get('t2'))

  return t1 && t2
    ? `/analyze?t1=${encodeURIComponent(t1)}&t2=${encodeURIComponent(t2)}`
    : '/analyze'
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (!email || !password || !name) {
    return { error: 'Veuillez remplir tous les champs.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/analyze')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}
