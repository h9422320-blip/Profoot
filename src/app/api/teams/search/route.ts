import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/subscription';
import { chercherEquipes, getLiveTeams, normaliser, type LiveTeam } from '@/lib/teams-live';
import { termesDeRecherche } from '@/lib/noms-clubs-fr';

export const maxDuration = 30;

/**
 * Recherche d'un club, où qu'il joue.
 *
 * Le sélecteur cherche d'abord dans les championnats déjà chargés — instantané,
 * aucun appel réseau. Cette route n'entre en jeu que lorsque cette recherche
 * locale ne donne rien : c'est le cas du FC Bâle, de l'Étoile Rouge ou de
 * n'importe quel club hors des championnats préchargés.
 *
 * Elle traduit aussi le français : « Bâle » ne renvoie rien chez le fournisseur,
 * « Basel » renvoie le club. Sans cette traduction, un francophone conclut que
 * son match n'existe pas.
 */
export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 3) return NextResponse.json({ teams: [] });

  try {
    const termes = termesDeRecherche(q);

    // Les championnats déjà en mémoire d'abord : gratuit, et il faut que
    // « Bruges » propose le Club Brugge sans aller chercher plus loin.
    const locales = (await getLiveTeams()).filter((t) => {
      const nom = normaliser(t.name);
      return termes.some((terme) => nom.includes(normaliser(terme)));
    });

    const distantes = (await Promise.all(termes.map((t) => chercherEquipes(t)))).flat();

    // Dédoublonnage par identifiant du fournisseur : un même club peut remonter
    // par plusieurs termes à la fois. Les équipes des championnats connus
    // passent devant — elles portent leur pays et leur championnat.
    const parId = new Map<number, LiveTeam>();
    for (const t of [...locales, ...distantes]) {
      if (!parId.has(t.apiId)) parId.set(t.apiId, t);
    }

    // Classement des résultats.
    //
    // Sur « Bâle », la recherche brute remontait Balerna, Balestier Khalsa et
    // Baleine Shimonoseki AVANT le FC Bâle — le club cherché arrivait sixième,
    // sous la ligne de flottaison d'un écran de téléphone. Trouvable mais
    // introuvé revient au même pour l'utilisateur.
    //
    // Deux critères, dans cet ordre :
    //  1. le club joue-t-il dans un championnat que nous suivons ? Une
    //     première division européenne passe avant un club inconnu d'Asie ;
    //  2. son nom colle-t-il à ce qui a été tapé, ou à sa traduction ?
    const cible = normaliser(q);
    const traductions = termes.slice(1).map(normaliser); // hors saisie d'origine

    const pertinence = (t: LiveTeam) => {
      const n = normaliser(t.name);
      if (n === cible) return 0;
      // Correspond à la traduction : « Bâle » → « Basel ». C'est le résultat
      // que la personne cherchait, il passe devant tout le reste.
      if (traductions.some((tr) => n.includes(tr))) return 1;
      if (n.startsWith(cible)) return 2;
      return 3;
    };

    const teams = [...parId.values()]
      .sort((a, b) => {
        // Un championnat renseigné signifie « issu de nos premières divisions ».
        const suivi = (t: LiveTeam) => (t.league ? 0 : 1);
        return (
          suivi(a) - suivi(b) ||
          pertinence(a) - pertinence(b) ||
          a.name.length - b.name.length
        );
      })
      .slice(0, 25);

    return NextResponse.json(
      { teams, count: teams.length },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    );
  } catch (error) {
    console.error('[TEAMS] Recherche impossible:', error);
    return NextResponse.json({ teams: [] }, { status: 200 });
  }
}
