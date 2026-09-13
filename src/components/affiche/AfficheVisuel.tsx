import type { DonneesAffiche } from '@/lib/affiche-du-jour';

/**
 * LE DESSIN DE L'AFFICHE DU JOUR.
 *
 * ── QUATRE VERSIONS REFUSÉES, ET CE QU'ELLES RATAIENT ────────────────────
 *
 * 1. Des lignes de texte empilées à gauche : aucune hiérarchie, un tiers vide.
 * 2. Propre et alignée, mais terne — le moteur d'image n'embarquait que Geist
 *    Regular : rien ne pouvait ressortir. Corrigé par `polices-affiche.ts`.
 * 3. Un grand chiffre « 4 » (les analyses de la personne) au-dessus d'une
 *    liste de 3 rencontres : deux sujets, deux chiffres qui se contredisent.
 * 4. Un seul sujet enfin — les rencontres du jour — et une question au
 *    lecteur. Correcte, lisible… et le propriétaire a tranché : « ça ne me
 *    fait absolument rien ressentir ».
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI C'EST LE CŒUR DU SUJET ──────────────────
 *
 * Les quatre versions informaient. Aucune n'émouvait. Or on ne partage pas une
 * information sur soi, on partage CE QUI NOUS FLATTE : être nommé, être
 * reconnu, avoir mérité quelque chose. C'est le ressort de Spotify Wrapped,
 * des séries Duolingo et des badges « top fan ».
 *
 * L'affiche est donc devenue UNE CARTE DE RECONNAISSANCE :
 *
 *   • LE PRÉNOM EN GÉANT. Le sujet de l'affiche, c'est la personne — pas un
 *     décompte. C'est ce qui fait dire « ça parle de moi ».
 *   • UN RANG MÉRITÉ, calculé sur l'activité réelle du mois. Un titre qu'on
 *     n'a pas acheté se montre ; un compteur ne se montre pas.
 *   • UNE PHRASE QUI DIT QUI ON EST : « Tu ne devines pas. Tu analyses. »
 *     Elle définit la marque autant que la personne, et elle dit exactement le
 *     contraire du jeu de hasard — ce qui, pour ce projet, n'est pas un détail.
 *   • L'ÉCUSSON DU CLUB DE CŒUR, en grand. L'identité avant les chiffres.
 *   • LES RENCONTRES DU SOIR, en bas : c'est le contenu qui fait écrire aux
 *     amis « et alors ? », et cette question-là ramène sur le site.
 *
 * Le remerciement vient du propriétaire, et il avait raison : une marque qui
 * dit merci à quelqu'un par son nom crée une dette agréable. Mais « merci
 * d'avoir utilisé notre application » est du service client. « MERCI OUSMANE —
 * ANALYSTE D'ÉLITE » est une distinction. C'est la seconde qu'on partage.
 *
 * ── CE QUI EST INTERDIT ICI ──────────────────────────────────────────────
 *
 * Aucun score, aucun pronostic, aucun résultat, aucun gain, aucun taux. Ce
 * fichier ne reçoit que `DonneesAffiche`, qui n'en contient pas, et
 * `verifierConformite` relit tous les textes avant production. Le mot
 * « hasard » lui-même est évité : « jeux de hasard » est la formule exacte du
 * contrôle qui a fermé la boutique en août 2026.
 *
 * ── SATORI, PAS UN NAVIGATEUR ────────────────────────────────────────────
 *
 * `display: flex` partout, pas de grille CSS, pas d'emoji (aucune police n'en
 * porte ici : elles sortiraient en carrés vides), et les textes sont
 * raccourcis à la main faute de `text-overflow` fiable.
 */

const VERT = '#12d18a';
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

/** Ce qui accompagne un décompte d'analyses. */
export function libelleDuChiffre(n: number): string {
  if (n <= 0) return 'analyse en préparation';
  return n === 1 ? 'match analysé' : 'matchs analysés';
}

export const SURTITRE = 'mon activité du jour';
export const SURTITRE_CERNES = 'aujourd’hui, l’IA voit clair sur';

/** Le libellé d'un décompte de rencontres décryptées. */
export function libelleCernes(n: number): string {
  return n === 1 ? 'match décrypté' : 'matchs décryptés';
}

/**
 * ── LE RANG ──────────────────────────────────────────────────────────────
 *
 * Un titre qu'on n'a pas acheté, et qui se montre. C'est toute la différence
 * avec un compteur : « 102 analyses » est une donnée, « ANALYSTE D'ÉLITE » est
 * une distinction — et on ne partage que ce qui nous distingue.
 *
 * Il se calcule sur l'activité du MOIS, donnée que l'affiche possède déjà.
 * Jamais sur la justesse des analyses : ce serait un taux, et c'est interdit
 * ici comme partout sur cette image.
 *
 * Les seuils sont volontairement atteignables. Un rang que personne n'obtient
 * ne flatte personne, et le premier palier doit tomber dès la première
 * semaine — c'est là qu'un nouvel abonné décide s'il revient.
 */
export function rangDe(analysesDuMois: number): string {
  const n = Number(analysesDuMois);
  if (!Number.isFinite(n) || n <= 0) return 'nouvelle recrue';
  if (n >= 100) return 'analyste d’élite';
  if (n >= 50) return 'analyste chevronné';
  if (n >= 20) return 'analyste confirmé';
  if (n >= 5) return 'analyste régulier';
  return 'nouvelle recrue';
}

/**
 * LA PHRASE QUI DÉFINIT LA MARQUE AUTANT QUE LA PERSONNE.
 *
 * Elle dit exactement le contraire du jeu de hasard — c'est la raison d'être
 * de ProFoot AI en cinq mots, et c'est ce qu'un abonné a envie qu'on lise de
 * lui. Aucun mot interdit : on ne promet rien, on décrit une façon de faire.
 */
export const DEVISE = 'Tu ne devines pas. Tu analyses.';

/** Le mot de reconnaissance, au-dessus du prénom. */
export const MERCI = 'merci';

/**
 * LA LIGNE DE PREUVE, celle qui rend le rang crédible.
 *
 * Un titre sans chiffre derrière sonne creux. On prend le fait le plus fort
 * dont on dispose : la série de jours quand elle existe — l'assiduité est la
 * chose la plus difficile à tenir —, sinon le volume du mois.
 */
export function preuveDe(d: DonneesAffiche): string {
  const serie = Number(d.serie) || 0;
  const mois = Number(d.analysesDuMois) || 0;
  if (serie >= 2) return `${serie} jours de suite · ${mois} analyses ce mois-ci`;
  if (mois > 0) return `${mois} analyses ce mois-ci`;
  return 'première analyse';
}

/**
 * ── L'AFFICHE DIT CE QU'ELLE EST ─────────────────────────────────────────
 *
 * Éviter le vocabulaire du pari ne suffit pas : une image qui montre des
 * rencontres et des chiffres sera lue comme une publicité de jeu par un
 * modérateur pressé, quels que soient les mots absents. Il faut donc AFFIRMER
 * la nature du produit, noir sur blanc, sur l'image elle-même.
 *
 * Le sous-titre ne dit plus « analyse & statistiques football » — descriptif,
 * neutre, interprétable. Il dit ce que FAIT l'application : elle analyse des
 * matchs avec une intelligence artificielle.
 *
 * Et une ligne, juste au-dessus de l'adresse, ferme la question :
 * intelligence artificielle, analyse de données, aucun jeu d'argent. Elle est
 * écrite pour deux lecteurs à la fois — le modérateur de TikTok ou
 * d'Instagram, qui décide en trois secondes si l'image fait la promotion
 * d'un jeu, et l'ami qui découvre ProFoot AI par ce partage.
 *
 * Aucun mot interdit ne peut y figurer : « pari » et « mise » sont bannis par
 * le contrôle de conformité, Y COMPRIS pour dire qu'on n'en fait pas. D'où la
 * formule « aucun jeu d'argent », qui dit la même chose et passe le contrôle.
 */
export const SOUS_TITRE = 'analyse de matchs par intelligence artificielle';

/** Ce que l'affiche affirme d'elle-même, en pied. */
export const NATURE = 'intelligence artificielle · analyse de données · aucun jeu d’argent';
export const APPEL = 'Mon analyse complète est sur profootai.com';
export const TITRE_LISTE = 'mes matchs analysés';

/**
 * L'intitulé de la section des rencontres.
 *
 * « Ce soir, je regarde » plutôt qu'un intitulé descriptif : c'est la personne
 * qui parle, pas l'application. Sur un statut, la première personne fait toute
 * la différence entre une publicité et une confidence.
 */
export const TITRE_CERNES = 'ce soir, je regarde';

/**
 * ── LE RÉCAPITULATIF, ET SON INTITULÉ ────────────────────────────────────
 *
 * « Mes analyses face au terrain ». Le terrain est l'arbitre : c'est lui qui
 * tranche, pas nous. La formule dit la confrontation sans emprunter un seul
 * mot au vocabulaire du pari — ni pronostic, ni vainqueur, ni taux.
 *
 * C'est cette section qui donne sa VALEUR à l'affiche. Un rang flatte ; une
 * preuve convainc. « Comme des preuves au fait », dit le propriétaire, et il a
 * raison : personne ne partage un compteur, tout le monde partage une preuve.
 */
export const TITRE_RECAP = 'mes analyses face au terrain';

/** L'en-tête des deux colonnes de la carte comparative. */
export const ANNONCE = 'annoncé';
export const REEL = 'réel';

/**
 * La ligne sous la devise, à la place des compteurs.
 *
 * « 2 jours de suite · 102 analyses ce mois-ci » disait l'assiduité ; le
 * propriétaire l'a retirée le 13 septembre 2026 au profit de ce qui annonce le
 * récapitulatif. Une affiche ne doit préparer qu'une seule chose à la fois.
 */
export function introRecap(n: number): string {
  if (n <= 0) return 'mes analyses, confrontées au terrain';
  if (n === 1) return 'ma dernière analyse, confrontée au terrain';
  return `mes ${n} dernières analyses, confrontées au terrain`;
}

/**
 * LA QUESTION. C'est elle qui transforme un statut en conversation.
 *
 * Un statut qui affirme se regarde ; un statut qui demande reçoit des
 * réponses, et chaque réponse est une conversation qui finit sur le site.
 */
export const QUESTION = 'Et toi, tu en penses quoi ?';

export const MARQUE = 'ProFoot AI';
export const ADRESSE = 'profootai.com';

/** Un texte raccourci : il doit tenir sur UNE ligne, toujours. */
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
        height: hauteur,
        padding: '0 30px',
        borderRadius: 24,
        background: CARTE,
        border: `2px solid ${BORDURE}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '45%' }}>
        <Ecusson url={m.logoDomicile} taille={ecusson} />
        <div style={{ display: 'flex', color: BLANC, fontFamily: 'Inter', fontWeight: 600, fontSize: police }}>
          {court(m.domicile, maxNom)}
        </div>
      </div>
      <div style={{ display: 'flex', width: '10%', justifyContent: 'center' }}>
        {/* L'heure remplace le « vs » quand on la connaît : sur une affiche du
            soir, c'est le renseignement que le lecteur cherche. */}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 20, width: '45%' }}>
        <div style={{ display: 'flex', color: BLANC, fontFamily: 'Inter', fontWeight: 600, fontSize: police }}>
          {court(m.exterieur, maxNom)}
        </div>
        <Ecusson url={m.logoExterieur} taille={ecusson} />
      </div>
    </div>
  );
}

/**
 * UNE RENCONTRE ANALYSÉE, FACE À CE QUI S'EST PASSÉ.
 *
 * Deux étages : les équipes en haut, la confrontation en bas. Sur une carte
 * d'une seule ligne, quatre informations — deux noms et deux scores — se
 * marchaient dessus dès qu'un club portait un nom long.
 *
 * Le cadre du réel passe au vert quand l'issue annoncée était la bonne. C'est
 * le seul signal de justesse de l'affiche, et il porte sur UNE rencontre : on
 * ne totalise rien, on n'affiche aucun taux.
 */
function Comparaison({
  m,
  hauteur,
  ecusson,
  police,
  maxNom,
  chiffre,
  etiquette,
}: {
  m: NonNullable<DonneesAffiche['recap']>[number];
  hauteur: number;
  ecusson: number;
  police: number;
  maxNom: number;
  chiffre: number;
  etiquette: number;
}) {
  const Case = ({ titre, valeur, juste }: { titre: string; valeur: string; juste?: boolean }) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '50%',
        height: '100%',
        borderRadius: 18,
        background: juste ? 'rgba(18,209,138,0.13)' : 'rgba(255,255,255,0.05)',
        border: `2px solid ${juste ? 'rgba(18,209,138,0.45)' : BORDURE}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          color: juste ? VERT : DOUX,
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: etiquette,
          letterSpacing: etiquette * 0.18,
        }}
      >
        {CAPITALES(titre)}
      </div>
      <div
        style={{
          display: 'flex',
          color: juste ? VERT : BLANC,
          fontFamily: 'Outfit',
          fontWeight: 900,
          fontSize: chiffre,
          marginTop: 2,
        }}
      >
        {valeur}
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: hauteur,
        padding: `${Math.round(hauteur * 0.11)}px 26px`,
        borderRadius: 24,
        background: CARTE,
        border: `2px solid ${BORDURE}`,
      }}
    >
      {/* Les deux équipes, sur une ligne. */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Ecusson url={m.logoDomicile} taille={ecusson} />
        <div
          style={{
            display: 'flex',
            color: BLANC,
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: police,
            marginLeft: 14,
          }}
        >
          {court(m.domicile, maxNom)}
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div
          style={{
            display: 'flex',
            color: BLANC,
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: police,
            marginRight: 14,
          }}
        >
          {court(m.exterieur, maxNom)}
        </div>
        <Ecusson url={m.logoExterieur} taille={ecusson} />
      </div>

      {/* L'annoncé et le réel, côte à côte. */}
      <div style={{ display: 'flex', flex: 1, gap: 12, marginTop: Math.round(hauteur * 0.08) }}>
        <Case titre={ANNONCE} valeur={m.annonce} />
        <Case titre={REEL} valeur={m.reel} juste={m.juste} />
      </div>
    </div>
  );
}

/** Tous les textes que l'affiche composera : ce que le contrôle doit relire. */
export function textesDeLAffiche(d: DonneesAffiche): string[] {
  const cernes = d.mieuxCernes ?? [];
  return [
    titreDe(d.analysesDuJour),
    libelleDuChiffre(d.analysesDuJour),
    libelleCernes(cernes.length),
    SURTITRE,
    SURTITRE_CERNES,
    SOUS_TITRE,
    MERCI,
    d.prenom,
    rangDe(d.analysesDuMois),
    DEVISE,
    preuveDe(d),
    cernes.length ? TITRE_CERNES : d.matchs.length ? TITRE_LISTE : '',
    // Les heures composées sur les cartes : elles passent le contrôle comme le
    // reste, même si un « 21:00 » ne peut rien enfreindre.
    ...cernes.map((m) => m.heure ?? '').filter(Boolean),
    NATURE,
    TITRE_RECAP,
    ANNONCE,
    REEL,
    introRecap((d.recap ?? []).length),
    ...(d.recap ?? []).flatMap((m) => [m.annonce, m.reel]),
    QUESTION,
    MARQUE,
    ADRESSE,
    APPEL,
    dateEnFrancais(d.jour),
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
  const MARGE = story ? 78 : 58;

  // Les rencontres du jour passent devant les matchs personnels : ce sont
  // elles qui font écrire « et alors ? » aux amis. Les matchs analysés restent
  // le repli quand la sélection du jour n'est pas disponible.
  // ── L'ORDRE DES PRIORITÉS, ET IL EST VOULU ──────────────────────────────
  //
  // 1. LE RÉCAPITULATIF, quand il existe : l'analyse face à ce qui s'est
  //    passé. C'est la seule chose de cette affiche qui PROUVE quelque chose,
  //    et une preuve se partage bien mieux qu un compteur.
  // 2. Les rencontres du jour, à défaut : elles font demander « et alors ? ».
  // 3. Les matchs analysés, en dernier recours, pour qu une affiche ne sorte
  //    jamais amputée de sa moitié basse.
  const recap = (d.recap ?? []).slice(0, story ? 3 : 2);
  const surLeRecap = recap.length > 0;
  const cernes = (d.mieuxCernes ?? []).slice(0, story ? 3 : 2);
  const surLesCernes = !surLeRecap && cernes.length > 0;
  const matchs = surLesCernes ? cernes : d.matchs.slice(0, story ? 3 : 2);
  const titreDeLaListe = surLeRecap ? TITRE_RECAP : surLesCernes ? TITRE_CERNES : TITRE_LISTE;

  const prenom = court(d.prenom, 14);
  const rang = rangDe(d.analysesDuMois);
  // Les compteurs ont été retirés le 13 septembre 2026 : l'affiche ne doit
  // préparer qu'une seule chose à la fois, et c'est le récapitulatif.
  const preuve = surLeRecap ? introRecap(recap.length) : preuveDe(d);

  // ── LE PRÉNOM OCCUPE TOUTE LA LARGEUR, QUELLE QUE SOIT SA LONGUEUR ──────
  //
  // Satori n'ajuste rien tout seul : un prénom de douze lettres à la taille
  // d'un prénom de cinq déborderait de l'affiche sans un mot d'avertissement.
  // La taille se calcule donc sur la largeur disponible.
  const largeurUtile = largeur - 2 * MARGE;
  const taillePrenom = Math.min(
    story ? 186 : 118,
    Math.floor(largeurUtile / Math.max(4, prenom.length * 0.62))
  );

  const e = story
    ? { marque: 46, date: 28, merci: 30, rang: 42, devise: 46, preuve: 26, carte: 150, ecusson: 80, nom: 28, maxNom: 18, intitule: 23, question: 38, pied: 50, club: 128 }
    : { marque: 36, date: 22, merci: 22, rang: 30, devise: 32, preuve: 19, carte: 100, ecusson: 56, nom: 25, maxNom: 15, intitule: 18, question: 27, pied: 38, club: 92 };

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
          padding: `${story ? 54 : 38}px ${MARGE}px 0`,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={story ? 66 : 52} height={story ? 66 : 52} alt="" />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 18 }}>
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
          <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: e.date * 0.82 }}>
            {SOUS_TITRE}
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <div style={{ display: 'flex', color: DOUX, fontFamily: 'Inter', fontWeight: 400, fontSize: e.date }}>
          {dateEnFrancais(d.jour)}
        </div>
      </div>

      {/* ── LA RECONNAISSANCE : le sujet de l'affiche, c'est la personne ───
          Tout est centré ici, et nulle part ailleurs : une distinction se
          présente au milieu, comme sur un diplôme. Le bas de l'affiche garde
          l'alignement à gauche, qui convient aux listes. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${story ? 48 : 26}px ${MARGE}px 0`,
        }}
      >
        {/* L'écusson du club de cœur : l'identité avant les chiffres. C'est lui
            qui fait dire « ça parle de moi » avant même la lecture. */}
        {d.equipePreferee?.logo ? (
          <div style={{ display: 'flex', marginBottom: story ? 24 : 14 }}>
            <Ecusson url={d.equipePreferee.logo} taille={e.club} />
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            color: VERT,
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: e.merci,
            letterSpacing: e.merci * 0.3,
          }}
        >
          {CAPITALES(MERCI)}
        </div>

        <div
          style={{
            display: 'flex',
            color: BLANC,
            fontFamily: 'Outfit',
            fontWeight: 900,
            fontSize: taillePrenom,
            lineHeight: 1,
            letterSpacing: -2,
            marginTop: story ? 4 : 2,
          }}
        >
          {CAPITALES(prenom)}
        </div>

        {/* LE RANG : un titre qu'on n'a pas acheté, et qui se montre. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: story ? 20 : 12,
            padding: `${story ? 13 : 8}px ${story ? 30 : 18}px`,
            borderRadius: 999,
            background: 'rgba(18,209,138,0.12)',
            border: `2px solid rgba(18,209,138,0.40)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: VERT,
              fontFamily: 'Outfit',
              fontWeight: 900,
              fontSize: e.rang,
              letterSpacing: 1,
            }}
          >
            {CAPITALES(rang)}
          </div>
        </div>

        {/* LA DEVISE : ce qu'on a envie qu'on lise de soi. */}
        <div
          style={{
            display: 'flex',
            color: BLANC,
            fontFamily: 'Outfit',
            fontWeight: 700,
            fontSize: e.devise,
            marginTop: story ? 30 : 18,
          }}
        >
          {DEVISE}
        </div>

        {/* LA PREUVE : sans chiffre derrière, un titre sonne creux. */}
        <div
          style={{
            display: 'flex',
            color: DOUX,
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: e.preuve,
            letterSpacing: e.preuve * 0.08,
            marginTop: story ? 14 : 9,
          }}
        >
          {CAPITALES(preuve)}
        </div>
      </div>

      {/* Le vide se répartit de part et d'autre des cartes : d'un seul côté,
          il creusait un trou de trois cents pixels sous la liste. */}
      <div style={{ display: 'flex', flex: 1, minHeight: story ? 20 : 10 }} />

      {/* ── LES RENCONTRES ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: `${story ? 42 : 24}px ${MARGE}px 0`,
        }}
      >
        {/* L intitule de section disparait sur le recapitulatif : la ligne
            posee sous la devise annonce deja  mes N dernieres analyses,
            confrontees au terrain , et le repeter cent pixels plus bas ne dit
            rien de plus. */}
        {!surLeRecap && matchs.length ? <Intitule texte={titreDeLaListe} taille={e.intitule} /> : null}

        {surLeRecap
          ? recap.map((m, i) => (
              <Comparaison
                key={i}
                m={m}
                hauteur={recap.length >= 3 ? Math.round(e.carte * 1.42) : Math.round(e.carte * 1.7)}
                ecusson={Math.round(e.ecusson * 0.62)}
                police={e.nom - 2}
                maxNom={e.maxNom - 3}
                chiffre={story ? 46 : 32}
                etiquette={story ? 19 : 14}
              />
            ))
          : matchs.map((m, i) => (
              <Rencontre
                key={i}
                m={m}
                hauteur={matchs.length >= 3 ? e.carte : Math.round(e.carte * 1.24)}
                ecusson={e.ecusson}
                police={e.nom}
                maxNom={e.maxNom}
              />
            ))}
      </div>

      {/* L'espace qui reste tombe entre les rencontres et la question. */}
      <div style={{ display: 'flex', flex: 1, minHeight: story ? 26 : 12 }} />

      {/* ── LA QUESTION ───────────────────────────────────────────────────
          Le seul élément qui s'adresse à celui qui REGARDE l'affiche, et non
          à celui qui la publie. C'est lui qui transforme un statut muet en
          conversation. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: `0 ${MARGE}px ${story ? 32 : 18}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: VERT,
            fontFamily: 'Outfit',
            fontWeight: 900,
            fontSize: e.question,
            letterSpacing: -0.3,
          }}
        >
          {QUESTION}
        </div>
      </div>

      {/* ── CE QUE CETTE APPLICATION EST ──────────────────────────────────
          Écrite pour deux lecteurs : le modérateur d'un réseau social qui
          décide en trois secondes si l'image fait la promotion d'un jeu, et
          l'ami qui découvre ProFoot AI par ce partage. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: `0 ${MARGE}px ${story ? 20 : 12}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: 'rgba(255,255,255,0.34)',
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: story ? 21 : 15,
            letterSpacing: story ? 1.1 : 0.7,
          }}
        >
          {CAPITALES(NATURE)}
        </div>
      </div>

      {/* ── LA BANDE DE PIED : ce qui doit rester ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: story ? 138 : 106,
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
