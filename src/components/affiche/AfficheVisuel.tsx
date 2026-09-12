import type { DonneesAffiche } from '@/lib/affiche-du-jour';

/**
 * LE DESSIN DE L'AFFICHE DU JOUR.
 *
 * ── CE QUE LA PREMIÈRE VERSION RATAIT (refusée le 12 septembre 2026) ─────
 *
 * Elle empilait des lignes de texte à gauche sur un fond sombre : pas de
 * hiérarchie, des pastilles de largeurs différentes, des noms d'équipes qui
 * passaient à la ligne, et un tiers de l'affiche vide en bas. « Ce n'est pas
 * aligné, il y a des parties qui ratent. » C'était juste.
 *
 * ── CE QUI TIENT L'AFFICHE MAINTENANT ───────────────────────────────────
 *
 * Une grille stricte, et une seule idée par bande :
 *
 *   1. bandeau de marque   — logo, nom, adresse ;
 *   2. le CHIFFRE          — énorme, c'est le sujet de l'affiche ;
 *   3. trois cases égales  — série, mois, club de cœur, même largeur, même
 *                            hauteur, toujours trois (un tiret si vide) ;
 *   4. les rencontres      — cartes de hauteur identique, écusson-nom à
 *                            gauche, « vs » au centre exact, nom-écusson à
 *                            droite, jamais de retour à la ligne ;
 *   5. bande de pied       — l'adresse, en vert, sur toute la largeur.
 *
 * Tout part de la même marge (`MARGE`) et suit la même échelle d'espaces. Les
 * bandes 3 et 4 remplissent la hauteur restante : plus de trou.
 *
 * ── CE QUI EST INTERDIT ICI ──────────────────────────────────────────────
 *
 * Aucun score, aucun pronostic, aucun résultat, aucun gain, aucun taux. Ce
 * fichier ne reçoit d'ailleurs que `DonneesAffiche`, qui ne contient rien de
 * tel, et `verifierConformite` relit tous les textes avant la production.
 *
 * ── SATORI, PAS UN NAVIGATEUR ────────────────────────────────────────────
 *
 * `display: flex` partout, pas de grille CSS, pas d'emoji (la police embarquée
 * n'en a pas : elles sortiraient en carrés vides). Les noms sont raccourcis à
 * la main, faute de `text-overflow` fiable.
 */

const VERT = '#10b981';
const VERT_CLAIR = '#34d399';
const FOND = '#050b14';
const FOND_CARTE = '#0e1a26';
const BORDURE = 'rgba(255,255,255,0.07)';
const TEXTE = '#f2f7fb';
const TEXTE_DOUX = '#8ea3b8';

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

/** Ce qui accompagne le grand chiffre. */
export function libelleDuChiffre(n: number): string {
  if (n <= 0) return 'analyse en préparation';
  return n === 1 ? 'match analysé aujourd’hui' : 'matchs analysés aujourd’hui';
}

export const SOUS_TITRE = 'analyse & statistiques football';
/** L'appel du bas : ce que le lecteur doit retenir, en mots autorisés. */
export const APPEL = 'Analyse tes matchs sur profootai.com';
export const TITRE_LISTE = 'Mes matchs analysés';
export const MARQUE = 'ProFoot AI';
export const ADRESSE = 'profootai.com';

/** Un nom d'équipe raccourci : il doit tenir sur UNE ligne, toujours. */
export const court = (nom: string, max: number) => {
  const propre = String(nom).trim();
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
};

/**
 * Une case de la rangée d'engagement : toutes de la même largeur, et surtout
 * toutes de la même HAUTEUR. La valeur tient sur une ligne — un « FC
 * Barcelone » qui passait à la ligne décalait son libellé et faisait boiter
 * toute la rangée.
 */
function Case({ valeur, libelle, accent }: { valeur: string; libelle: string; accent?: boolean }) {
  const police = valeur.length > 11 ? 30 : valeur.length > 8 ? 36 : 44;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        height: 148,
        padding: '0 24px',
        borderRadius: 24,
        background: accent ? 'rgba(16,185,129,0.10)' : FOND_CARTE,
        border: `2px solid ${accent ? 'rgba(16,185,129,0.35)' : BORDURE}`,
      }}
    >
      <div style={{ display: 'flex', color: accent ? VERT_CLAIR : TEXTE, fontSize: police }}>{valeur}</div>
      <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: 24, marginTop: 10 }}>{libelle}</div>
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
          background: 'rgba(255,255,255,0.06)',
        }}
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} width={taille} height={taille} style={{ objectFit: 'contain' }} alt="" />;
}

/**
 * Une rencontre : écusson + nom à gauche, « vs » au centre EXACT, nom +
 * écusson à droite. Trois colonnes de largeurs fixes — c'est ce qui fait que
 * toutes les cartes se ressemblent, quelle que soit la longueur des noms.
 */
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
        height: hauteur,
        padding: '0 30px',
        borderRadius: 24,
        background: FOND_CARTE,
        border: `2px solid ${BORDURE}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '45%' }}>
        <Ecusson url={m.logoDomicile} taille={ecusson} />
        <div style={{ display: 'flex', color: TEXTE, fontSize: police }}>{court(m.domicile, maxNom)}</div>
      </div>
      {/* Colonne étroite : chaque pixel pris ici est un caractère de moins
          pour les noms d'équipes, qui se faisaient couper. */}
      <div style={{ display: 'flex', width: '10%', justifyContent: 'center' }}>
        <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: police - 8 }}>vs</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 18, width: '45%' }}>
        <div style={{ display: 'flex', color: TEXTE, fontSize: police }}>{court(m.exterieur, maxNom)}</div>
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
    SOUS_TITRE,
    d.matchs.length ? TITRE_LISTE : '',
    MARQUE,
    ADRESSE,
    `${d.prenom} · ${dateEnFrancais(d.jour)}`,
    `${d.serie}`,
    d.serie > 1 ? 'jours d’affilée' : 'jour d’analyse',
    `${d.analysesDuMois}`,
    'analyses ce mois-ci',
    d.equipePreferee ? d.equipePreferee.nom : '—',
    'club de cœur',
    APPEL,
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
  const MARGE = 72;
  // Le carré est deux fois moins haut : deux rencontres y tiennent, pas trois.
  // Au-delà, le contenu passait sous la bande verte.
  const matchs = d.matchs.slice(0, story ? 4 : 2);

  // Une seule échelle, déclinée pour les deux formats : c'est ce qui donne
  // l'impression que tout est à sa place.
  const e = story
    ? { chiffre: 260, libelle: 41, prenom: 30, marque: 44, adresse: 30, carte: 134, ecusson: 62, nom: 36, maxNom: 16, titre: 29 }
    : { chiffre: 180, libelle: 33, prenom: 26, marque: 40, adresse: 26, carte: 106, ecusson: 52, nom: 31, maxNom: 17, titre: 25 };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: largeur,
        height: hauteur,
        // Un fond qui respire : presque noir en haut, un souffle de vert en
        // bas, du côté de la bande de marque.
        backgroundImage: `linear-gradient(165deg, ${FOND} 0%, #071320 58%, #06160f 100%)`,
        backgroundColor: FOND,
        color: TEXTE,
      }}
    >
      {/* 1 — BANDEAU DE MARQUE, sur toute la largeur. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: `${story ? 60 : 44}px ${MARGE}px`,
          borderBottom: `2px solid ${BORDURE}`,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={78} height={78} alt="" />
        ) : (
          <div style={{ display: 'flex', width: 78, height: 78, borderRadius: 39, background: 'rgba(16,185,129,0.2)' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: TEXTE, fontSize: e.marque }}>{MARQUE}</div>
          <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: e.adresse - 2 }}>{SOUS_TITRE}</div>
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', color: VERT, fontSize: e.adresse }}>{ADRESSE}</div>
      </div>

      {/* Tout le corps, entre le bandeau et la bande de pied.
          Rythme SERRÉ et non réparti : avec « space-between », deux vides de
          trois cents pixels s'ouvraient entre les bandes. Ici les blocs se
          suivent, et l'espace restant est pris par l'appel du bas. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: `${story ? 52 : 38}px ${MARGE}px ${story ? 44 : 34}px`,
          gap: story ? 44 : 30,
          // Centré : avec deux rencontres, le contenu n'occupe pas toute la
          // hauteur d'un format story. Réparti en haut et en bas, l'espace
          // libre se lit comme une marge ; accumulé d'un seul côté, il se lit
          // comme un oubli.
          justifyContent: 'center',
        }}
      >
        {/* 2 — LE CHIFFRE : le sujet de l'affiche, lisible à bout de bras. */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: e.prenom, marginBottom: 14 }}>
            {d.prenom} · {dateEnFrancais(d.jour)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26 }}>
            {/* Le chiffre, posé sur un halo : c'est le point où l'œil tombe
                quand l'affiche défile dans un statut. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0) 68%)',
                padding: '0 34px',
                marginLeft: -34,
              }}
            >
              <div style={{ display: 'flex', color: VERT, fontSize: e.chiffre, lineHeight: 0.9 }}>
                {d.analysesDuJour}
              </div>
            </div>
            <div style={{ display: 'flex', color: TEXTE, fontSize: e.libelle, paddingBottom: 22, maxWidth: largeur * 0.52 }}>
              {libelleDuChiffre(d.analysesDuJour)}
            </div>
          </div>
        </div>

        {/* 3 — TROIS CASES DE MÊME LARGEUR. Toujours trois : une affiche dont
            la rangée change de forme selon les comptes paraît bancale. */}
        <div style={{ display: 'flex', gap: 20 }}>
          <Case
            accent={d.serie > 1}
            valeur={String(d.serie)}
            libelle={d.serie > 1 ? 'jours d’affilée' : 'jour d’analyse'}
          />
          <Case valeur={String(d.analysesDuMois)} libelle="analyses ce mois-ci" />
          <Case valeur={d.equipePreferee ? court(d.equipePreferee.nom, 12) : '—'} libelle="club de cœur" />
        </div>

        {/* 4 — LES RENCONTRES, cartes de hauteur identique. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {matchs.length ? (
            <div style={{ display: 'flex', color: TEXTE_DOUX, fontSize: e.titre, marginBottom: 4 }}>{TITRE_LISTE}</div>
          ) : null}
          {matchs.map((m, i) => (
            <Rencontre key={i} m={m} hauteur={e.carte} ecusson={e.ecusson} police={e.nom} maxNom={e.maxNom} />
          ))}
        </div>

        {/* 5 — L'APPEL, sur toute la largeur : ce que le lecteur doit retenir.
            Seulement en format story : sur le carré, deux fois moins haut, la
            bande verte du bas porte déjà l'adresse et l'appel débordait. */}
        {story ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 116,
              borderRadius: 24,
              border: `2px solid rgba(16,185,129,0.35)`,
              background: 'rgba(16,185,129,0.08)',
            }}
          >
            <div style={{ display: 'flex', color: VERT_CLAIR, fontSize: 36 }}>{APPEL}</div>
          </div>
        ) : null}
      </div>

      {/* 5 — BANDE DE PIED : l'adresse en grand, c'est elle qui doit rester. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: story ? 132 : 108,
          background: VERT,
        }}
      >
        <div style={{ display: 'flex', color: '#04120c', fontSize: story ? 44 : 38 }}>{ADRESSE}</div>
      </div>
    </div>
  );
}
