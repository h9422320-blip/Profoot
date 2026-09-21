import { NextRequest, NextResponse } from 'next/server';

/**
 * ÉCRIRE À UNE PERSONNE, UNE SEULE, DEPUIS L'EXTÉRIEUR.
 *
 * ── POURQUOI CETTE PORTE EXISTE ───────────────────────────────────────────
 *
 * Tous les messages que l'application sait envoyer sont des messages ÉCRITS
 * D'AVANCE : livrer un accès, renvoyer un mot de passe, relancer un abonné
 * jamais entré, lancer une campagne. Aucun ne permet de répondre au cas
 * particulier — celui qui a payé deux fois, celui dont l'opérateur ne passe
 * pas, celui qui s'est trompé d'adresse.
 *
 * Or ces messages-là sont les plus importants : ce sont les seuls écrits pour
 * UNE personne, et ce sont eux qui décident si elle repaie le mois suivant.
 *
 * ── POURQUOI ILS NE PARTAIENT PAS D'ICI ───────────────────────────────────
 *
 * La clé du service de courriel ne vit que sur l'hébergeur. Un message écrit
 * à la main partait donc d'un script local… qui n'avait pas la clé. Il n'y
 * avait aucun chemin : ni depuis la machine, ni depuis l'application.
 *
 * ── LES TROIS GARDES, ET CE QU'ELLES EMPÊCHENT ────────────────────────────
 *
 * 1. POST SEULEMENT, CLÉ DANS L'EN-TÊTE. En GET, la clé partirait dans les
 *    journaux du serveur, dans l'historique du navigateur et dans l'en-tête
 *    de provenance de la page suivante. La comparaison est à durée constante :
 *    une comparaison ordinaire s'arrête au premier caractère faux, et le temps
 *    de réponse révèle alors combien de caractères étaient justes.
 *
 * 2. LA SIMULATION EST LE DÉFAUT. Sans `simulation: false`, rien ne part : la
 *    réponse rend le message exactement tel qu'il serait envoyé, destinataire
 *    compris. Un courriel parti est parti — il n'y a pas de rattrapage, et la
 *    seule protection honnête est de le lire avant.
 *
 * 3. TROIS DESTINATAIRES AU PLUS. Cette porte sert à écrire à quelqu'un, pas
 *    à écrire à tout le monde : les envois de masse passent par `/api/campagne`,
 *    qui compte, trace et s'arrête tout seul en cas de refus répétés. Trois
 *    suffisent pour le cas réel — la même personne avec deux adresses, et une
 *    copie à la boîte de l'équipe.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Au-delà, ce n'est plus une réponse à quelqu'un, c'est une campagne. */
const MAX_DESTINATAIRES = 3;

/**
 * La même vérification que `/api/campagne`, volontairement recopiée.
 *
 * La factoriser voudrait dire toucher une route qui fonctionne et qui envoie
 * du courrier à des milliers de personnes. Dix lignes en double coûtent moins
 * cher qu'un défaut introduit là-bas.
 */
function cleValide(fournie: string): boolean {
  const attendue = process.env.ADMIN_ACCESS_KEY ?? '';
  if (!attendue || fournie.length !== attendue.length) return false;
  let ecart = 0;
  for (let i = 0; i < attendue.length; i++) {
    ecart |= fournie.charCodeAt(i) ^ attendue.charCodeAt(i);
  }
  return ecart === 0;
}

const adresseValable = (a: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a);

export async function POST(req: NextRequest) {
  const entete = req.headers.get('authorization') ?? '';
  const cle = entete.startsWith('Bearer ') ? entete.slice(7) : '';
  if (!cleValide(cle)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let corps: { a?: string | string[]; sujet?: string; texte?: string; simulation?: boolean } = {};
  try {
    corps = await req.json();
  } catch {
    /* Un corps illisible est traité comme un corps vide : la réponse dira quoi
       fournir, au lieu de rendre une erreur d'analyse syntaxique. */
  }

  const destinataires = (Array.isArray(corps.a) ? corps.a : [corps.a])
    .map((x) => String(x ?? '').trim().toLowerCase())
    .filter(Boolean);
  const sujet = String(corps.sujet ?? '').trim();
  const texte = String(corps.texte ?? '');

  if (!destinataires.length || !sujet || !texte.trim()) {
    return NextResponse.json(
      { error: 'Il faut `a` (une adresse ou une liste), `sujet` et `texte`.' },
      { status: 400 }
    );
  }
  if (destinataires.length > MAX_DESTINATAIRES) {
    return NextResponse.json(
      { error: `Trois destinataires au plus ici ; au-delà, passez par /api/campagne.` },
      { status: 400 }
    );
  }
  const fausses = destinataires.filter((a) => !adresseValable(a));
  if (fausses.length) {
    return NextResponse.json({ error: `Adresse invalide : ${fausses.join(', ')}` }, { status: 400 });
  }

  // La simulation est le défaut : il faut demander explicitement l'envoi.
  if (corps.simulation !== false) {
    return NextResponse.json({
      simulation: true,
      destinataires,
      sujet,
      texte,
      note: 'Rien n’est parti. Renvoyez la même demande avec "simulation": false pour envoyer.',
    });
  }

  // Le module ENTIER, et pas ses fonctions détachées : `dernierRefus` est une
  // variable qui change pendant l'envoi. La déstructurer ici en figerait la
  // valeur d'avant, et la réponse dirait « aucun refus » à chaque échec.
  const courriel = await import('@/lib/courriel');
  const { envoyerCourriel, courrielDisponible } = courriel;
  if (!courrielDisponible()) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY absente du serveur : aucun message ne peut partir.' },
      { status: 503 }
    );
  }

  const resultats: { a: string; parti: boolean }[] = [];
  for (const a of destinataires) {
    resultats.push({ a, parti: await envoyerCourriel({ a, sujet, texte }) });
  }
  const partis = resultats.filter((r) => r.parti).length;
  console.log(`[COURRIER] « ${sujet} » — ${partis}/${resultats.length} parti(s).`);

  return NextResponse.json({
    envoye: partis,
    sur: resultats.length,
    resultats,
    // Quand un envoi est refusé, la raison est la seule chose utile.
    refus: partis < resultats.length ? courriel.dernierRefus : null,
  });
}
