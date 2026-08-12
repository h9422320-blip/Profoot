/**
 * Échecs du moteur d'analyse : enregistrement et bilan.
 *
 * L'abonné ne doit jamais voir passer un échec. Il reçoit une analyse complète,
 * calculée à partir des données réelles du match — pas un message d'erreur, pas
 * une mention « analyse incomplète ». De son côté, rien ne change.
 *
 * Mais un échec silencieux est un échec qu'on ne corrige jamais. Près d'une
 * analyse sur cinq servait un texte de secours écrit en dur sans que personne
 * ne le sache. Tout ce qui échoue atterrit donc ici, et cette table n'est lue
 * que par l'administration.
 */

import { createAdminClient } from './supabase-admin';

/** Familles d'échec, pour regrouper des centaines de messages en quelques causes. */
export type CauseEchec = 'delai_depasse' | 'quota_epuise' | 'reponse_illisible' | 'cle_absente' | 'autre';

/**
 * Range un message d'erreur brut dans une famille.
 *
 * Sans ce classement, l'administration affiche une liste de messages tous
 * différents où rien ne ressort. Avec, une cause qui revient saute aux yeux.
 */
export function classerEchec(message: string): CauseEchec {
  const m = message.toLowerCase();
  if (m.includes('abort') || m.includes('timeout') || m.includes('délai') || m.includes('deadline'))
    return 'delai_depasse';
  if (m.includes('429') || m.includes('resource_exhausted') || m.includes('quota')) return 'quota_epuise';
  if (m.includes('json') || m.includes('unexpected token') || m.includes('parse')) return 'reponse_illisible';
  if (m.includes('api key') || m.includes('api_key') || m.includes('unauthorized') || m.includes('401'))
    return 'cle_absente';
  return 'autre';
}

const LIBELLES: Record<CauseEchec, string> = {
  delai_depasse: "Le modèle a mis trop de temps à répondre",
  quota_epuise: 'Quota du modèle épuisé',
  reponse_illisible: 'Réponse du modèle illisible',
  cle_absente: "Clé d'accès refusée",
  autre: 'Autre erreur',
};

export const libelleCause = (c: string) => LIBELLES[c as CauseEchec] ?? c;

/**
 * Enregistre un échec. Ne doit JAMAIS empêcher l'analyse de partir : l'abonné
 * attend sa réponse, et notre besoin de journalisation ne le concerne pas.
 */
export async function enregistrerEchecAnalyse(donnees: {
  userId: string | null;
  equipe1: string | null;
  equipe2: string | null;
  competition: string | null;
  message: string;
  modele: string | null;
  dureeMs: number;
  serviQuandMeme: boolean;
}): Promise<void> {
  try {
    const { error } = await createAdminClient().from('analysis_failures').insert({
      user_id: donnees.userId,
      equipe1: donnees.equipe1,
      equipe2: donnees.equipe2,
      competition: donnees.competition,
      cause: classerEchec(donnees.message),
      message: donnees.message.slice(0, 2000),
      modele: donnees.modele,
      duree_ms: donnees.dureeMs,
      servi_quand_meme: donnees.serviQuandMeme,
    });
    if (error) console.warn('[ANALYSE] Échec non journalisé :', error.message);
  } catch (erreur: any) {
    console.warn('[ANALYSE] Journalisation impossible :', erreur?.message);
  }
}

export interface EchecAnalyse {
  id: string;
  email: string | null;
  userId: string | null;
  equipe1: string | null;
  equipe2: string | null;
  competition: string | null;
  cause: string;
  causeLibelle: string;
  message: string | null;
  modele: string | null;
  dureeMs: number | null;
  serviQuandMeme: boolean;
  creeLe: string;
}

export interface BilanEchecs {
  total: number;
  /** Échecs des vingt-quatre dernières heures. */
  recents: number;
  /** Part des analyses ayant échoué, en pourcentage. Null si aucune analyse. */
  tauxEchec: number | null;
  /** Nombre d'analyses réussies sur la même période, pour donner l'échelle. */
  analysesTotales: number;
  causes: { cause: string; libelle: string; nombre: number; part: number }[];
  /** Échecs où l'abonné n'a rien reçu du tout. Doit rester à zéro. */
  sansReponse: number;
  derniers: EchecAnalyse[];
}

export async function getBilanEchecs(limite = 200): Promise<BilanEchecs> {
  const sb = createAdminClient();
  const vide: BilanEchecs = {
    total: 0, recents: 0, tauxEchec: null, analysesTotales: 0,
    causes: [], sansReponse: 0, derniers: [],
  };

  const [echecsRes, analysesRes] = await Promise.all([
    sb.from('analysis_failures').select('*').order('created_at', { ascending: false }).limit(limite),
    sb.from('analysis_history').select('id', { count: 'exact', head: true }),
  ]);

  if (echecsRes.error) {
    // La table n'existe pas encore : la migration n'a pas été appliquée.
    console.warn('[ANALYSE] Bilan des échecs indisponible :', echecsRes.error.message);
    return vide;
  }

  const lignes = echecsRes.data ?? [];
  const analysesTotales = analysesRes.count ?? 0;
  if (!lignes.length) return { ...vide, analysesTotales };

  const emails = new Map<string, string>();
  try {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
  } catch {
    // Sans les adresses, le bilan reste exploitable.
  }

  const parCause = new Map<string, number>();
  for (const l of lignes) parCause.set(l.cause, (parCause.get(l.cause) ?? 0) + 1);

  const vingtQuatreHeures = Date.now() - 24 * 3600 * 1000;

  return {
    total: lignes.length,
    recents: lignes.filter((l) => new Date(l.created_at).getTime() >= vingtQuatreHeures).length,
    // Le taux rapporte les échecs au nombre d'analyses effectivement produites :
    // dix échecs sur mille analyses et dix sur trente ne disent pas la même chose.
    tauxEchec:
      analysesTotales > 0
        ? Math.round((lignes.length / (analysesTotales + lignes.length)) * 1000) / 10
        : null,
    analysesTotales,
    causes: [...parCause.entries()]
      .map(([cause, nombre]) => ({
        cause,
        libelle: libelleCause(cause),
        nombre,
        part: Math.round((nombre / lignes.length) * 1000) / 10,
      }))
      .sort((a, b) => b.nombre - a.nombre),
    sansReponse: lignes.filter((l) => !l.servi_quand_meme).length,
    derniers: lignes.slice(0, 60).map((l) => ({
      id: l.id,
      userId: l.user_id ?? null,
      email: l.user_id ? emails.get(l.user_id) ?? null : null,
      equipe1: l.equipe1,
      equipe2: l.equipe2,
      competition: l.competition,
      cause: l.cause,
      causeLibelle: libelleCause(l.cause),
      message: l.message,
      modele: l.modele,
      dureeMs: l.duree_ms,
      serviQuandMeme: l.servi_quand_meme,
      creeLe: l.created_at,
    })),
  };
}
