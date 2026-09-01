/**
 * QUI REÇOIT QUOI.
 *
 * ── UN SEUL FICHIER POUR TOUTES LES SÉLECTIONS ────────────────────────────
 *
 * Les cinq campagnes lisent les mêmes trois choses : les comptes, les
 * abonnements, l'historique d'analyses. Les faire lire chacune de son côté
 * multiplierait par cinq le coût du passage quotidien, et surtout laisserait
 * cinq définitions de « personne active » diverger avec le temps.
 *
 * ── LA PAGINATION N'EST PAS UNE PRÉCAUTION, C'EST UNE OBLIGATION ──────────
 *
 * Supabase rend mille lignes et s'arrête sans le dire. Une lecture naïve de
 * `subscriptions` aurait rendu 500 lignes sur 500 — donc juste par accident
 * aujourd'hui, et faux le jour du 1001ᵉ abonnement, sans aucun message
 * d'erreur. Toutes les lectures ici paginent, y compris celles qui « tiennent
 * largement ».
 */

import { createAdminClient } from '../supabase-admin';
import type { Destinataire } from './diffusion';

const JOUR_MS = 24 * 60 * 60 * 1000;

export interface Compte {
  id: string;
  email: string;
  creeLe: string;
  derniereEntree: string | null;
}

export interface Abonnement {
  userId: string;
  plan: string;
  statut: string;
  expireLe: string | null;
  creeLe: string;
}

export interface Analyse {
  userId: string;
  creeLe: string;
  equipe1: string | null;
  equipe2: string | null;
  scorePredit: string | null;
  scoreReel: string | null;
  issueCorrecte: boolean | null;
  scoreCorrect: boolean | null;
  verifieeLe: string | null;
}

export interface Terrain {
  comptes: Compte[];
  parId: Map<string, Compte>;
  abonnements: Abonnement[];
  /** Identifiants ayant un abonnement actif et non expiré. */
  abonnesActifs: Set<string>;
  /** Identifiants ayant payé au moins une fois, même expiré. */
  ontPaye: Set<string>;
  analyses: Analyse[];
  /** Dernière analyse par personne, en millisecondes. */
  derniereAnalyse: Map<string, number>;
  /** Nombre d'analyses par personne. */
  nombreAnalyses: Map<string, number>;
}

async function pagine<T>(
  table: string,
  colonnes: string,
  filtre?: (q: any) => any
): Promise<T[]> {
  const sb = createAdminClient();
  const sortie: T[] = [];
  for (let depart = 0; depart < 500_000; depart += 1000) {
    let q: any = sb.from(table).select(colonnes).range(depart, depart + 999);
    if (filtre) q = filtre(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table} : ${error.message}`);
    sortie.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return sortie;
}

/**
 * Lit une fois tout ce dont les campagnes ont besoin.
 *
 * `depuis` limite la lecture de l'historique : les campagnes du jour n'ont pas
 * besoin de juillet, et lire vingt et un mille lignes pour en utiliser deux
 * cents coûte du temps de fonction serveur à chaque passage.
 */
export async function lireTerrain(depuisJours = 45): Promise<Terrain> {
  const sb = createAdminClient();

  const comptes: Compte[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`comptes : ${error.message}`);
    if (!data?.users?.length) break;
    for (const u of data.users) {
      comptes.push({
        id: u.id,
        email: String(u.email ?? '').toLowerCase(),
        creeLe: u.created_at,
        derniereEntree: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < 1000) break;
  }

  const brutAbos = await pagine<any>(
    'subscriptions',
    'user_id, plan, status, expires_at, created_at'
  );
  const abonnements: Abonnement[] = brutAbos.map((a) => ({
    userId: String(a.user_id),
    plan: String(a.plan ?? ''),
    statut: String(a.status ?? ''),
    expireLe: a.expires_at ?? null,
    creeLe: a.created_at,
  }));

  const maintenant = Date.now();
  const abonnesActifs = new Set(
    abonnements
      .filter(
        (a) =>
          a.statut === 'active' &&
          (!a.expireLe || new Date(a.expireLe).getTime() > maintenant)
      )
      .map((a) => a.userId)
  );
  const ontPaye = new Set(abonnements.map((a) => a.userId));

  const borne = new Date(maintenant - depuisJours * JOUR_MS).toISOString();
  const brutAnalyses = await pagine<any>(
    'analysis_history',
    'user_id, created_at, team1_name, team2_name, score, real_score, winner_correct, score_correct, verified_at',
    (q) => q.gte('created_at', borne)
  );
  const analyses: Analyse[] = brutAnalyses.map((a) => ({
    userId: String(a.user_id),
    creeLe: a.created_at,
    equipe1: a.team1_name ?? null,
    equipe2: a.team2_name ?? null,
    scorePredit: a.score ?? null,
    scoreReel: a.real_score ?? null,
    issueCorrecte: a.winner_correct ?? null,
    scoreCorrect: a.score_correct ?? null,
    verifieeLe: a.verified_at ?? null,
  }));

  const derniereAnalyse = new Map<string, number>();
  const nombreAnalyses = new Map<string, number>();
  for (const a of analyses) {
    const t = new Date(a.creeLe).getTime();
    if (t > (derniereAnalyse.get(a.userId) ?? 0)) derniereAnalyse.set(a.userId, t);
    nombreAnalyses.set(a.userId, (nombreAnalyses.get(a.userId) ?? 0) + 1);
  }

  return {
    comptes,
    parId: new Map(comptes.map((c) => [c.id, c])),
    abonnements,
    abonnesActifs,
    ontPaye,
    analyses,
    derniereAnalyse,
    nombreAnalyses,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LES CINQ PUBLICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ① CEUX QUI ONT ESSAYÉ ET N'ONT PAS PAYÉ — 5 052 personnes.
 *
 * Le plus gros gisement du produit, et le moins cher : des adresses valides,
 * des gens qui connaissent déjà l'application, et à qui personne n'a jamais
 * écrit.
 *
 * ── L'ORDRE COMPTE PLUS QUE LA LISTE ────────────────────────────────────
 *
 * On écrit d'abord aux plus récents. Quelqu'un qui a essayé hier se souvient
 * de ce qu'il a vu ; celui de la mi-août a oublié jusqu'au nom du site. Comme
 * la campagne part par paliers de cent, cet ordre décide qui reçoit avant que
 * le plafond ne tombe — c'est le paramètre le plus important du fichier.
 */
export function nonPayeurs(t: Terrain): Destinataire[] {
  return t.comptes
    .filter((c) => c.email && !t.ontPaye.has(c.id) && (t.nombreAnalyses.get(c.id) ?? 0) > 0)
    .sort(
      (a, b) => (t.derniereAnalyse.get(b.id) ?? 0) - (t.derniereAnalyse.get(a.id) ?? 0)
    )
    .map((c) => ({
      email: c.email,
      userId: c.id,
      contexte: { analyses: t.nombreAnalyses.get(c.id) ?? 0 },
    }));
}

/**
 * ② CEUX QUI SE SONT INSCRITS SANS JAMAIS ESSAYER — 1 711 personnes.
 *
 * Le plus absurde des cinq publics : ils ont franchi l'inscription, l'étape la
 * plus coûteuse, et se sont arrêtés juste avant la seule qui montre le
 * produit.
 *
 * ── LES INSCRITS DU JOUR SONT ÉCARTÉS ───────────────────────────────────
 *
 * Quelqu'un qui vient de créer son compte il y a deux heures n'a pas
 * abandonné : il est peut-être en train de le faire. Lui écrire « vous n'avez
 * jamais essayé » pendant qu'il essaie est le meilleur moyen de le braquer.
 */
export function jamaisEssaye(t: Terrain, ageMinimumHeures = 24): Destinataire[] {
  const limite = Date.now() - ageMinimumHeures * 3_600_000;
  return t.comptes
    .filter(
      (c) =>
        c.email &&
        !t.ontPaye.has(c.id) &&
        (t.nombreAnalyses.get(c.id) ?? 0) === 0 &&
        new Date(c.creeLe).getTime() < limite
    )
    .sort((a, b) => new Date(b.creeLe).getTime() - new Date(a.creeLe).getTime())
    .map((c) => ({ email: c.email, userId: c.id }));
}

export interface ResultatDuJour {
  equipe1: string;
  equipe2: string;
  predit: string | null;
  reel: string | null;
  issueCorrecte: boolean;
  scoreCorrect: boolean;
}

/**
 * ③ CEUX DONT UNE ANALYSE VIENT D'ÊTRE VÉRIFIÉE — le message du soir.
 *
 * ── LA BOUCLE QUI MANQUAIT ──────────────────────────────────────────────
 *
 * L'application vérifie 18 831 analyses en silence. Celui qui a demandé
 * Real — Barça hier n'apprend jamais que le pronostic était juste ; il doit
 * aller le chercher lui-même.
 *
 * Or les gens reviennent DÉJÀ le soir : l'activité mesurée entre 22 h et 23 h
 * est presque aussi forte qu'à midi. Ils reviennent avec une question — est-ce
 * que ça a marché ? L'application connaît la réponse et ne la donne pas.
 *
 * ── ON N'ÉCRIT QUE SI L'ON A EU RAISON, ET C'EST ASSUMÉ ─────────────────
 *
 * Ce n'est pas de la dissimulation : le mur public affiche les échecs, la page
 * d'accueil annonce 56 % et non 100 %, et le taux réel est écrit noir sur
 * blanc. C'est une question de moment. Un message non sollicité, le soir, qui
 * dit « nous nous sommes trompés » ne rend service à personne et fait cliquer
 * sur « spam » — ce qui coûterait les livraisons d'accès de ceux qui ont payé.
 *
 * Qui veut le bilan complet l'a dans son historique, à toute heure, entier.
 */
export function resultatsDuSoir(t: Terrain, fenetreHeures = 26): Destinataire[] {
  const borne = Date.now() - fenetreHeures * 3_600_000;
  const parPersonne = new Map<string, ResultatDuJour[]>();

  for (const a of t.analyses) {
    if (!a.verifieeLe) continue;
    if (new Date(a.verifieeLe).getTime() < borne) continue;
    if (!a.issueCorrecte) continue;
    if (!a.equipe1 || !a.equipe2) continue;

    const liste = parPersonne.get(a.userId) ?? [];
    // Une même rencontre analysée deux fois par la même personne ne fait pas
    // deux lignes dans son message.
    const cle = `${a.equipe1}|${a.equipe2}`;
    if (liste.some((r) => `${r.equipe1}|${r.equipe2}` === cle)) continue;

    liste.push({
      equipe1: a.equipe1,
      equipe2: a.equipe2,
      predit: a.scorePredit,
      reel: a.scoreReel,
      issueCorrecte: true,
      scoreCorrect: !!a.scoreCorrect,
    });
    parPersonne.set(a.userId, liste);
  }

  const sortie: Destinataire[] = [];
  for (const [userId, resultats] of parPersonne) {
    const compte = t.parId.get(userId);
    if (!compte?.email) continue;
    // Le score exact d'abord : c'est la ligne qui fait rouvrir l'application.
    resultats.sort((a, b) => Number(b.scoreCorrect) - Number(a.scoreCorrect));
    sortie.push({ email: compte.email, userId, contexte: { resultats } });
  }
  return sortie;
}

/**
 * ④ LES ABONNÉS QUI NE VIENNENT PLUS — le réveil.
 *
 * ── CE QUE MESURE LE CHIFFRE ────────────────────────────────────────────
 *
 * Un payeur utilise l'application 2,9 jours en moyenne, sur trente jours de
 * quota. Il ne consomme pas ce qu'il a acheté — et au renouvellement, il ne
 * verra aucune raison de payer encore. C'est ce qui explique les 11,6 % de
 * réachat.
 *
 * ── CINQ JOURS, PAS DEUX ────────────────────────────────────────────────
 *
 * Deux jours de silence, c'est un week-end sans football intéressant. Cinq,
 * c'est un abonnement en train d'être oublié. Écrire trop tôt agace quelqu'un
 * qui allait revenir tout seul.
 */
export function abonnesDormants(t: Terrain, silenceJours = 5): Destinataire[] {
  const limite = Date.now() - silenceJours * JOUR_MS;
  const sortie: Destinataire[] = [];

  for (const userId of t.abonnesActifs) {
    const compte = t.parId.get(userId);
    if (!compte?.email) continue;

    // Jamais entré : c'est un autre problème, et il a déjà sa propre relance
    // (`relance-jamais-entres`), avec un lien de mot de passe que celle-ci
    // n'a pas. Deux messages différents pour la même personne le même jour la
    // convaincraient surtout qu'on ne sait pas ce qu'on fait.
    if (!compte.derniereEntree) continue;

    const derniere = t.derniereAnalyse.get(userId) ?? 0;
    if (derniere >= limite) continue;

    const abo = t.abonnements
      .filter((a) => a.userId === userId && a.expireLe)
      .sort(
        (a, b) => new Date(b.expireLe!).getTime() - new Date(a.expireLe!).getTime()
      )[0];

    sortie.push({
      email: compte.email,
      userId,
      contexte: {
        joursSansVenir: derniere
          ? Math.floor((Date.now() - derniere) / JOUR_MS)
          : null,
        expireLe: abo?.expireLe ?? null,
      },
    });
  }
  return sortie;
}

/**
 * ⑤ LE MESSAGE DU MATIN — ce qui fait ouvrir l'application tous les jours.
 *
 * ── POURQUOI PAS À TOUT LE MONDE ────────────────────────────────────────
 *
 * Écrire chaque matin aux 7 202 comptes ferait 216 000 messages par mois. Ce
 * n'est pas une question de facture : c'est le moyen le plus sûr de faire
 * classer le domaine en indésirable, et d'emporter avec lui les liens de mot
 * de passe et les livraisons d'accès.
 *
 * Le message du matin va donc à ceux qui ont montré qu'ils voulaient venir :
 * les abonnés en cours, et ceux qui ont analysé quelque chose cette semaine.
 * Environ huit cents personnes, et ce sont les bonnes.
 */
export function publicDuMatin(t: Terrain, fenetreJours = 7): Destinataire[] {
  const limite = Date.now() - fenetreJours * JOUR_MS;
  const retenus = new Set<string>();

  for (const userId of t.abonnesActifs) retenus.add(userId);
  for (const [userId, quand] of t.derniereAnalyse) {
    if (quand >= limite) retenus.add(userId);
  }

  const sortie: Destinataire[] = [];
  for (const userId of retenus) {
    const compte = t.parId.get(userId);
    if (!compte?.email) continue;
    // Jamais connecté : le message du matin lui parlerait de matchs alors
    // qu'il n'a même pas de mot de passe. Sa relance à lui existe ailleurs.
    if (!compte.derniereEntree) continue;
    sortie.push({
      email: compte.email,
      userId,
      contexte: { abonne: t.abonnesActifs.has(userId) },
    });
  }
  return sortie;
}
