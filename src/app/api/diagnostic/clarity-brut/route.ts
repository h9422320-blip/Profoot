/**
 * CE QUE CLARITY RÉPOND, MOT POUR MOT.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ───────────────────────────────────────────
 *
 * La page « Comportement » affichait « 59 991,46 sessions » et « 11689.02 Côte
 * d'Ivoire ». Un nombre de sessions n'a pas de virgule : la lecture attrapait
 * le mauvais champ. Et le tableau des pages — celui qui montre où les gens
 * entrent, restent et repartent — revenait vide.
 *
 * La cause tient à un choix fait sans preuve : le format de la réponse avait
 * été deviné d'après la documentation, jamais observé. Les noms de champs
 * réels de Clarity ne sont donc pas ceux qu'on cherchait.
 *
 * Cette route rend la réponse BRUTE, sans interprétation. C'est le seul moyen
 * de corriger la lecture sur pièce plutôt que d'essayer un nom après l'autre —
 * chaque essai coûtant un appel sur les dix autorisés par jour.
 *
 * ── CE QU'ELLE NE DIVULGUE PAS ────────────────────────────────────────────
 *
 * Le jeton n'apparaît nulle part dans la réponse. Les données rendues sont des
 * totaux de fréquentation — aucune donnée d'abonné, aucune adresse.
 *
 * Réservée à l'administration, comme le reste : une route ne traverse pas le
 * gabarit et n'hérite d'aucune de ses protections.
 */

import { createClient as createServerClient } from '@/utils/supabase/server';
import { estAdmin } from '@/lib/admins';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ENDPOINT = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!estAdmin(user?.email)) {
    return Response.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }

  if (!process.env.CLARITY_API_TOKEN) {
    return Response.json({ erreur: 'CLARITY_API_TOKEN absent du serveur.' }, { status: 400 });
  }

  // La dimension est choisie par l'appelant : `?dimension=Page` pour voir ce
  // que Clarity sait des pages, vide pour le total tous supports confondus.
  const params = new URL(req.url).searchParams;
  const dimension = params.get('dimension') ?? 'Page';
  const jours = Math.min(3, Math.max(1, Number(params.get('jours')) || 1));

  const url = new URL(ENDPOINT);
  url.searchParams.set('numOfDays', String(jours));
  if (dimension) url.searchParams.set('dimension1', dimension);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.CLARITY_API_TOKEN}` },
      cache: 'no-store',
    });

    const texte = await res.text();

    if (!res.ok) {
      return Response.json(
        { statut: res.status, dimension, jours, reponse: texte.slice(0, 2000) },
        { status: 200 }
      );
    }

    let json: any;
    try { json = JSON.parse(texte); } catch { json = null; }

    // Un résumé lisible d'abord : c'est lui qui sert à corriger la lecture.
    // Le corps complet suit, pour ne rien perdre.
    const resume = Array.isArray(json)
      ? json.map((bloc: any) => ({
          metrique: bloc?.metricName ?? bloc?.metric ?? bloc?.name ?? '(sans nom)',
          nombreDeLignes: Array.isArray(bloc?.information) ? bloc.information.length : 0,
          champsDisponibles: bloc?.information?.[0] ? Object.keys(bloc.information[0]) : [],
          premiereLigne: bloc?.information?.[0] ?? null,
        }))
      : null;

    return Response.json({ statut: res.status, dimension, jours, resume, brut: json ?? texte.slice(0, 4000) });
  } catch (e: any) {
    return Response.json({ erreur: String(e?.message ?? e) }, { status: 200 });
  }
}
