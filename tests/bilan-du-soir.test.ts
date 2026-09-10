/**
 * ★ ACQUIS — UNE VENTE ENCAISSÉE FIGURE DANS LES COMPTES, MÊME REFUSÉE.
 *
 * ── LES 2 550 FRANCS QUI N'EXISTAIENT NULLE PART ────────────────────────
 *
 * Le 9 septembre 2026 à 10 h 53, p13057177@gmail.com règle 2 500 francs
 * depuis le Cameroun par Orange Money. Le contrôle de montant refuse —
 * « Montant 2500 incompatible avec l'offre essential_monthly (2000) » — et la
 * trace comptable, écrite APRÈS ce contrôle, n'a jamais lieu.
 *
 * L'argent est chez la boutique. Nos livres l'ignorent :
 *
 *     tableau de bord MakeTou     387 ventes    1 176 570 F
 *     page des partenaires        386 ventes    1 174 020 F
 *
 * Le propriétaire l'a découvert lui-même, sur l'écran de MakeTou, et a écrit :
 * « je ne comprends pas, tous les chiffres que tu sors sont des faux
 * chiffres ». Il avait raison sur le nombre, et l'enjeu dépasse le nombre :
 * il rémunère un influenceur sur cette base.
 *
 * ── CE QUI EST GARANTI ICI ──────────────────────────────────────────────
 *
 *   1. toute vente encaissée entre dans les comptes, honorée ou non ;
 *   2. le montant inscrit est celui RÉELLEMENT payé, pas le tarif ;
 *   3. sauf en monnaie étrangère, où le prix n'est pas comparable ;
 *   4. le bilan du soir confronte la base au journal de la boutique, et dit
 *      quand il manque quelque chose au lieu de rendre un total rassurant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { montantPourLesComptes } from '../src/lib/maketou';
import { messageBilanDuSoir, type BilanDuSoir } from '../src/lib/bilan-du-soir';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const MAKETOU = 'src/lib/maketou.ts';

/** Une vente telle que la boutique l'envoie. */
const venteDe = (prix: number, devise = 'XOF', produit = 'ProFoot AI — Accès Essentiel (30 jours)') => ({
  eventType: 'SUCCESSFUL_SALE',
  customer: { email: 'acheteur@exemple.com' },
  sale: { id: 'vente-essai', amount: Math.round(prix * 1.02), currency: devise },
  products: [{ name: produit, price: prix }],
});

test('★ ACQUIS — le montant inscrit est celui réellement payé', () => {
  // Le cas réel : 2 500 réglés sur une offre affichée 2 000. Inscrire 2 000
  // ferait diverger les livres du tableau de bord de la boutique, à jamais.
  assert.equal(
    montantPourLesComptes(venteDe(2500) as any, 'essential_monthly'),
    2500,
    'Le tarif est réinscrit à la place de la somme réellement réglée.'
  );
  assert.equal(montantPourLesComptes(venteDe(2000) as any, 'essential_monthly'), 2000);
  assert.equal(montantPourLesComptes(venteDe(5000) as any, 'pro_monthly'), 5000);
});

test('★ ACQUIS — une monnaie étrangère ne gonfle pas la recette', () => {
  // L'offre à 2 000 FCFA s'affiche « 31 242 GNF » à un visiteur guinéen.
  // L'inscrire telle quelle multiplierait la recette du jour par seize.
  const enGnf = montantPourLesComptes(venteDe(31242, 'GNF') as any, 'essential_monthly');
  assert.equal(enGnf, 2000, `31 242 GNF ont été inscrits comme ${enGnf} francs CFA.`);
});

test('★ ACQUIS — une vente refusée est tout de même inscrite', () => {
  const s = sansCommentaires(lire(MAKETOU));

  // Les trois refus qui laissaient l'argent hors des livres.
  const refus = [
    /Offre non reconnue/,
    /incompatible avec l'offre/,
    /invérifiable/,
  ];
  for (const r of refus) {
    const i = s.search(r);
    assert.ok(i > 0, `Le refus ${r} a disparu : ce test ne prouve plus rien.`);
    // L'inscription comptable doit précéder le refus, dans les 400 caractères
    // qui l'entourent.
    const autour = s.slice(Math.max(0, i - 400), i + 200);
    assert.match(
      autour,
      /noterVentePourLesComptes/,
      `Un refus (${r}) rend la main sans inscrire la vente : l'argent sort des livres.`
    );
  }
});

test('★ ACQUIS — le bilan du soir signale ce qui manque', () => {
  const base: BilanDuSoir = {
    jour: '2026-09-09',
    ventes: 22,
    chezMaketou: 54060,
    prixDeVente: 53000,
    commission: 2650,
    net: 50350,
    cumulVentes: 386,
    cumulChezMaketou: 1174020,
    cumulPrixDeVente: 1151000,
    cumulNet: 1093450,
    vuesAuPulse: 23,
    manquantes: 1,
    identifiantsManquants: ['d86672fc-c40a-4c3a-a60f-5a9f6509bf74'],
  };

  const alerte = messageBilanDuSoir(base);
  assert.match(alerte.texte, /ATTENTION/, 'Une vente manquante ne se voit pas dans le bilan.');
  assert.match(alerte.texte, /TROP BAS/, 'Le bilan ne dit pas que son propre total est faux.');
  assert.match(alerte.texte, /d86672fc/, 'La vente manquante n’est pas nommée : introuvable.');

  const propre = messageBilanDuSoir({ ...base, vuesAuPulse: 22, manquantes: 0, identifiantsManquants: [] });
  assert.doesNotMatch(propre.texte, /ATTENTION/, 'Une journée saine déclenche une alerte pour rien.');
  assert.match(propre.texte, /Tout est là/, 'Une journée saine ne dit pas qu’elle a été vérifiée.');

  // Un journal illisible ne doit JAMAIS passer pour une journée saine.
  const aveugle = messageBilanDuSoir({ ...base, vuesAuPulse: null, manquantes: 0, identifiantsManquants: [] });
  assert.match(aveugle.texte, /IMPOSSIBLE À VÉRIFIER/, 'Un contrôle impossible passe pour un contrôle réussi.');
  assert.doesNotMatch(aveugle.texte, /Tout est là/, 'Un contrôle impossible s’annonce comme vérifié.');
});

test('★ ACQUIS — le bilan porte les trois nombres, jamais un seul', () => {
  // `toLocaleString('fr-FR')` sépare les milliers par une espace insécable
  // ÉTROITE (U+202F), invisible à l'œil et distincte d'une espace ordinaire.
  // Comparer sans le savoir fait échouer un test sur un texte pourtant juste.
  const normaliser = (s: string) => s.replace(/[\s  ]+/g, ' ');
  const m = messageBilanDuSoir({
    jour: '2026-09-10', ventes: 19, chezMaketou: 55080, prixDeVente: 54000,
    commission: 2700, net: 51300, cumulVentes: 387, cumulChezMaketou: 1176570,
    cumulPrixDeVente: 1153500, cumulNet: 1095825, vuesAuPulse: 19,
    manquantes: 0, identifiantsManquants: [],
  });
  // Les points de conduite qui alignent les montants sont retirés AVANT de
  // réduire les espaces : sinon « payé ...... 55 080 » devient « payé   55 080 »
  // et aucune comparaison ne tombe juste.
  const texte = normaliser(normaliser(m.texte).replace(/\.{2,}/g, ' '));

  // ── LES TROIS LIGNES QUI SE VÉRIFIENT À LA MAIN ────────────────────────
  //
  // payé − gardé = reçu. Un propriétaire doit pouvoir refaire l'addition sur
  // un coin de table : c'est ce qui a manqué dans la première version.
  assert.match(texte, /Vos clients ont payé 55 080 F/, 'Ce que les clients ont payé a disparu.');
  assert.match(texte, /MakeTou garde - 3 780 F/, 'Ce que la boutique garde a disparu.');
  assert.match(texte, /IL VOUS REVIENT 51 300 F/, 'Ce qui revient au propriétaire a disparu.');
  assert.equal(55080 - 3780, 51300, 'Les trois lignes ne s’additionnent plus.');

  // ── LE NOMBRE À CONFRONTER AU TABLEAU DE BORD ──────────────────────────
  assert.match(texte, /Revenus totaux 1 176 570 F/, 'Le cumul comparable à MakeTou a disparu.');
  assert.match(texte, /Nombre de commandes 387/, 'Le nombre de commandes à comparer a disparu.');

  // ── LA BASE DE LA COMMISSION, NOMMÉE ET EXPLIQUÉE ──────────────────────
  assert.match(texte, /POUR PAYER VOTRE PARTENAIRE/, 'La section du partenaire a disparu.');
  assert.match(texte, /Prix de vente du jour 54 000 F/, 'La base de la commission a disparu.');

  // Le sujet dit ce que le propriétaire veut savoir en premier : ce qu'il a
  // gagné, sans ouvrir le message.
  assert.match(normaliser(m.sujet), /53 |51 300 F pour vous/, 'Le sujet ne dit plus ce qui lui revient.');
  assert.match(normaliser(m.sujet), /19 ventes/, 'Le sujet ne dit plus combien de ventes.');
});

test('★ ACQUIS — la tâche du soir est planifiée', () => {
  const vercel = JSON.parse(lire('vercel.json'));
  const tache = (vercel.crons ?? []).find((c: any) => String(c.path).includes('bilan-du-soir'));
  assert.ok(tache, 'Le bilan du soir n’est plus planifié : il ne partira jamais.');
  assert.equal(tache.schedule, '59 23 * * *', 'Le bilan ne part plus à 23 h 59.');
});
