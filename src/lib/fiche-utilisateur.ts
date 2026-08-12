/**
 * Fiche complète d'un compte : qui il est, ce qu'il a payé, ce qu'il a analysé.
 *
 * La liste des utilisateurs répondait « combien d'analyses », jamais
 * « lesquelles ». Or c'est là que se trouve la seule information réellement
 * utile sur un inscrit : ce qu'il est venu chercher. Un compte qui a lancé
 * trois analyses sur des matchs ivoiriens et un compte qui en a lancé trois sur
 * la Ligue des champions ne racontent pas la même chose, et le total les
 * confond.
 *
 * Tout est lu ici pour UN seul compte, sans la limite de lecture globale du
 * tableau de bord : sur une fiche, une analyse manquante est une analyse qu'on
 * croit inexistante.
 */

import { createAdminClient } from './supabase-admin';
import { PLANS, PlanTier, normalizePlan, niveauOffert } from './subscription';
import { nomDuPays, drapeau } from './origine-acheteurs';

export interface AnalyseUtilisateur {
  id: string;
  equipe1: string;
  equipe2: string;
  competition: string | null;
  scorePredit: string | null;
  confiance: number | null;
  resume: string | null;
  /** Score réel, renseigné après le match. Null tant qu'il n'est pas joué. */
  scoreReel: string | null;
  /** Null tant que le match n'a pas été vérifié ; sinon vrai si l'issue prédite était la bonne. */
  vainqueurCorrect: boolean | null;
  scoreExactCorrect: boolean | null;
  verifieeLe: string | null;
  creeeLe: string;
}

export interface PaiementUtilisateur {
  saleId: string;
  offre: string;
  montant: number | null;
  pays: string | null;
  paysNom: string;
  drapeau: string;
  /** Vraie quand la vente a effectivement débouché sur un abonnement. */
  honoree: boolean;
  creeeLe: string;
}

export interface AbonnementUtilisateur {
  id: string;
  offre: string;
  statut: string;
  montant: number | null;
  devise: string | null;
  fournisseur: string | null;
  creeLe: string;
  expireLe: string | null;
}

export interface EchangeAgentUtilisateur {
  id: string;
  question: string;
  recherchesWeb: number;
  creeLe: string;
}

export interface FicheUtilisateur {
  id: string;
  email: string;
  inscritLe: string;
  derniereConnexion: string | null;
  emailConfirme: boolean;

  offre: PlanTier;
  offreLibelle: string;
  estAdmin: boolean;
  estPartenaire: boolean;
  expireLe: string | null;

  totalPaye: number;
  abonnements: AbonnementUtilisateur[];
  paiements: PaiementUtilisateur[];

  analyses: AnalyseUtilisateur[];
  /** Analyses dont le match est joué ET le résultat constaté. */
  analysesVerifiees: number;
  /** Parmi les vérifiées, celles où l'issue prédite était la bonne. */
  analysesReussies: number;
  /** Compétitions les plus analysées par ce compte. */
  competitions: { nom: string; nombre: number }[];

  echangesAgent: EchangeAgentUtilisateur[];

  /** Signale ce qui n'a pas pu être lu, pour ne pas présenter un vide comme un fait. */
  avertissements: string[];
}

const ADMIN_EMAILS = ['h9422320@gmail.com'];

export async function getFicheUtilisateur(userId: string): Promise<FicheUtilisateur | null> {
  const sb = createAdminClient();
  const avertissements: string[] = [];

  const { data: compteData, error: erreurCompte } = await sb.auth.admin.getUserById(userId);
  const compte = compteData?.user;
  if (erreurCompte || !compte) return null;

  const email = compte.email ?? '(sans e-mail)';

  const [abosRes, analysesRes, intentionsRes, echangesRes] = await Promise.all([
    sb
      .from('subscriptions')
      .select('id, plan, status, amount, currency, provider, created_at, expires_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb
      .from('analysis_history')
      // Une seule chaîne, non découpée : Supabase déduit le type des colonnes
      // de ce littéral, et une concaténation le lui rend illisible.
      .select('id, team1_name, team2_name, competition, score, confidence, summary, real_score, winner_correct, score_correct, verified_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb
      .from('payment_intents')
      .select('sale_id, plan, amount, pays, consumed_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb
      .from('vip_conversations')
      .select('id, question, recherches_web, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (abosRes.error) avertissements.push(`Abonnements illisibles : ${abosRes.error.message}`);
  if (analysesRes.error) avertissements.push(`Analyses illisibles : ${analysesRes.error.message}`);
  if (intentionsRes.error) avertissements.push(`Paiements illisibles : ${intentionsRes.error.message}`);
  // Les échanges avec l'agent n'existent que depuis peu : leur absence n'est
  // pas une anomalie et ne mérite pas d'alerte.

  const abos = abosRes.data ?? [];
  const lignes = analysesRes.data ?? [];

  const estAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
  const offert = estAdmin ? null : niveauOffert(email);

  // Meilleur abonnement en cours : c'est lui qui décide de l'offre affichée.
  const maintenant = Date.now();
  const actif = abos.find(
    (a) => a.status === 'active' && (!a.expires_at || new Date(a.expires_at).getTime() > maintenant)
  );
  const cle = actif ? normalizePlan(actif.plan) : null;
  const tier: PlanTier = estAdmin ? 'VIP' : offert ?? (cle ? PLANS[cle].tier : 'FREE');

  const competitions = new Map<string, number>();
  for (const l of lignes) {
    const nom = (l.competition ?? '').trim();
    if (nom) competitions.set(nom, (competitions.get(nom) ?? 0) + 1);
  }

  const verifiees = lignes.filter((l) => l.verified_at);

  return {
    id: userId,
    email,
    inscritLe: compte.created_at,
    derniereConnexion: compte.last_sign_in_at ?? null,
    emailConfirme: !!compte.email_confirmed_at,

    offre: tier,
    offreLibelle: estAdmin
      ? 'Administrateur'
      : offert
        ? `Partenaire (${offert})`
        : cle
          ? PLANS[cle].label
          : 'Gratuit',
    estAdmin,
    estPartenaire: !!offert,
    expireLe: actif?.expires_at ?? null,

    totalPaye: abos.reduce((t, a) => t + (a.amount ?? 0), 0),
    abonnements: abos.map((a) => ({
      id: a.id,
      offre: a.plan,
      statut: a.status,
      montant: a.amount,
      devise: a.currency,
      fournisseur: a.provider,
      creeLe: a.created_at,
      expireLe: a.expires_at,
    })),
    paiements: (intentionsRes.data ?? []).map((p) => ({
      saleId: p.sale_id,
      offre: p.plan,
      montant: p.amount,
      pays: p.pays ?? null,
      paysNom: nomDuPays(p.pays),
      drapeau: drapeau(p.pays),
      honoree: !!p.consumed_at,
      creeeLe: p.created_at,
    })),

    analyses: lignes.map((l) => ({
      id: l.id,
      equipe1: l.team1_name,
      equipe2: l.team2_name,
      competition: l.competition,
      scorePredit: l.score,
      confiance: l.confidence,
      resume: l.summary,
      scoreReel: l.real_score ?? null,
      vainqueurCorrect: l.winner_correct ?? null,
      scoreExactCorrect: l.score_correct ?? null,
      verifieeLe: l.verified_at ?? null,
      creeeLe: l.created_at,
    })),
    analysesVerifiees: verifiees.length,
    analysesReussies: verifiees.filter((l) => l.winner_correct).length,
    competitions: [...competitions.entries()]
      .map(([nom, nombre]) => ({ nom, nombre }))
      .sort((a, b) => b.nombre - a.nombre),

    echangesAgent: (echangesRes.data ?? []).map((e) => ({
      id: e.id,
      question: e.question,
      recherchesWeb: e.recherches_web,
      creeLe: e.created_at,
    })),

    avertissements,
  };
}
