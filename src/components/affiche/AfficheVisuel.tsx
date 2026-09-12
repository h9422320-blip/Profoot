import type { DonneesAffiche } from '@/lib/affiche-du-jour';

/**
 * LE DESSIN DE L'AFFICHE DU JOUR.
 *
 * ── DEUX VERSIONS REFUSÉES, ET CE QU'ELLES RATAIENT ──────────────────────
 *
 * La première empilait des lignes de texte à gauche : pas de hiérarchie, des
 * pastilles de largeurs différentes, un tiers de l'affiche vide. La seconde
 * était propre et alignée, mais restait terne — « c'est toujours moche ».
 *
 * La cause, trouvée au troisième essai : le moteur d'image n'embarque QUE
 * Geist Regular. Tout sortait en graisse normale, titres compris. Aucune
 * mise en page ne sauve une affiche où rien ne peut ressortir.
 *
 * ── CE QUI FAIT L'AFFICHE MAINTENANT ─────────────────────────────────────
 *
 *   • LES POLICES DE LA MARQUE, chargées pour de bon (`polices-affiche.ts`) :
 *     Outfit 900 pour la marque, le chiffre et les capitales ; Inter pour le
 *     texte. Exactement celles du site.
 *   • UN CHIFFRE GÉANT, qui occupe le tiers de la hauteur. Sur un statut qui
 *     défile, c'est lui qu'on voit — pas une phrase.
 *   • DES CAPITALES ESPACÉES en vert pour les intitulés : c'est ce qui donne
 *     l'allure « affiche » plutôt que « tableau de bord ».
 *   • DES ÉCUSSONS GRANDS. Ce sont les seuls éléments graphiques dont on
 *     dispose : autant s'en servir.
 *   • UNE BANDE VERTE PLEINE LARGEUR en pied, avec l'adresse : ce qui doit
 *     rester quand on a fait défiler.
 *
 * ── CE QUI EST INTERDIT ICI ──────────────────────────────────────────────
 *
 * Aucun score, aucun pronostic, aucun résultat, aucun gain, aucun taux. Ce
 * fichier ne reçoit que `DonneesAffiche`, qui n'en contient pas, et
 * `verifierConformite` relit tous les textes avant production.
 *
 * ── SATORI, PAS UN NAVIGATEUR ────────────────────────────────────────────
 *
 * `display: flex` partout, pas de grille CSS, pas d'emoji (aucune police n'en
 * porte ici : elles sortiraient en carrés vides), et les noms sont raccourcis
 * à la main faute de `text-overflow` fiable.
 */

const VERT = '#12d18a';
const VERT_SOMBRE = '#0b7d55';
const FOND = '#03080e';
const CARTE = 'rgba(255,255,255,0.045)';
const BORDURE = 'rgba(255,255,255,0.09)';
const BLANC = '#ffffff';
const DOUX = '#93a7bb';

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

/** Le titre en toutes lettres, conservé pour le contrôle de conformité. */
export function titreDe(n: number): string {
  if (n <= 0) return 'Je prépare mes analyses du jour';
  if (n === 1) return "J'ai analysé 1 match aujourd'hui";
  return `J'ai analysé ${n} matchs aujourd'hui`;
}

/** Ce qui accompagne le grand chiffre, en capitales sur l'affiche. */
export function libelleDuChiffre(n: number): string {
  if (n <= 0) return 'analyse en préparation';
  return n === 1 ? 'match analysé' : 'matchs analysés';
}

export const SURTITRE = 'mon activité du jour';
export const SOUS_TITRE = 'analyse & statistiques football';
export const APPEL = 'Analyse tes matchs sur profootai.com';
export const TITRE_LISTE = 'mes matchs analysés';
export const MARQUE = 'ProFoot AI';
export const ADRESSE = 'profootai.com';

/** Un nom d'équipe raccourci : il doit tenir sur UNE ligne, toujours. */
export const court = (nom: string, max: number) => {
  const propre = String(nom).trim();
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
};

const CAPITALES = (x: string) => x.toUpperCase();

/** Une petite capitale verte espacée : l'intitulé d'une section. */
function Intitule({ texte, taille }: { texte: string; taille: number }) {
  return (
    <div
      style={{
        display: 'flex',
        color: VERT,
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: taille,
        letterSpacing: taille * 0.22,
      }}
    >
      {CAPITALES(texte)}
    </div>
  );
}

/** Une pastille d'engagement : chiffre en vert, mot en gris. */
function Pastille({ valeur, libelle, taille }: { valeur: string; libelle: string; taille: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: `${taille * 0.42}px ${taille * 0.7}px`,
        borderRadius: 999,
        background: CARTE,
        border: `2px solid ${BORDURE}`,
      }}
    >
      <div style={{ display: 'flex', color: VERT, fontFamily: 'Outfit', fontWeight: 900, fontSize: taille }}>
        {valeur}
      </div>
      <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: taille * 0.82 }}>
        {libelle}
      </div>
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

/** Une rencontre : trois colonnes fixes, pour que toutes les cartes se ressemblent. */
function Rencontre({
  m,
  hauteur,
  ecusson,
  police,
  maxNom,
}: {
  m: DonneesAffiche['matchs'][number];
  hauteur: number;
  ecusson: number;
  police: number;
  maxNom: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        // Hauteur FIXE, calculée selon le nombre de rencontres : une carte qui
        // s'étire pour combler l'affiche sonne creux, le contenu flotte au
        // milieu d'un grand rectangle vide.
        height: hauteur,
        padding: '0 34px',
        borderRadius: 26,
        background: CARTE,
        border: `2px solid ${BORDURE}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, width: '45%' }}>
        <Ecusson url={m.logoDomicile} taille={ecusson} />
        <div style={{ display: 'flex', color: BLANC, fontFamily: 'Inter', fontWeight: 600, fontSize: police }}>
          {court(m.domicile, maxNom)}
        </div>
      </div>
      <div style={{ display: 'flex', width: '10%', justifyContent: 'center' }}>
        <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: police - 10 }}>
          vs
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 22, width: '45%' }}>
        <div style={{ display: 'flex', color: BLANC, fontFamily: 'Inter', fontWeight: 600, fontSize: police }}>
          {court(m.exterieur, maxNom)}
        </div>
        <Ecusson url={m.logoExterieur} taille={ecusson} />
      </div>
    </div>
  );
}

/** Tous les textes que l'affiche composera : ce que le contrôle doit relire. */
export function textesDeLAffiche(d: DonneesAffiche): string[] {
  return [
    titreDe(d.analysesDuJour),
    libelleDuChiffre(d.analysesDuJour),
    SURTITRE,
    SOUS_TITRE,
    d.matchs.length ? TITRE_LISTE : '',
    MARQUE,
    ADRESSE,
    APPEL,
    `${d.prenom} · ${dateEnFrancais(d.jour)}`,
    `${d.serie}`,
    d.serie > 1 ? 'jours d’affilée' : 'jour d’analyse',
    `${d.analysesDuMois}`,
    'analyses ce mois-ci',
    d.equipePreferee ? d.equipePreferee.nom : '',
    d.equipePreferee ? 'club de cœur' : '',
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
  const MARGE = story ? 84 : 64;
  const matchs = d.matchs.slice(0, story ? 3 : 2);

  const e = story
    ? { chiffre: 400, libelle: 72, surtitre: 26, marque: 50, date: 30, pastille: 34, carte: 132, ecusson: 72, nom: 34, maxNom: 14, intitule: 24, pied: 52 }
    : { chiffre: 230, libelle: 44, surtitre: 20, marque: 40, date: 24, pastille: 26, carte: 104, ecusson: 56, nom: 29, maxNom: 15, intitule: 19, pied: 40 };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: largeur,
        height: hauteur,
        backgroundColor: FOND,
        // Deux halos : un vert en haut à droite, un plus sourd en bas à
        // gauche. C'est ce qui empêche le fond de paraître mort.
        backgroundImage: `radial-gradient(900px 900px at 88% 6%, rgba(18,209,138,0.20) 0%, rgba(18,209,138,0) 60%), radial-gradient(800px 800px at 4% 96%, rgba(11,125,85,0.22) 0%, rgba(11,125,85,0) 62%)`,
        fontFamily: 'Inter',
      }}
    >
      {/* ── LA MARQUE, EN HAUT ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${story ? 64 : 46}px ${MARGE}px 0`,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={story ? 76 : 60} height={story ? 76 : 60} alt="" />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 20 }}>
          <div
            style={{
              display: 'flex',
              color: BLANC,
              fontFamily: 'Outfit',
              fontWeight: 900,
              fontSize: e.marque,
              letterSpacing: -1,
            }}
          >
            {CAPITALES(MARQUE)}
          </div>
          <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: e.date * 0.8 }}>
            {SOUS_TITRE}
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: e.date }}>
          {dateEnFrancais(d.jour)}
        </div>
      </div>

      {/* ── LE CHIFFRE : le sujet de l'affiche ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: `${story ? 72 : 40}px ${MARGE}px 0`,
        }}
      >
        <Intitule texte={SURTITRE} taille={e.surtitre} />
        <div
          style={{
            display: 'flex',
            color: BLANC,
            fontFamily: 'Outfit',
            fontWeight: 900,
            fontSize: e.chiffre,
            lineHeight: 0.86,
            marginTop: story ? 18 : 10,
          }}
        >
          {d.analysesDuJour}
        </div>
        <div
          style={{
            display: 'flex',
            color: VERT,
            fontFamily: 'Outfit',
            fontWeight: 900,
            fontSize: e.libelle,
            letterSpacing: -0.5,
            marginTop: story ? 6 : 2,
          }}
        >
          {CAPITALES(libelleDuChiffre(d.analysesDuJour))}
        </div>
        <div
          style={{
            display: 'flex',
            color: DOUX,
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: e.date * 0.84,
            letterSpacing: e.date * 0.12,
            marginTop: story ? 24 : 14,
          }}
        >
          {CAPITALES('par ' + d.prenom)}
        </div>
      </div>

      {/* ── L'ENGAGEMENT, en pastilles alignées ──────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: `${story ? 44 : 26}px ${MARGE}px 0` }}>
        <Pastille
          valeur={String(d.serie)}
          libelle={d.serie > 1 ? 'jours d’affilée' : 'jour d’analyse'}
          taille={e.pastille}
        />
        <Pastille valeur={String(d.analysesDuMois)} libelle="analyses ce mois-ci" taille={e.pastille} />
        {d.equipePreferee ? (
          <Pastille valeur={court(d.equipePreferee.nom, 14)} libelle="club de cœur" taille={e.pastille} />
        ) : null}
      </div>

      {/* ── LES RENCONTRES ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          padding: `${story ? 52 : 30}px ${MARGE}px 0`,
        }}
      >
        {matchs.length ? <Intitule texte={TITRE_LISTE} taille={e.intitule} /> : null}
        {matchs.map((m, i) => (
          <Rencontre
            key={i}
            m={m}
            // Deux rencontres : des cartes généreuses. Trois ou quatre : elles
            // se resserrent pour que tout tienne au-dessus de la bande verte.
            hauteur={matchs.length >= 3 ? e.carte : Math.round(e.carte * 1.32)}
            ecusson={e.ecusson}
            police={e.nom}
            maxNom={e.maxNom}
          />
        ))}
      </div>

      {/* L'espace qui reste tombe entre les rencontres et l'appel. */}
      <div style={{ display: 'flex', flex: 1, minHeight: story ? 40 : 22 }} />

      {/* ── L'APPEL, juste au-dessus de la bande de pied ─────────────────── */}
      {story ? (
        <div style={{ display: 'flex', padding: `0 ${MARGE}px ${44}px` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: 116,
              borderRadius: 26,
              border: `2px solid rgba(18,209,138,0.38)`,
              background: 'rgba(18,209,138,0.09)',
            }}
          >
            <div style={{ display: 'flex', color: VERT, fontFamily: 'Inter', fontWeight: 600, fontSize: 36 }}>
              {APPEL}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── LA BANDE DE PIED : ce qui doit rester ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: story ? 150 : 118,
          background: VERT,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: '#02160e',
            fontFamily: 'Outfit',
            fontWeight: 900,
            fontSize: e.pied,
            letterSpacing: 1,
          }}
        >
          {CAPITALES(ADRESSE)}
        </div>
      </div>
    </div>
  );
}
