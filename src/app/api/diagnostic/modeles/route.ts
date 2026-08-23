import { NextResponse } from 'next/server';
import { appelerOpenRouter, MODELES_OPENROUTER } from '@/lib/openrouter';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { estAdmin } from '@/lib/admins';

/**
 * CHAQUE MODÈLE SAIT-IL VRAIMENT RENDRE UNE ANALYSE EXPLOITABLE ?
 *
 * POURQUOI CETTE ROUTE EXISTE
 *
 * Choisir un modèle sur son prix ne suffit pas : un modèle deux cents fois
 * moins cher qui rend du texte au lieu du JSON attendu ne coûte rien et ne
 * sert à rien. Le prix ne se juge qu'une fois la sortie vérifiée.
 *
 * On envoie donc à chaque candidat une vraie demande d'analyse, sur de vraies
 * rencontres, et on contrôle ce qui revient : est-ce du JSON lisible, les
 * champs obligatoires sont-ils là, les probabilités totalisent-elles cent, le
 * score annoncé s'accorde-t-il avec l'issue la plus probable.
 *
 * C'EST UNE MESURE, PAS UNE OPINION
 *
 * Le verdict ne dépend d'aucun jugement sur la qualité de la plume : il porte
 * sur des propriétés vérifiables mécaniquement. Un modèle qui les respecte
 * passe la validation de l'application et atteindra l'abonné ; un modèle qui
 * les rate est écarté par la cascade avant d'être servi.
 *
 * Lecture seule, aucun effet de bord. Le coût est de quelques centimes.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Trois affiches réelles, de trois niveaux différents. */
const MATCHS = [
  { d: 'FC Barcelone', e: 'Real Madrid', c: 'La Liga' },
  { d: 'Deportivo La Corogne', e: 'Elche', c: 'LaLiga 2' },
  { d: 'Newcastle United', e: 'Bournemouth', c: 'Premier League' },
];

const CONSIGNE =
  "Tu es un analyste football. Réponds UNIQUEMENT par un objet JSON valide, " +
  "sans texte avant ni après, sans balises de code.";

const demande = (m: (typeof MATCHS)[number]) =>
  `Analyse ${m.d} (domicile) contre ${m.e} (extérieur) en ${m.c}.\n` +
  `Réponds exactement ce JSON :\n` +
  `{"score":{"domicile":<entier>,"exterieur":<entier>},` +
  `"probabilites":{"domicile":<entier>,"nul":<entier>,"exterieur":<entier>},` +
  `"confiance":<entier 70-95>,` +
  `"resume":"<deux phrases en français>"}\n` +
  `Les trois probabilités doivent totaliser exactement 100.`;

/** Extrait le JSON, même si le modèle l'a enrobé de texte ou de balises. */
function lireJson(brut: string): any | null {
  const nettoye = String(brut ?? '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(nettoye);
  } catch {
    const debut = nettoye.indexOf('{');
    const fin = nettoye.lastIndexOf('}');
    if (debut < 0 || fin <= debut) return null;
    try {
      return JSON.parse(nettoye.slice(debut, fin + 1));
    } catch {
      return null;
    }
  }
}

/** Les contrôles que l'application applique déjà à toute analyse. */
function verifier(j: any): { ok: boolean; defauts: string[] } {
  const defauts: string[] = [];
  const ent = (v: any) => Number.isInteger(Number(v));

  if (!j) return { ok: false, defauts: ['JSON illisible'] };
  if (!ent(j?.score?.domicile) || !ent(j?.score?.exterieur)) defauts.push('score absent ou non entier');

  const p = j?.probabilites ?? {};
  if (!ent(p.domicile) || !ent(p.nul) || !ent(p.exterieur)) defauts.push('probabilités absentes');
  else {
    const somme = Number(p.domicile) + Number(p.nul) + Number(p.exterieur);
    if (Math.abs(somme - 100) > 1) defauts.push(`probabilités = ${somme}, pas 100`);
  }

  const c = Number(j?.confiance);
  if (!Number.isFinite(c) || c < 70 || c > 95) defauts.push(`confiance ${j?.confiance} hors 70-95`);

  if (typeof j?.resume !== 'string' || j.resume.trim().length < 20) defauts.push('résumé absent ou trop court');

  // La cohérence interne : le score annoncé doit désigner la même issue que
  // la probabilité la plus haute. C'est ce contrôle qui empêche une carte de
  // se contredire elle-même sous les yeux d'un abonné.
  if (ent(j?.score?.domicile) && ent(j?.score?.exterieur) && ent(p.domicile)) {
    const d = Number(j.score.domicile), e = Number(j.score.exterieur);
    const issueScore = d > e ? 'domicile' : d === e ? 'nul' : 'exterieur';
    const maxi = Math.max(Number(p.domicile), Number(p.nul), Number(p.exterieur));
    const issueProba =
      Number(p.domicile) === maxi ? 'domicile' : Number(p.nul) === maxi ? 'nul' : 'exterieur';
    if (issueScore !== issueProba)
      defauts.push(`score ${d}-${e} (${issueScore}) contredit les probabilités (${issueProba})`);
  }

  return { ok: defauts.length === 0, defauts };
}

export async function GET(req: Request) {
  // ── RÉSERVÉE À L'ADMINISTRATION, ET CE N'EST PAS DU CONFORT ──────────────
  //
  // Cette route lance de VRAIS appels payants : trois analyses par requête,
  // et le paramètre `?i=` laisse choisir le modèle — donc le plus cher de la
  // liste. Elle était ouverte à tout Internet.
  //
  // Une boucle depuis n'importe quel ordinateur vidait le solde OpenRouter en
  // quelques heures. Et un solde vide n'est pas une gêne : c'est l'arrêt de
  // toutes les analyses, pour tous les abonnés, jusqu'au rechargement. Le
  // 19 août 2026, trois heures de crédit épuisé ont coûté cent cinquante
  // analyses perdues.
  //
  // Le contrôle est le même que pour les autres routes de diagnostic, et il
  // est répété ici : une route ne traverse pas le gabarit de l'administration
  // et n'hérite d'aucune de ses protections.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    return NextResponse.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }

  if (!process.env.OPENROUTER_API_KEY)
    return NextResponse.json({ erreur: 'OPENROUTER_API_KEY absente' }, { status: 500 });

  // ── UN MODÈLE À LA FOIS, PAR DÉFAUT ──────────────────────────────────────
  //
  // Cinq modèles fois trois matchs dépassent les soixante secondes accordées
  // par la plateforme : la route rendait 504 sans jamais livrer un résultat.
  // On teste donc un seul candidat par appel — `?i=0` pour le moins cher,
  // `?i=1` pour le suivant — et l'appelant enchaîne.
  const url = new URL(req.url);
  const indice = url.searchParams.get('i');
  const aTester =
    indice !== null && MODELES_OPENROUTER[Number(indice)]
      ? [MODELES_OPENROUTER[Number(indice)]]
      : [MODELES_OPENROUTER[0]];

  const resultats: any[] = [];

  for (const modele of aTester) {
    const essais: any[] = [];

    for (const m of MATCHS) {
      const debut = Date.now();
      const controleur = new AbortController();
      const minuterie = setTimeout(() => controleur.abort(), 15_000);
      try {
        const brut = await appelerOpenRouter(modele, demande(m), controleur.signal, CONSIGNE);
        clearTimeout(minuterie);
        const j = lireJson(brut);
        const { ok, defauts } = verifier(j);
        essais.push({
          match: `${m.d} - ${m.e}`,
          ok,
          ms: Date.now() - debut,
          ...(ok
            ? {
                score: `${j.score.domicile}-${j.score.exterieur}`,
                probabilites: `${j.probabilites.domicile}/${j.probabilites.nul}/${j.probabilites.exterieur}`,
                confiance: j.confiance,
              }
            : { defauts, extrait: String(brut ?? '').slice(0, 160) }),
        });
      } catch (e: any) {
        clearTimeout(minuterie);
        essais.push({ match: `${m.d} - ${m.e}`, ok: false, ms: Date.now() - debut, erreur: e?.message?.slice(0, 160) });
      }
    }

    const reussis = essais.filter((e) => e.ok).length;
    resultats.push({
      modele,
      verdict: reussis === MATCHS.length ? 'RETENU' : reussis > 0 ? 'IRRÉGULIER' : 'ÉCARTÉ',
      reussis: `${reussis}/${MATCHS.length}`,
      msMoyen: Math.round(essais.reduce((t, e) => t + e.ms, 0) / essais.length),
      essais,
    });
  }

  return NextResponse.json(
    {
      ordreActuel: MODELES_OPENROUTER,
      testeIci: aTester,
      suivant:
        indice !== null && MODELES_OPENROUTER[Number(indice) + 1]
          ? `?i=${Number(indice) + 1}`
          : null,
      resultats,
      quand: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
