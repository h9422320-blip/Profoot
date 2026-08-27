/**
 * Le document remis au client après son achat.
 *
 * Il sert deux fois : MakeTou exige un fichier pour publier un produit, et le
 * client a besoin de savoir quoi faire s'il ne comprend pas où aller. Le 26 août
 * 2026, treize clients ont payé sans obtenir leur accès et personne ne leur a
 * rien dit — ce document est le filet qui parle à leur place.
 *
 * Il redit aussi, noir sur blanc, ce que ProFoot vend : un accès à un outil
 * d'analyse statistique, payé une fois, sans renouvellement automatique.
 */
import fs from 'node:fs';
import PDFDocument from 'pdfkit';

const VERT = '#10B981';
const VERT_PALE = '#F0FDF4';
const ENCRE = '#0F172A';
const GRIS = '#64748B';
const GRIS_CLAIR = '#E2E8F0';

const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
  Title: 'ProFoot AI — Comment accéder à votre analyse',
  Author: 'ProFoot AI',
} });
doc.pipe(fs.createWriteStream('ProFoot-AI-Guide-Acces.pdf'));

const L = doc.page.width;
const M = 62;

// ── Bandeau ────────────────────────────────────────────────────────────────
doc.rect(0, 0, L, 16).fill(VERT);

let y = 78;
doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(24).text('ProFoot AI', M, y);

y += 30;
doc.fillColor(GRIS).font('Helvetica').fontSize(13.5)
   .text('Comment accéder à votre analyse', M, y);

y += 26;
doc.moveTo(M, y).lineTo(L - M, y).lineWidth(0.8).stroke(GRIS_CLAIR);

// ── Merci ──────────────────────────────────────────────────────────────────
y += 26;
doc.fillColor(ENCRE).font('Helvetica').fontSize(11)
   .text('Merci pour votre achat. Votre accès est actif dès maintenant.', M, y);

// ── Les trois étapes ───────────────────────────────────────────────────────
const etapes = [
  ['1', 'Rendez-vous sur profootai.com',
   ["Depuis un téléphone ou un ordinateur, avec votre navigateur habituel."]],
  ['2', "Connectez-vous avec l'adresse e-mail utilisée pour l'achat",
   ["C'est elle qui relie votre paiement à votre compte. Une adresse",
    "différente ne trouvera pas votre accès."]],
  ['3', "Votre accès s'ouvre automatiquement",
   ['Aucun code à saisir, aucune manipulation. Lancez votre première',
    'analyse en choisissant deux équipes.']],
];

y += 36;
for (const [numero, titre, lignes] of etapes) {
  doc.circle(M + 10, y + 6, 10).fill(VERT);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10.5)
     .text(numero, M + 5, y + 2, { width: 10, align: 'center' });

  doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(11.5)
     .text(titre, M + 32, y);

  let yy = y + 17;
  doc.fillColor(GRIS).font('Helvetica').fontSize(10);
  for (const ligne of lignes) {
    doc.text(ligne, M + 32, yy);
    yy += 14;
  }
  y = yy + 16;
}

// ── Ce que comprend l'accès ────────────────────────────────────────────────
const hEncadre = 104;
doc.roundedRect(M, y, L - 2 * M, hEncadre, 8).fill(VERT_PALE);

doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(11)
   .text('Ce que comprend votre accès Essentiel', M + 20, y + 18);

const inclus = [
  '20 analyses complètes par mois, sur plus de 15 compétitions',
  'Statistiques avancées : forme, confrontations, buts attendus',
  'Accès valable 30 jours à compter de votre achat',
];
inclus.forEach((ligne, i) => {
  const yl = y + 42 + i * 17;
  doc.fillColor(VERT).font('Helvetica-Bold').fontSize(10).text('•', M + 20, yl);
  doc.fillColor(GRIS).font('Helvetica').fontSize(10).text(ligne, M + 32, yl);
});

y += hEncadre + 30;

// ── Un souci ? ─────────────────────────────────────────────────────────────
doc.fillColor(ENCRE).font('Helvetica-Bold').fontSize(11)
   .text('Un problème pour accéder ?', M, y);

y += 18;
doc.fillColor(GRIS).font('Helvetica').fontSize(10);
for (const ligne of [
  "Écrivez-nous à contactprofootai@gmail.com en précisant l'adresse e-mail",
  'utilisée lors de votre achat. Nous ouvrons votre accès manuellement.',
]) {
  doc.text(ligne, M, y);
  y += 14;
}

// ── Pied de page ───────────────────────────────────────────────────────────
const yPied = doc.page.height - 92;
doc.moveTo(M, yPied).lineTo(L - M, yPied).lineWidth(0.8).stroke(GRIS_CLAIR);

doc.fillColor(GRIS).font('Helvetica').fontSize(8.5);
let yp = yPied + 14;
for (const ligne of [
  "ProFoot AI est un outil d'analyse statistique du football. L'achat donne accès à l'outil pour une durée",
  'déterminée : paiement unique, sans renouvellement automatique. Aucune analyse ne garantit un résultat.',
]) {
  doc.text(ligne, M, yp);
  yp += 12;
}

doc.fillColor(VERT).font('Helvetica-Bold').fontSize(9).text('profootai.com', M, yp + 6);

doc.end();
console.log('  PDF créé : ProFoot-AI-Guide-Acces.pdf');
