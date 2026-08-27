/**
 * LE BANC D'ESSAI PAWAPAY, EXÉCUTÉ LÀ OÙ LE JETON SE TROUVE.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ───────────────────────────────────────────
 *
 * Le jeton vit dans les variables de Vercel. Le rapatrier sur un poste de
 * travail demande le CLI Vercel, qui demande PowerShell, qui refuse d'exécuter
 * des scripts par défaut sur Windows. Trois obstacles pour déplacer un secret
 * qui n'a aucune raison de bouger.
 *
 * Le serveur, lui, l'a déjà. On fait donc tourner les essais chez lui, et on
 * ne rapatrie que le résultat.
 *
 * ── TROIS VERROUS ─────────────────────────────────────────────────────────
 *
 *   1. réservée à l'administration — le même contrôle que le reste ;
 *   2. REFUSE de tourner ailleurs que sur le bac à sable. Un banc d'essai qui
 *      déclenche de vrais encaissements ne se rattrape pas ;
 *   3. ne touche pas à notre base : c'est la passerelle qu'on éprouve, pas le
 *      parcours d'achat. Aucun accès ne peut s'ouvrir par ce chemin.
 *
 * Le jeton n'apparaît jamais dans la réponse, ni sa longueur, ni son début.
 */

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { estAdmin } from '@/lib/admins';
import { baseUrl, estProduction, pawapayConfigure } from '@/lib/pawapay';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Numéros de test officiels PawaPay. La terminaison décide de l'issue :
 * …789 aboutit, …129 reste en cours, …049 et …019 échouent.
 */
const ESSAIS = [
  { nom: 'réussite 1', tel: '254703456789', attendu: 'COMPLETED', montant: '100' },
  { nom: 'réussite 2', tel: '254703456789', attendu: 'COMPLETED', montant: '250' },
  { nom: 'réussite 3', tel: '254703456789', attendu: 'COMPLETED', montant: '500' },
  { nom: 'réussite 4', tel: '254703456789', attendu: 'COMPLETED', montant: '750' },
  { nom: 'réussite 5', tel: '254703456789', attendu: 'COMPLETED', montant: '1000' },
  { nom: 'solde insuffisant', tel: '254703456049', attendu: 'FAILED', montant: '100' },
  { nom: 'plafond atteint', tel: '254703456019', attendu: 'FAILED', montant: '100' },
  { nom: 'reste en cours', tel: '254703456129', attendu: 'PENDING', montant: '100' },
];

const OPERATEUR = 'MPESA_KEN';
const DEVISE = 'KES';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!estAdmin(user?.email)) {
    return NextResponse.json({ erreur: "Réservé à l'administration." }, { status: 403 });
  }

  if (!pawapayConfigure()) {
    return NextResponse.json({
      erreur: 'PAWAPAY_API_TOKEN absent du serveur.',
      aFaire: "Ajoutez la variable dans Vercel, puis redéployez — les variables ne sont lues qu'au démarrage.",
    }, { status: 503 });
  }

  // ── LE VERROU QUI COMPTE ────────────────────────────────────────────────
  if (estProduction()) {
    return NextResponse.json({
      erreur: 'REFUS : PAWAPAY_BASE_URL pointe vers la production.',
      base: baseUrl(),
      aFaire: 'Ce banc d’essai ne tourne que sur https://api.sandbox.pawapay.io',
    }, { status: 400 });
  }

  const jeton = process.env.PAWAPAY_API_TOKEN!;
  const appel = async (chemin: string, methode: 'GET' | 'POST' = 'GET', corps?: unknown) => {
    const r = await fetch(baseUrl() + chemin, {
      method: methode,
      headers: {
        Authorization: `Bearer ${jeton}`,
        Accept: 'application/json',
        ...(corps ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
      cache: 'no-store',
    });
    const texte = await r.text();
    let json: any = null;
    try { json = texte ? JSON.parse(texte) : null; } catch { /* réponse non JSON */ }
    return { http: r.status, json, texte: texte.slice(0, 300) };
  };

  // ── 1. LA CONFIGURATION DU COMPTE ───────────────────────────────────────
  const conf = await appel('/v2/active-conf');
  if (conf.http !== 200) {
    return NextResponse.json({
      etape: 'configuration',
      erreur: `La passerelle a répondu ${conf.http}.`,
      detail: conf.texte,
    }, { status: 502 });
  }

  const pays = (conf.json?.countries ?? []).map((p: any) => ({
    pays: p.country,
    operateurs: (p.providers ?? []).map((x: any) => x.provider),
  }));

  // ── 2. LES ENCAISSEMENTS ────────────────────────────────────────────────
  const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const resultats: any[] = [];

  for (const e of ESSAIS) {
    const depositId = crypto.randomUUID();
    const init = await appel('/v2/deposits', 'POST', {
      depositId,
      amount: e.montant,
      currency: DEVISE,
      payer: { type: 'MMO', accountDetails: { phoneNumber: e.tel, provider: OPERATEUR } },
      clientReferenceId: `ESSAI-${depositId.slice(0, 8)}`,
      customerMessage: 'ProFoot AI',
    });

    const accepte = init.json?.status;
    if (accepte !== 'ACCEPTED' && accepte !== 'DUPLICATE_IGNORED') {
      resultats.push({
        essai: e.nom,
        depositId,
        attendu: e.attendu,
        obtenu: 'REFUS_A_L_INITIATION',
        detail: init.json?.failureReason?.failureCode ?? `HTTP ${init.http}`,
        conforme: false,
      });
      continue;
    }

    // On relit jusqu'au statut définitif, sans dépasser une vingtaine de secondes.
    let statut: string | null = null;
    let code: string | null = null;
    for (let i = 0; i < 8; i++) {
      await attendre(2000);
      const s = await appel(`/v2/deposits/${depositId}`);
      if (s.json?.status === 'FOUND') {
        statut = s.json.data?.status ?? null;
        code = s.json.data?.failureReason?.failureCode ?? null;
        if (statut === 'COMPLETED' || statut === 'FAILED') break;
      }
    }

    const conforme =
      e.attendu === 'PENDING'
        ? statut !== 'COMPLETED' && statut !== 'FAILED'
        : statut === e.attendu;

    resultats.push({ essai: e.nom, depositId, attendu: e.attendu, obtenu: statut, code, conforme });
  }

  const conformes = resultats.filter((r) => r.conforme).length;
  const aboutis = resultats.filter((r) => r.obtenu === 'COMPLETED').length;

  return NextResponse.json({
    environnement: 'SANDBOX',
    base: baseUrl(),
    societe: conf.json?.companyName ?? null,
    paysOuverts: pays.length,
    pays,
    essais: resultats,
    bilan: {
      total: resultats.length,
      conformes,
      encaissementsAboutis: aboutis,
      verdict: conformes === resultats.length ? 'TOUT EST CONFORME' : 'DES ÉCARTS À REGARDER',
    },
  });
}
