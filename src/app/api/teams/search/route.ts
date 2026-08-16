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

    // Le plus proche de ce qui a été tapé en premier : sur « Bruges », le Club
    // Brugge doit passer avant le Cercle Brugge.
    const cible = normaliser(q);
    const teams = [...parId.values()]
      .sort((a, b) => {
        const na = normaliser(a.name);
        const nb = normaliser(b.name);
        const score = (n: string) => (n === cible ? 0 : n.startsWith(cible) ? 1 : 2);
        return score(na) - score(nb) || na.length - nb.length;
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
