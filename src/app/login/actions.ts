'use server'

import { verifierAdresse } from '@/lib/adresse-email'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { messageAuth } from '@/lib/messages-auth'
import {
  effacerTentatives,
  lireTentatives,
  messageAttente,
  noterTentative,
} from '@/lib/limite-partagee'
import { headers } from 'next/headers'
import { after } from 'next/server'
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

  // ── ON NE PEUT PLUS ESSAYER MILLE MOTS DE PASSE ─────────────────────────
  //
  // Rien ne limitait les tentatives côté application. Or l'adresse du compte
  // administrateur était, jusqu'à ce matin, lisible publiquement dans
  // `app_settings` : un attaquant savait donc exactement qui viser, et pouvait
  // essayer autant de mots de passe qu'il voulait.
  //
  // LA LIMITE PORTE SUR L'ADRESSE, PAS SUR L'ADRESSE IP.
  //
  // Une IP se change en une seconde — réseau mobile, réseau partagé, service
  // de relais. L'adresse e-mail visée, elle, ne change pas : c'est justement
  // ce que l'attaquant veut forcer. C'est donc elle qu'on compte.
  //
  // HUIT ESSAIS PAR QUART D'HEURE, ET LE COMPTEUR S'EFFACE À LA RÉUSSITE.
  //
  // Assez pour quelqu'un qui hésite entre deux de ses mots de passe habituels,
  // beaucoup trop peu pour un automate. Et celui qui finit par entrer ne reste
  // pas puni pour ses fautes de frappe : sans cet effacement, trois erreurs le
  // matin et cinq le soir bloqueraient un client légitime.
  const ESSAIS_MAX = 8
  const FENETRE_MS = 15 * 60 * 1000

  //
  // ── ET RIEN N'ATTEND QUI NE DÉCIDE PAS ────────────────────────────────
  //
  // Le comptage lisait PUIS écrivait avant même d'essayer le mot de passe.
  // Mesuré le 15 septembre 2026, trois passages depuis l'Europe : lecture 165
  // à 640 ms, écriture 164 à 999 ms, mot de passe 240 à 400 ms, effacement du
  // compteur 146 à 919 ms, relevé du pays 158 à 188 ms — 1,3 à 2,3 seconde
  // avant la redirection, dont une seule étape décidait vraiment de quelque
  // chose. Depuis l'Afrique de l'Ouest, où vivent presque tous les abonnés,
  // chaque aller-retour coûte davantage.
  //
  // Le propriétaire l'a vécu le 15 septembre : « je clique, ça met beaucoup de
  // temps avant que ça n'affiche l'application ».
  //
  // Ce qui protège, c'est la LECTURE, qui décide. Elle reste ici, devant. La
  // note, elle, n'est posée que sur un ÉCHEC — et une réussite n'a jamais eu
  // besoin d'être notée, puisqu'elle effaçait le compteur juste après : noter
  // puis effacer, c'était deux attentes pour un résultat nul.
  const verdict = await lireTentatives('connexion', email, ESSAIS_MAX, FENETRE_MS)
  if (verdict.bloque) {
    console.warn(`[CONNEXION] Trop de tentatives sur ${email.slice(0, 3)}…`)
    return {
      error:
        'Trop de tentatives de connexion sur cette adresse. ' +
        messageAttente(verdict.attendreSecondes),
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // L'ÉCHEC, LUI, EST COMPTÉ AVANT DE RÉPONDRE. C'est lui que la défense
    // vise, et personne n'attend d'entrer : le retard tombe sur celui qui se
    // trompe, jamais sur celui qui a raison.
    await noterTentative('connexion', email, FENETRE_MS)

    // ── JAMAIS LE MESSAGE BRUT DE SUPABASE ────────────────────────────────
    //
    // Il est en anglais — « Invalid login credentials » — sur une application
    // entièrement en français destinée à l'Afrique de l'Ouest. Et il ne dit pas
    // qu'on peut simplement ne pas avoir de compte : le 23 août 2026, quelqu'un
    // au Bénin a fait trois allers-retours entre la connexion et la
    // récupération de mot de passe avant d'abandonner en soixante-sept
    // secondes, sans jamais entrer.
    const m = messageAuth(error.message)
    return { error: m.texte, liens: m.liens }
  }

  // ── LE RESTE SE FAIT PENDANT QU'IL REGARDE DÉJÀ SON ÉCRAN ──────────────
  //
  // Deux tâches, aucune ne décide de rien : effacer le compteur — quelqu'un qui
  // finit par entrer ne doit pas rester puni pour ses fautes de frappe — et
  // relever le pays et l'appareil. `after` les exécute APRÈS la réponse, et la
  // documentation de Next est explicite : elles tournent même quand `redirect`
  // a été appelé. Si l'une échoue, le compteur expire de lui-même et ce compte
  // reste sans origine — exactement ce que le code disait déjà accepter.
  after(async () => {
    await effacerTentatives('connexion', email)
    await releverOrigine(supabase)
  })

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
    // ── L'OFFRE REVIENT AVEC LUI ────────────────────────────────────────
    //
    // Quelqu'un qui cliquait « Choisir l'Essentiel » sans compte était envoyé
    // ici, puis renvoyé sur la page des tarifs NUE : il devait re-choisir son
    // offre, c'est-à-dire reprendre la même décision une seconde fois, au
    // moment précis où il sortait son argent.
    //
    // L'offre voyage dans son propre champ, et non dans `suite` : celui-ci
    // n'accepte qu'un chemin sans point d'interrogation, et c'est exactement
    // cette contrainte qui empêche un lien truqué d'expédier quelqu'un vers
    // un site tiers juste après son mot de passe. Elle est revalidée ici,
    // comme `t1` et `t2`, avant d'être recollée à l'adresse.
    const offre = propre(formData.get('offre'))
    if (offre && suite === '/pricing') {
      return `/pricing?offre=${encodeURIComponent(offre)}`
    }
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

  // ── L'ADRESSE EST LA SEULE CLÉ DU COMPTE ────────────────────────────────
  //
  // Le 29 août 2026, quinze personnes payantes se retrouvaient devant le mur
  // de paiement : leur abonnement était actif, sur une adresse voisine d'une
  // lettre. Quarante adresses impossibles avaient été acceptées — « @gamil »,
  // « @gmail » sans extension, « jay@381 ».
  //
  // La confirmation d'e-mail est désactivée sur ce projet : rien ne rattrape
  // la faute de frappe, et elle ne se voit qu'un mois plus tard, quand le
  // client écrit qu'on lui a pris son argent.
  //
  // Le contrôle est ici, dans l'action serveur, et non seulement dans le
  // formulaire : c'est le seul endroit que personne ne peut contourner.
  const verdict = verifierAdresse(email)
  if (!verdict.ok) {
    return { error: verdict.message ?? 'Cette adresse e-mail est invalide.' }
  }

  const supabase = await createClient()

  // Le pays et l'appareil sont posés DÈS la création, dans le même appel : un
  // compte créé puis abandonné garde ainsi sa trace, alors qu'un relevé fait
  // seulement à la connexion suivante ne dirait jamais rien de celui qui ne
  // revient pas — précisément celui qu'on cherche à comprendre.
  const origine = lireOrigine(await headers())

  const { data: cree, error } = await supabase.auth.signUp({
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
    return { error: m.texte, liens: m.liens }
  }

  // ── SON ACCÈS DÉJÀ PAYÉ S'OUVRE ICI, PAS DEMAIN MATIN ──────────────────
  //
  // On ne crée jamais de compte à la place de quelqu'un : c'est la règle. Mais
  // la vitrine de la boutique est publique, et des gens y paient sans passer
  // par le site. Leur vente attend alors qu'ils s'inscrivent — c'est
  // maintenant.
  //
  // Un filet quotidien faisait déjà ce travail, mais deux fois par jour
  // seulement : quelqu'un qui s'inscrivait à 14 h voyait un mur de paiement
  // jusqu'au lendemain matin, pour un accès déjà payé. C'est ce que Diarra a
  // vécu les 28 et 29 août.
  //
  // Ne lève jamais : l'inscription a réussi, elle ne doit pas échouer à cause
  // d'un rattachement. Ce qui serait manqué ici, l'entretien le reprendra.
  //
  // ── ET IL N'ATTEND PAS DEVANT UN ÉCRAN PENDANT CE TEMPS ───────────────
  //
  // Ce rattachement interroge la base et peut y écrire : un aller-retour de
  // plus entre le clic et l'entrée dans l'application, sur un parcours où
  // chaque seconde se paie. Il passe donc APRÈS la réponse.
  //
  // Rien n'est perdu à le différer : `after` s'exécute même quand `redirect` a
  // été appelé, et le commentaire ci-dessus le disait déjà — ce qui serait
  // manqué ici, l'entretien le reprend. La seule différence est que l'abonné
  // voit son application tout de suite.
  if (cree?.user?.id) {
    const idCree = cree.user.id
    after(async () => {
      const { ouvrirAccesAlInscription } = await import('@/lib/acces-a-l-inscription')
      const r = await ouvrirAccesAlInscription(idCree, email)
      if (r.ouverts) {
        console.log(`[INSCRIPTION] ${email} : ${r.ouverts} accès rattaché(s) — ${r.details.join(' ; ')}`)
      }
    })
  }

  revalidatePath('/', 'layout')
  // La même règle qu'à la connexion : quelqu'un envoyé ici depuis une offre y
  // retourne, plutôt que d'atterrir sur l'analyse et de devoir recommencer son
  // achat. `destinationApres` n'accepte qu'un chemin interne.
  redirect(destinationApres(formData))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}
