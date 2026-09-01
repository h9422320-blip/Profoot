import SectionPreuves from "@/components/preuves/SectionPreuves";

/**
 * LE MUR DES PREUVES, SUR LA PAGE D'ACCUEIL.
 *
 * ── CE QU'IL Y AVAIT À CETTE PLACE ────────────────────────────────────────
 *
 * Huit témoignages inventés, qui défilaient en boucle : « Karim B., Analyste
 * Football », « Antoine L., Data Analyst », « Claire P., Étudiante en sport ».
 * Des noms fabriqués, majoritairement européens, sur un produit vendu à
 * Abidjan, Bamako et Ouagadougou. Cinq étoiles partout.
 *
 * Pendant ce temps, `/preuves` existait, était publique, et contenait
 * 288 pronostics réellement annoncés avant le coup d'envoi puis confrontés au
 * résultat — dont 67 scores exacts. Aucun lien de la page d'accueil n'y menait.
 * Le site cachait sa seule preuve vérifiable derrière ses faux témoignages.
 *
 * ── POURQUOI L'ÉCHANGE VAUT LE COUP ───────────────────────────────────────
 *
 * Un témoignage à cinq étoiles ne se vérifie pas, donc ne convainc personne qui
 * doute — et celui qui doute est exactement le visiteur qu'il faut retourner.
 * Une carte du mur porte deux équipes, une date, un pronostic et un résultat.
 * Elle se vérifie en trente secondes sur n'importe quel site de football.
 *
 * On y perd le confort d'un chiffre choisi, on y gagne la seule chose qui fasse
 * acheter quelqu'un qui a déjà été déçu ailleurs.
 *
 * ── LE COMPOSANT EST CELUI DE LA PAGE DÉDIÉE, SANS COPIE ──────────────────
 *
 * `SectionPreuves` porte déjà son en-tête, son bandeau de chiffres et son lien
 * « Voir les N preuves ». Le redessiner ici aurait créé un second mur à
 * maintenir — et le jour où l'un des deux serait corrigé, l'autre mentirait.
 *
 * ── NEUF CARTES, ET PAS QUARANTE ──────────────────────────────────────────
 *
 * La page dédiée montre tout ; l'accueil doit convaincre et laisser partir vers
 * `/preuves`. Neuf cartes remplissent trois lignes sur un ordinateur et neuf
 * écrans de pouce sur un téléphone : au-delà, on ajoute du poids à la page la
 * plus visitée du site sans ajouter de conviction.
 */
export default function SectionPreuvesAccueil() {
  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      {/* Halo repris des autres sections : il détache le mur du fond sans
          introduire de couleur nouvelle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[560px] h-[560px] max-w-full rounded-full bg-[#10B981]/[0.06] blur-[120px]"
      />
      <div className="relative">
        {/* `scoresExactsSeuls` reste faux : le score exact est rare, et n'en
            montrer que lui donnait un mur presque vide les jours où
            l'application avait pourtant eu raison vingt-neuf fois. */}
        <SectionPreuves limite={9} avecEntete scoresExactsSeuls={false} />
      </div>
    </div>
  );
}
