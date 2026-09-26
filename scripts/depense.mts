/**
 * INSCRIRE UN PAIEMENT DANS LES FRAIS DE FONCTIONNEMENT.
 *
 * ── POURQUOI CE SCRIPT EXISTE ─────────────────────────────────────────────
 *
 * Décision du propriétaire, le 26 septembre 2026 : aucun formulaire dans
 * l'administration. Il dit à Claude « aujourd'hui j'ai payé 25 $ pour
 * Supabase », et Claude l'inscrit ici. La page « Partenaires » ne fait que
 * lire ce qui est écrit.
 *
 * Chaque inscription est RELUE en base avant d'annoncer quoi que ce soit : le
 * 25 septembre, un script a annoncé une publication réussie alors que
 * l'écriture avait échoué en silence. Sur des chiffres qui décident de ce
 * qu'on verse à quelqu'un, on ne l'accepte pas.
 *
 *   npx tsx scripts/depense.mts ajouter supabase 25 USD "abonnement mensuel" [2026-09-26] [--ref FACTURE-123]
 *        [--source "reçu Gmail"] [--recurrente] [--essai]
 *   npx tsx scripts/depense.mts retirer depense-supabase-2026-09-USD-2500
 *   npx tsx scripts/depense.mts taux 610
 *   npx tsx scripts/depense.mts voir [2026-09]
 *
 * Outils : claude, openrouter, supabase, vercel, api-football, resend, meta, autre.
 * --essai montre la ligne et sa conversion sans rien écrire.
 */
import { chargerEnv } from './challenger/commun.mjs';

chargerEnv();
const {
  inscrireDepense,
  retirerDepense,
  lireDepenses,
  lireTauxUsdXof,
  definirTauxUsdXof,
  tableauDuMois,
  cleDeDepense,
  enFrancs,
  FOURNISSEURS,
  DEBUT_DU_SUIVI,
} = await import('../src/lib/depenses.js');

const ALIAS: Record<string, string> = {
  claude: 'anthropic',
  'claude-code': 'anthropic',
  anthropic: 'anthropic',
  'api-football': 'apifootball',
  apifootball: 'apifootball',
};


const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/**
 * Un arrêt propre. On ne fait JAMAIS `process.exit()` ici : sous Windows, le
 * quitter pendant que la connexion à la base se ferme fait planter Node
 * (« Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ») — relevé par la
 * revue du 26 septembre 2026, et c'est la tâche programmée qui l'aurait subi.
 * On lève une erreur, et le code de sortie est posé à la fin.
 */
class Arret extends Error {}
function arreter(message: string): never {
  throw new Arret(message);
}

/** « 25 $ × 600 = 15 000 FCFA » : chaque conversion se refait à la main. */
function conversion(p: { montant: number; devise: string; taux: number; montantXof: number }): string {
  if (p.devise === 'XOF') return fcfa(p.montantXof);
  if (p.devise === 'EUR') return `${Number(p.montant).toLocaleString('fr-FR')} € × 655,957 = ${fcfa(p.montantXof)}`;
  return `${Number(p.montant).toLocaleString('fr-FR')} $ × ${Number(p.taux).toLocaleString('fr-FR')} = ${fcfa(p.montantXof)}`;
}

async function afficher(mois: string) {
  const t = tableauDuMois(mois, await lireDepenses());
  console.log(`\nFrais de fonctionnement — ${mois}   (1 $ = ${await lireTauxUsdXof()} FCFA pour les prochains paiements)`);
  console.log('─'.repeat(72));
  for (const r of t.rangees) {
    console.log(`${r.nom.padEnd(16)}${r.paye.padStart(24)}${(r.paiements.length ? fcfa(r.montantXof) : '—').padStart(20)}`);
    for (const p of r.paiements) console.log(`   ${p.jour} · ${p.libelle} · ${conversion(p)}   [${p.cle}]`);
  }
  console.log('─'.repeat(72));
  console.log(`${'Total du mois'.padEnd(16)}${t.paye.padStart(24)}${fcfa(t.totalXof).padStart(20)}\n`);
}

const [commande, ...args] = process.argv.slice(2);
const option = (nom: string) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] ?? null : null;
};
// Les drapeaux sans valeur ; les options prennent l'argument suivant.
const DRAPEAUX = new Set(['--recurrente', '--essai']);
const OPTIONS = new Set(['--ref', '--reference', '--source']);
const positionnels = args.filter(
  (a, i) => !a.startsWith('--') && !(i > 0 && OPTIONS.has(args[i - 1]))
);

async function principal() {
  // Une faute de frappe ne doit jamais changer ce qui est écrit : « --essais »
  // inscrivait pour de vrai, « --recurrent » avalait la date qui suivait.
  const inconnue = args.find((a) => a.startsWith('--') && !DRAPEAUX.has(a) && !OPTIONS.has(a));
  if (inconnue) arreter(`Option inconnue « ${inconnue} ». Options : ${[...DRAPEAUX, ...OPTIONS].join(', ')}.`);

  if (commande === 'ajouter') {
    const [outilBrut, montantBrut, deviseBrute, libelle, jourBrut, ...trop] = positionnels;
    if (trop.length) arreter(`Arguments en trop : ${trop.join(' ')}. Le libellé contient-il des espaces sans guillemets ?`);
    const outil = ALIAS[String(outilBrut).toLowerCase()] ?? String(outilBrut).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(FOURNISSEURS, outil)) {
      arreter(`Outil inconnu « ${outilBrut} ». Outils : ${Object.keys(FOURNISSEURS).join(', ')} (claude = anthropic).`);
    }
    const montant = Number(String(montantBrut).replace(',', '.'));
    if (!Number.isFinite(montant) || montant <= 0) arreter(`Montant illisible « ${montantBrut} ».`);
    const devise = String(deviseBrute ?? '').toUpperCase().replace('$', 'USD').replace('FCFA', 'XOF').replace('€', 'EUR');
    if (!['USD', 'XOF', 'EUR'].includes(devise)) arreter(`Devise illisible « ${deviseBrute} » : USD, XOF ou EUR.`);
    if (!libelle || !String(libelle).trim()) arreter('Il faut un libellé : « abonnement mensuel », « crédits »…');
    const jour = jourBrut ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) arreter(`Jour illisible « ${jour} » : AAAA-MM-JJ.`);
    if (jour < DEBUT_DU_SUIVI) arreter(`Le suivi commence le ${DEBUT_DU_SUIVI} : ${jour} est antérieur.`);

    const taux = await lireTauxUsdXof();
    const d = {
      jour,
      fournisseur: outil as any,
      libelle: String(libelle).trim().slice(0, 120),
      montant,
      devise: devise as 'USD' | 'XOF' | 'EUR',
      taux,
      recurrente: args.includes('--recurrente'),
      source: option('--source') ?? 'déclaré par le propriétaire à Claude',
      reference: option('--ref') ?? option('--reference'),
    };
    const cle = cleDeDepense(d);
    const nom = FOURNISSEURS[outil as keyof typeof FOURNISSEURS].split(' — ')[0];
    console.log(`\n${nom} · ${jour} · ${conversion({ ...d, montantXof: enFrancs(montant, d.devise, taux) })}`);

    if (args.includes('--essai')) {
      console.log(`\n(essai : rien n'est inscrit — clé ${cle})\n`);
      return;
    }

    const resultat = await inscrireDepense(d);
    if (resultat === 'refusee') arreter('Inscription refusée par la base (voir le message ci-dessus).');
    // Un doublon n'est JAMAIS un succès : annoncer « inscrite » pour un second
    // paiement réel refusé ferait manquer cette somme au partage.
    if (resultat === 'deja-connue') {
      arreter(
        `Déjà en base : ${cle} (même outil, même mois, même montant${d.reference ? ', même référence' : ''}). ` +
          `Rien n'est ajouté. Si c'est un SECOND paiement réel, relancer avec --ref <n° de facture, ou date du paiement>.`
      );
    }

    // La relecture : sans elle, on ne sait pas.
    const relue = (await lireDepenses()).find((l) => l.cle === cle);
    if (!relue) arreter(`Relecture : ${cle} est ABSENTE de la base. Rien n'est inscrit.`);
    console.log(`\n✔ Inscrite et relue : ${relue.cle} = ${fcfa(relue.montantXof)}`);
    await afficher(jour.slice(0, 7));
  } else if (commande === 'retirer') {
    const cle = positionnels[0];
    if (!cle) arreter('Donner la clé de la dépense à retirer (affichée par « voir »).');
    const avant = (await lireDepenses()).find((l) => l.cle === cle);
    if (!avant) arreter(`Aucune dépense ${cle}.`);
    if (!(await retirerDepense(cle))) arreter('Retrait refusé par la base.');
    if ((await lireDepenses()).some((l) => l.cle === cle)) arreter(`Relecture : ${cle} est TOUJOURS en base.`);
    console.log(`\n✔ Retirée et vérifiée : ${cle} (${fcfa(avant.montantXof)})`);
    await afficher(String(avant.jour).slice(0, 7));
  } else if (commande === 'taux') {
    const voulu = Number(positionnels[0]);
    const obtenu = await definirTauxUsdXof(voulu, 'Claude, sur demande du propriétaire');
    if (obtenu !== Math.round(voulu)) arreter(`Taux refusé : ${positionnels[0]} (entre 100 et 2000). Taux en place : ${obtenu}.`);
    console.log(`\n✔ 1 $ = ${obtenu} FCFA pour les prochains paiements. Les dépenses déjà inscrites gardent le leur.\n`);
  } else if (commande === 'voir') {
    await afficher(positionnels[0] ?? new Date().toISOString().slice(0, 7));
  } else {
    arreter('Commandes : ajouter, retirer, taux, voir. Voir l’en-tête du script.');
  }
}

try {
  await principal();
} catch (e) {
  if (!(e instanceof Arret)) throw e;
  console.error(`\n✖ ${e.message}\n`);
  process.exitCode = 1;
}
