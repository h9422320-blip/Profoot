'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { messageAuth } from '@/lib/messages-auth'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { lireOrigine, metadonneesOrigine } from '@/lib/origine-visiteur'

/**
 * Relève le pays et l'appareil sur le compte courant.
 *
 * POURQUOI AUSSI À LA CONNEXION, ET PAS SEULEMENT À L'INSCRIPTION
 *
 * Huit cent soixante-trois comptes existent déjà sans aucune origine connue.
 * Attendre de nouvelles inscriptions pour savoir d'où viennent les gens ferait
 * perdre des semaines ; en relevant à chaque connexion, le parc se renseigne
 * de lui-même à mesure que les abonnés reviennent.
 *
 * N'INTERROMPT JAMAIS RIEN
 *
 * Une mesure qui ferait échouer une connexion serait pire que pas de mesure du
 * tout. Toute erreur est donc avalée : au pire, ce compte reste sans origine.
 */
async function releverOrigine(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const origine = lireOrigine(await headers())
    await supabase.auth.updateUser({ data: metadonneesOrigine(origine) })
  } catch {
    /* la connexion prime sur la mesure */
  }
}

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
    // ── JAMAIS LE MESSAGE BRUT DE SUPABASE ────────────────────────────────
    //
    // Il est en anglais — « Invalid login credentials » — sur une application
    // entièrement en français destinée à l'Afrique de l'Ouest. Et il ne dit pas
    // qu'on peut simplement ne pas avoir de compte : le 23 août 2026, quelqu'un
    // au Bénin a fait trois allers-retours entre la connexion et la
    // récupération de mot de passe avant d'abandonner en soixante-sept
    // secondes, sans jamais entrer.
    const m = messageAuth(error.message)
    return { error: m.texte, lien: m.lien }
  }

  await releverOrigine(supabase)

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

  // LA PAGE RÉELLEMENT DEMANDÉE PASSE EN PREMIER.
  //
  // Quelqu'un qui ouvrait /admin sans session se connectait, puis atterrissait
  // sur l'analyse — et en concluait qu'il n'avait pas les droits. Il fallait
  // deviner qu'il devait retaper l'adresse.
  //
  // On n'accepte QU'UN CHEMIN INTERNE, jamais une adresse complète : sans cette
  // contrainte, un lien de connexion truqué renverrait la personne vers un site
  // tiers juste après avoir saisi son mot de passe. Les deux barres obliques
  // sont refusées explicitement — « //ailleurs.com » est une adresse externe
  // valide pour un navigateur, tout en ressemblant à un chemin interne.
  const suite = formData.get('suite')
  if (
    typeof suite === 'string' &&
    suite.startsWith('/') &&
    !suite.startsWith('//') &&
    /^\/[a-z0-9/_-]{0,60}$/i.test(suite)
  ) {
    return suite
  }

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

  // Le pays et l'appareil sont posés DÈS la création, dans le même appel : un
  // compte créé puis abandonné garde ainsi sa trace, alors qu'un relevé fait
  // seulement à la connexion suivante ne dirait jamais rien de celui qui ne
  // revient pas — précisément celui qu'on cherche à comprendre.
  const origine = lireOrigine(await headers())

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        ...metadonneesOrigine(origine),
      },
    },
  })

  if (error) {
    // ── JAMAIS LE MESSAGE BRUT DE SUPABASE ────────────────────────────────
    //
    // Il est en anglais — « Invalid login credentials » — sur une application
    // entièrement en français destinée à l'Afrique de l'Ouest. Et il ne dit pas
    // qu'on peut simplement ne pas avoir de compte : le 23 août 2026, quelqu'un
    // au Bénin a fait trois allers-retours entre la connexion et la
    // récupération de mot de passe avant d'abandonner en soixante-sept
    // secondes, sans jamais entrer.
    const m = messageAuth(error.message)
    return { error: m.texte, lien: m.lien }
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
