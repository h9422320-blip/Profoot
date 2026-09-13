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

/**
 * ── CE QUI DONNE ENVIE DE PARTAGER, ET CE QUI N'EN DONNAIT AUCUNE ────────
 *
 * La version précédente annonçait « 4 » en géant — le nombre d'analyses de la
 * personne — au-dessus d'une liste de 3 rencontres. Deux sujets à la fois,
 * deux chiffres qui se contredisent, et surtout aucune raison de montrer ça à
 * quelqu'un : personne ne se vante d'avoir ouvert quatre pages.
 *
 * Ce qui se partage, dans le football, c'est SAVOIR QUELQUE CHOSE. « Voilà les
 * rencontres sur lesquelles l'IA voit clair ce soir » est une information que
 * l'on montre ; « j'ai analysé quatre matchs » n'en est pas une.
 *
 * Et ce qui se partage ENCORE mieux, c'est ce qui appelle une réponse. Une
 * affiche qui pose une question au lecteur transforme un statut muet en
 * conversation — et c'est la conversation qui amène les amis sur le site.
 *
 * Le grand chiffre compte donc désormais LES RENCONTRES MONTRÉES. Il ne peut
 * plus dire 4 pendant que la liste en affiche 3.
 */
export const SURTITRE_CERNES = 'aujourd’hui, l’IA voit clair sur';

/** Le libellé du grand chiffre quand l'affiche porte les rencontres du jour. */
export function libelleCernes(n: number): string {
  return n === 1 ? 'match décrypté' : 'matchs décryptés';
}

/**
 * LA QUESTION. C'est elle qui fait poster.
 *
 * Un statut qui affirme se regarde ; un statut qui demande reçoit des
 * réponses. « Et toi, tu en penses quoi ? » est une invitation à répondre —
 * et chaque réponse est une conversation qui finit sur profootai.com.
 *
 * Aucun mot interdit : ni pronostic, ni vainqueur, ni taux. On demande un
 * avis, on n'annonce rien.
 */
export const QUESTION = 'Et toi, tu en penses quoi ?';
export const SOUS_TITRE = 'analyse & statistiques football';
/**
 * L'appel, sous la question.
 *
 * « Analyse tes matchs sur profootai.com » était une consigne d'emploi. Celui
 * qui regarde un statut ne veut pas d'une consigne : il veut savoir ce que
 * l'autre a vu. On lui dit donc où le voir.
 */
export const APPEL = 'Mon analyse complète est sur profootai.com';
export const TITRE_LISTE = 'mes matchs analysés';

/**
 * L'intitulé de la section qui rend l'affiche partageable.
 *
 * « Les mieux cernés » et non « les plus sûrs » : la seconde formule se lit
 * comme celle d'une maison de jeu, et ce projet a déjà perdu une boutique sur
 * un contrôle « produits interdits : paris sportifs ». Formule choisie par le
 * propriétaire le 4 septembre 2026, reprise ici mot pour mot.
 */
export const TITRE_CERNES = 'les mieux cernés aujourd’hui';
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
        {/* L'heure remplace le « vs » quand on la connaît : sur une affiche du
            soir, c'est le renseignement que le lecteur cherche — à quelle heure
            ça commence — et il ne coûte pas une ligne de plus. */}
        <div
          style={{
            display: 'flex',
            color: m.heure ? VERT : DOUX,
            fontFamily: 'Inter',
            fontWeight: m.heure ? 600 : 400,
            fontSize: police - (m.heure ? 6 : 10),
          }}
        >
          {m.heure || 'vs'}
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
  const cernes = d.mieuxCernes ?? [];
  const surLesCernes = cernes.length > 0;
  return [
    titreDe(d.analysesDuJour),
    surLesCernes ? libelleCernes(cernes.length) : libelleDuChiffre(d.analysesDuJour),
    surLesCernes ? SURTITRE_CERNES : SURTITRE,
    SOUS_TITRE,
    d.matchs.length ? TITRE_LISTE : '',
    surLesCernes ? TITRE_CERNES : '',
    // Les heures composées sur les cartes : elles passent le contrôle comme le
    // reste, même si un « 21:00 » ne peut rien enfreindre.
    ...cernes.map((m) => m.heure ?? '').filter(Boolean),
    QUESTION,
    MARQUE,
    ADRESSE,
    APPEL,
    dateEnFrancais(d.jour),
    // La signature, telle qu'elle est composée.
    d.prenom,
    `${d.analysesDuMois} analyses ce mois-ci`,
    d.serie > 1 ? `${d.serie} jours d'affilée` : '',
    d.equipePreferee ? d.equipePreferee.nom : '',
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

  // ── CE QUE L'AFFICHE MONTRE, ET POURQUOI CE CHOIX ────────────────────────
  //
  // Les rencontres du jour les mieux cernées passent AVANT les matchs que
  // l'abonné a analysés. Un bulletin d'activité — « j'ai analysé cinq matchs,
  // les voici » — ne fait rien demander à personne. Les affiches du soir, si :
  // elles font écrire « et alors, qui gagne ? », et c'est cette question qui
  // envoie les amis sur profootai.com. L'affiche devient du contenu qu'on
  // montre, et plus seulement un relevé personnel.
  //
  // Les matchs personnels restent le repli : sans sélection du jour, l'affiche
  // ne doit pas se retrouver amputée de sa moitié basse.
  const cernes = (d.mieuxCernes ?? []).slice(0, story ? 3 : 2);

  // UN SEUL SUJET, UN SEUL CHIFFRE. Le grand nombre compte exactement les
  // rencontres montrées en dessous : il annonçait 4 analyses au-dessus d'une
  // liste de 3 matchs, et l'affiche se contredisait à la première lecture.
  const surLesCernes = cernes.length > 0;
  const matchs = surLesCernes ? cernes : d.matchs.slice(0, story ? 3 : 2);
  const titreDeLaListe = surLesCernes ? TITRE_CERNES : TITRE_LISTE;
  const grandChiffre = surLesCernes ? matchs.length : d.analysesDuJour;
  const grandLibelle = surLesCernes ? libelleCernes(matchs.length) : libelleDuChiffre(d.analysesDuJour);
  const grandSurtitre = surLesCernes ? SURTITRE_CERNES : SURTITRE;

  // La signature : qui a produit cette affiche, en UNE ligne discrète. Elle
  // remplace trois pastilles qui prenaient le quart de la hauteur pour dire ce
  // qui n'intéresse que son auteur.
  const signature = [
    d.prenom,
    `${d.analysesDuMois} analyses ce mois-ci`,
    d.serie > 1 ? `${d.serie} jours d'affilée` : '',
  ].filter(Boolean).join('  ·  ');

  const e = story
    ? { chiffre: 400, libelle: 72, surtitre: 26, marque: 50, date: 30, pastille: 34, carte: 132, ecusson: 72, nom: 30, maxNom: 18, intitule: 24, pied: 52 }
    : { chiffre: 230, libelle: 44, surtitre: 20, marque: 40, date: 24, pastille: 26, carte: 104, ecusson: 56, nom: 26, maxNom: 17, intitule: 19, pied: 40 };

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
        <Intitule texte={grandSurtitre} taille={e.surtitre} />
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
          {grandChiffre}
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
          {CAPITALES(grandLibelle)}
        </div>
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
        {matchs.length && !surLesCernes ? <Intitule texte={titreDeLaListe} taille={e.intitule} /> : null}
        {matchs.map((m, i) => (
          <Rencontre
            key={i}
            m={m}
            // Deux rencontres : des cartes généreuses. Trois ou quatre : elles
            // se resserrent pour que tout tienne au-dessus de la bande verte.
            hauteur={matchs.length >= 3 ? Math.round(e.carte * 1.5) : Math.round(e.carte * 1.7)}
            ecusson={Math.round(e.ecusson * 1.25)}
            police={e.nom}
            maxNom={e.maxNom}
          />
        ))}
      </div>

      {/* L'espace qui reste tombe entre les rencontres et l'appel. */}
      <div style={{ display: 'flex', flex: 1, minHeight: story ? 40 : 22 }} />

      {/* ── LA QUESTION : c'est elle qui fait poster ─────────────────────
          Un statut qui affirme se regarde ; un statut qui demande reçoit des
          réponses, et chaque réponse est une conversation qui finit sur le
          site. C'est le seul élément de l'affiche qui s'adresse à celui qui
          la REGARDE, et non à celui qui la publie. */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: `0 ${MARGE}px ${story ? 30 : 18}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: story ? 136 : 96,
            borderRadius: 28,
            border: `2px solid rgba(18,209,138,0.42)`,
            background: 'rgba(18,209,138,0.10)',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: VERT,
              fontFamily: 'Outfit',
              fontWeight: 900,
              fontSize: story ? 48 : 34,
              letterSpacing: -0.5,
            }}
          >
            {QUESTION}
          </div>
        </div>

        {/* L'appel, en dessous et plus discret : la question passe devant. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            marginTop: story ? 22 : 14,
          }}
        >
          <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: story ? 30 : 22 }}>
            {APPEL}
          </div>
        </div>

        {/* ── LA SIGNATURE : qui publie, en une ligne ────────────────────
            Elle remplace trois pastilles qui mangeaient le quart de la hauteur
            pour dire ce qui n'intéresse que son auteur. Ici elle joue son vrai
            rôle : prouver que celui qui partage est un habitué, pas un
            curieux de passage. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            marginTop: story ? 26 : 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: 'rgba(255,255,255,0.42)',
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: story ? 26 : 19,
              letterSpacing: story ? 1.6 : 1.1,
            }}
          >
            {CAPITALES(signature)}
          </div>
        </div>
      </div>

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
