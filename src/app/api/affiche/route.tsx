import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireUser } from '@/lib/subscription';
import { afficheAutorisee, donneesAffiche, verifierConformite } from '@/lib/affiche-du-jour';
import AfficheVisuel, { textesDeLAffiche } from '@/components/affiche/AfficheVisuel';

/**
 * L'AFFICHE DU JOUR, EN IMAGE.
 *
 * Rend un PNG prêt à partager sur un statut WhatsApp : 1080 × 1920 par défaut,
 * 1080 × 1080 avec `?format=carre`. `?jour=AAAA-MM-JJ` pour un autre jour.
 *
 * ── CE QU'ELLE MONTRE, ET CE QU'ELLE NE MONTRERA JAMAIS ──────────────────
 *
 * L'activité d'analyse, uniquement : combien de matchs la personne a analysés
 * aujourd'hui, lesquels (les affiches, sans rien d'autre), sa série de jours,
 * son club de cœur, son total du mois. Jamais un score, un pronostic, un
 * résultat, un gain ni un taux.
 *
 * Deux verrous, pas un :
 *   1. la lecture en base ne demande QUE les colonnes autorisées — le score et
 *      les probabilités ne sortent pas de la base ;
 *   2. `verifierConformite` relit tous les textes composés et refuse de
 *      produire l'image si un mot interdit s'y trouve.
 *
 * ── ACCÈS ────────────────────────────────────────────────────────────────
 *
 * Essai privé : hors des adresses autorisées, cette route répond 404 — pas
 * 403. Une fonctionnalité en essai ne doit pas même se laisser deviner.
 */

// La composition lit la base et va chercher les écussons : environnement Node.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(requete: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  if (!afficheAutorisee(guard.user.email, guard.entitlements.premium))
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });

  const url = new URL(requete.url);
  const carre = url.searchParams.get('format') === 'carre';
  const jour = (url.searchParams.get('jour') ?? new Date().toISOString().slice(0, 10)).slice(0, 10);

  const sb = await createClient();
  const d = await donneesAffiche(sb as any, guard.user as any, jour);

  // ── LE SECOND VERROU ────────────────────────────────────────────────────
  //
  // Les noms de clubs sont écartés du contrôle : « Paris Saint-Germain » n'est
  // pas une infraction, et une affiche ne doit pas échouer pour le nom d'une
  // équipe que l'abonné a choisi d'analyser.
  const nomsDeClubs = [
    ...d.matchs.flatMap((m) => [m.domicile, m.exterieur]),
    ...(d.equipePreferee ? [d.equipePreferee.nom] : []),
  ];
  verifierConformite([...textesDeLAffiche(d), ...nomsDeClubs], nomsDeClubs);

  // ── LE LOGO, EN VRAI PNG ────────────────────────────────────────────────
  //
  // `public/logo.png` porte l'extension PNG mais contient un JPEG — constaté le
  // 12 septembre 2026, ses premiers octets sont « ff d8 ff ». Le moteur d'image
  // ne le décode pas et le dessine VIDE, sans la moindre erreur : le logo avait
  // simplement disparu de l'affiche.
  //
  // `public/logo-affiche.png` est la même image, ré-encodée proprement en
  // 256 × 256. L'originale n'a pas bougé : elle sert ailleurs et fonctionne.
  const logo = `${url.origin}/logo-affiche.png`;

  const largeur = 1080;
  const hauteur = carre ? 1080 : 1920;
  return new ImageResponse(<AfficheVisuel d={d} logo={logo} largeur={largeur} hauteur={hauteur} />, {
    width: largeur,
    height: hauteur,
    // Une affiche est un instantané du jour : elle ne doit pas être resservie
    // demain, ni mise en cache par un intermédiaire partagé.
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
