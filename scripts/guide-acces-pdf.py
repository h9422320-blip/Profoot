# -*- coding: utf-8 -*-
"""
Le document remis au client après son achat.

Il sert deux fois : MakeTou exige un fichier pour publier un produit, et le
client a besoin de savoir quoi faire s'il ne comprend pas où aller. Le 26 août
2026, treize clients ont payé sans obtenir leur accès et personne ne leur a
rien dit — ce document est le filet qui parle à leur place.

Il redit aussi, noir sur blanc, ce que ProFoot vend : un accès à un outil
d'analyse statistique, payé une fois, sans renouvellement automatique.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas

VERT = colors.HexColor("#10B981")
ENCRE = colors.HexColor("#0F172A")
GRIS = colors.HexColor("#64748B")
GRIS_CLAIR = colors.HexColor("#E2E8F0")

L, H = A4
M = 22 * mm

c = canvas.Canvas("ProFoot-AI-Guide-Acces.pdf", pagesize=A4)
c.setTitle("ProFoot AI — Comment acceder a votre analyse")
c.setAuthor("ProFoot AI")

# ── Bandeau ────────────────────────────────────────────────────────────────
c.setFillColor(VERT)
c.rect(0, H - 6 * mm, L, 6 * mm, stroke=0, fill=1)

y = H - 30 * mm
c.setFillColor(ENCRE)
c.setFont("Helvetica-Bold", 23)
c.drawString(M, y, "ProFoot AI")

y -= 9 * mm
c.setFillColor(GRIS)
c.setFont("Helvetica", 13)
c.drawString(M, y, "Comment acceder a votre analyse")

y -= 6 * mm
c.setStrokeColor(GRIS_CLAIR)
c.setLineWidth(0.8)
c.line(M, y, L - M, y)

# ── Merci ──────────────────────────────────────────────────────────────────
y -= 12 * mm
c.setFillColor(ENCRE)
c.setFont("Helvetica", 11)
c.drawString(M, y, "Merci pour votre achat. Votre acces est actif des maintenant.")

# ── Les trois etapes ───────────────────────────────────────────────────────
etapes = [
    ("1", "Rendez-vous sur profootai.com",
     "Depuis un telephone ou un ordinateur, avec votre navigateur habituel."),
    ("2", "Connectez-vous avec l'adresse e-mail utilisee pour l'achat",
     "C'est elle qui relie votre paiement a votre compte. Une adresse",
     "differente ne trouvera pas votre acces."),
    ("3", "Votre acces s'ouvre automatiquement",
     "Aucun code a saisir, aucune manipulation. Lancez votre premiere",
     "analyse en choisissant deux equipes."),
]

y -= 14 * mm
for e in etapes:
    numero, titre = e[0], e[1]
    lignes = e[2:]

    c.setFillColor(VERT)
    c.circle(M + 3.5 * mm, y + 1.4 * mm, 3.5 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(M + 3.5 * mm, y - 0.4 * mm, numero)

    c.setFillColor(ENCRE)
    c.setFont("Helvetica-Bold", 11.5)
    c.drawString(M + 12 * mm, y, titre)

    yy = y - 5.6 * mm
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 10)
    for ligne in lignes:
        c.drawString(M + 12 * mm, yy, ligne)
        yy -= 4.8 * mm

    y = yy - 6 * mm

# ── Ce que comprend l'acces ────────────────────────────────────────────────
y -= 2 * mm
c.setFillColor(colors.HexColor("#F0FDF4"))
c.roundRect(M, y - 34 * mm, L - 2 * M, 34 * mm, 3 * mm, stroke=0, fill=1)

c.setFillColor(ENCRE)
c.setFont("Helvetica-Bold", 11)
c.drawString(M + 7 * mm, y - 9 * mm, "Ce que comprend votre acces Essentiel")

c.setFillColor(GRIS)
c.setFont("Helvetica", 10)
for i, ligne in enumerate([
    "20 analyses completes par mois, sur plus de 15 competitions",
    "Statistiques avancees : forme, confrontations, buts attendus",
    "Acces valable 30 jours a compter de votre achat",
]):
    c.setFillColor(VERT)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 7 * mm, y - 16 * mm - i * 5.5 * mm, "-")
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 10)
    c.drawString(M + 11 * mm, y - 16 * mm - i * 5.5 * mm, ligne)

y -= 44 * mm

# ── Un souci ? ─────────────────────────────────────────────────────────────
c.setFillColor(ENCRE)
c.setFont("Helvetica-Bold", 11)
c.drawString(M, y, "Un probleme pour acceder ?")

y -= 6 * mm
c.setFillColor(GRIS)
c.setFont("Helvetica", 10)
for ligne in [
    "Ecrivez-nous a contactprofootai@gmail.com en precisant l'adresse e-mail",
    "utilisee lors de l'achat. Nous ouvrons votre acces manuellement.",
]:
    c.drawString(M, y, ligne)
    y -= 5 * mm

# ── Pied de page ───────────────────────────────────────────────────────────
y = 24 * mm
c.setStrokeColor(GRIS_CLAIR)
c.line(M, y + 8 * mm, L - M, y + 8 * mm)

c.setFillColor(GRIS)
c.setFont("Helvetica", 8.5)
for ligne in [
    "ProFoot AI est un outil d'analyse statistique du football. L'achat donne acces a l'outil pour une duree",
    "determinee : paiement unique, sans renouvellement automatique. Aucune analyse ne garantit un resultat.",
]:
    c.drawString(M, y, ligne)
    y -= 4.5 * mm

c.setFillColor(VERT)
c.setFont("Helvetica-Bold", 9)
c.drawString(M, y - 2 * mm, "profootai.com")

c.showPage()
c.save()
print("  PDF cree : ProFoot-AI-Guide-Acces.pdf")
