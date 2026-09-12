import type { DonneesAffiche } from '@/lib/affiche-du-jour';

/**
 * LE DESSIN DE L'AFFICHE DU JOUR.
 *
 * Séparé de la route pour une raison pratique : le script de contrôle
 * (`scripts/_apercu-affiche.mts`) produit une image avec EXACTEMENT ce dessin,
 * sans session ni navigateur. Ce qu'on vérifie est donc ce qui sera servi.
 *
 * ── CE QUI EST INTERDIT ICI ──────────────────────────────────────────────
 *
 * Aucun score, aucun pronostic, aucun résultat, aucun gain, aucun taux. Ce
 * fichier ne reçoit d'ailleurs que `DonneesAffiche`, qui ne contient rien de
 * tout cela. Les textes composés ici repassent le contrôle de
 * `verifierConformite` avant que l'image ne soit produite.
 *
 * ── SATORI, PAS UN NAVIGATEUR ────────────────────────────────────────────
 *
 * Le moteur d'image ne connaît qu'un sous-ensemble de CSS : `display: flex`
 * partout, pas de grille, pas de `gap` hérité par magie — tout est posé
 * explicitement. Et aucune emoji : la police embarquée n'en contient pas, une
 * emoji s'afficherait en carré vide. Le ballon est donc dessiné.
 */

export const VERT = '#10b981';
const VERT_SOMBRE = '#059669';
const FOND = '#070d18';
const FOND_CARTE = 'rgba(255,255,255,0.04)';
const BORDURE = 'rgba(16,185,129,0.28)';
const TEXTE = '#e8f0f8';
const TEXTE_DOUX = '#9fb3c8';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 12 septembre 2026 » */
export function dateEnFrancais(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  if (!a || !m || !j) return jour;
  return `${j} ${MOIS[m - 1]} ${a}`;
}

/** Le titre, accordé au nombre. Jamais un résultat : une activité. */
export function titreDe(n: number): string {
  if (n <= 0) return 'Je prépare mes analyses du jour';
  if (n === 1) return "J'ai analysé 1 match aujourd'hui";
  return `J'ai analysé ${n} matchs aujourd'hui`;
}

export const SOUS_TITRE = 'avec ProFoot AI — analyse & statistiques football';
export const TITRE_LISTE = 'Mes matchs analysés';
export const MARQUE = 'ProFoot AI';
export const ADRESSE = 'profootai.com';

/** Un nom d'équipe raccourci pour tenir sur une ligne. */
export const court = (nom: string, max = 18) => (nom.length > max ? `${nom.slice(0, max - 1)}…` : nom);

function Pastille({ texte, fort }: { texte: string; fort?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 26px',
        borderRadius: 999,
        border: `2px solid ${fort ? VERT : BORDURE}`,
        background: fort ? 'rgba(16,185,129,0.14)' : FOND_CARTE,
        color: fort ? VERT : TEXTE,
        fontSize: 34,
      }}
    >
      {texte}
    </div>
  );
}

function Ecusson({ url, taille }: { url: string | null; taille: number }) {
  if (!url)
    return (
      <div
        style={{
          display: 'flex',
          width: taille,
          height: taille,
          borderRadius: taille / 2,
          background: 'rgba(255,255,255,0.07)',
        }}
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} width={taille} height={taille} style={{ objectFit: 'contain' }} alt="" />;
}

/**
 * Une rencontre analysée : deux écussons, deux noms, et le mot « vs ».
 *
 * `aere` grandit les cartes quand il y a peu de matchs : deux rencontres sur
 * une affiche de 1920 pixels de haut laissaient sinon un vide au milieu.
 */
function LigneMatch({ m, taille, aere }: { m: DonneesAffiche['matchs'][number]; taille: number; aere: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: aere ? '34px 30px' : '20px 28px',
        borderRadius: 24,
        background: FOND_CARTE,
        border: '2px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '43%' }}>
        <Ecusson url={m.logoDomicile} taille={taille} />
        <div style={{ display: 'flex', color: TEXTE, fontSize: taille - 14 }}>{court(m.domicile, 20)}</div>
      </div>
      <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: taille - 20 }}>vs</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 20, width: '43%' }}>
        <div style={{ display: 'flex', color: TEXTE, fontSize: taille - 14 }}>{court(m.exterieur, 20)}</div>
        <Ecusson url={m.logoExterieur} taille={taille} />
      </div>
    </div>
  );
}

/** Le ballon de la marque, dessiné : aucune police d'emoji n'est garantie. */
function Ballon({ taille }: { taille: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="21" fill="none" stroke={VERT} strokeWidth="3" />
      <path d="M24 11l7 5-2.7 8.2h-8.6L17 16z" fill={VERT} />
      <path d="M24 37l-6-4 2-5h8l2 5z" fill={VERT_SOMBRE} />
    </svg>
  );
}

/** Tous les textes que l'affiche composera : ce que le contrôle doit relire. */
export function textesDeLAffiche(d: DonneesAffiche): string[] {
  return [
    titreDe(d.analysesDuJour),
    SOUS_TITRE,
    d.matchs.length ? TITRE_LISTE : '',
    MARQUE,
    ADRESSE,
    `${d.prenom} — ${dateEnFrancais(d.jour)}`,
    d.serie > 1 ? `${d.serie} jours d'affilée` : '',
    d.analysesDuMois > 0 ? `${d.analysesDuMois} analyses ce mois-ci` : '',
    d.equipePreferee ? `Club de cœur : ${d.equipePreferee.nom}` : '',
  ].filter(Boolean);
}

export default function AfficheVisuel({
  d,
  logo,
  largeur,
  hauteur,
}: {
  d: DonneesAffiche;
  logo: string | null;
  largeur: number;
  hauteur: number;
}) {
  const story = hauteur > largeur;
  const matchs = d.matchs.slice(0, story ? 5 : 3);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: largeur,
        height: hauteur,
        background: `linear-gradient(160deg, ${FOND} 0%, #0c1626 55%, #071a14 100%)`,
        padding: story ? '96px 72px' : '64px 64px',
        justifyContent: 'space-between',
      }}
    >
      {/* La marque, en haut : c'est elle qui voyage de statut en statut. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: story ? 44 : 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={92} height={92} style={{ borderRadius: 22 }} alt="" />
          ) : (
            <Ballon taille={92} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: TEXTE, fontSize: 46 }}>{MARQUE}</div>
            <div style={{ display: 'flex', color: VERT, fontSize: 30 }}>{ADRESSE}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: 34 }}>
            {d.prenom} — {dateEnFrancais(d.jour)}
          </div>
          {/* Le titre seul, sans icône : le ballon de la marque est déjà en
              haut, et deux ballons sur la même affiche font brouillon. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              color: TEXTE,
              fontSize: story ? 78 : 58,
              lineHeight: 1.12,
              maxWidth: largeur - 140,
            }}
          >
            {titreDe(d.analysesDuJour)}
          </div>
          <div style={{ display: 'flex', color: VERT, fontSize: story ? 38 : 32 }}>{SOUS_TITRE}</div>
        </div>

        {/* L'engagement, en pastilles : des faits d'activité, rien d'autre. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          {d.serie > 1 ? <Pastille fort texte={`${d.serie} jours d'affilée`} /> : null}
          {d.equipePreferee ? <Pastille texte={`Club de cœur : ${court(d.equipePreferee.nom, 20)}`} /> : null}
          {d.analysesDuMois > 0 ? <Pastille texte={`${d.analysesDuMois} analyses ce mois-ci`} /> : null}
        </div>
      </div>

      {/* Les affiches analysées : les deux équipes, et rien de plus.
          `flex: 1` et un centrage vertical : avec deux matchs comme avec cinq,
          l'affiche reste équilibrée au lieu de laisser un trou au milieu. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          // Vers le haut, et non centré : sur un statut WhatsApp, le bas de
          // l'écran est recouvert par l'interface de l'application. Mieux vaut
          // que l'espace libre soit là, et le contenu bien visible au-dessus.
          justifyContent: 'flex-start',
          flex: 1,
          gap: 18,
          paddingTop: story ? 56 : 28,
        }}
      >
        {matchs.length ? <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: 30 }}>{TITRE_LISTE}</div> : null}
        {matchs.map((m, i) => (
          <LigneMatch key={i} m={m} taille={story ? 58 : 50} aere={story && matchs.length <= 3} />
        ))}
      </div>

      {/* Le pied : la marque une seconde fois, pour qui ne lit que le bas. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `2px solid ${BORDURE}`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: 'flex', color: TEXTE, fontSize: 34 }}>{MARQUE}</div>
        <div style={{ display: 'flex', color: VERT, fontSize: 34 }}>{ADRESSE}</div>
      </div>
    </div>
  );
}
