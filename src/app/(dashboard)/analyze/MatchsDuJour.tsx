'use client';

import { useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { heureLocale, jourEtMoisLocaux } from '@/lib/heure-locale';
import type { MatchDuJour } from '@/lib/grands-matchs-du-jour';

/**
 * LE CARROUSEL DES GRANDS MATCHS DU JOUR.
 *
 * ── CE QU'IL FAIT, ET SURTOUT CE QU'IL NE FAIT PAS ────────────────────────
 *
 * Taper une carte ne déclenche AUCUNE analyse propre à ce composant. Il rend
 * les deux équipes du match à l'écran qui l'accueille, lequel les traite comme
 * si elles venaient des deux sélecteurs. Même appel, même quota, même
 * affichage.
 *
 * C'est délibéré : une seconde façon de lancer une analyse aurait fini par
 * diverger de la première — un décompte de quota oublié ici, une reprise
 * automatique manquante là — et personne ne s'en serait aperçu avant qu'un
 * client ne paie deux fois le même match.
 *
 * ── LE DÉFILEMENT AVANCE PAR MATCH, PAS PAR PIXEL ─────────────────────────
 *
 * La première version faisait glisser la piste d'un demi-pixel toutes les
 * trente millisecondes. C'était juste sur le papier — seize pixels par seconde
 * — et invisible en vrai : le propriétaire a regardé l'écran et a conclu que
 * rien ne bougeait. Un mouvement qu'on ne voit pas n'existe pas.
 *
 * Chaque match reste donc TROIS SECONDES en place, puis la piste glisse
 * jusqu'au suivant. On voit le mouvement, on a le temps de lire, et on
 * comprend qu'il y en a d'autres derrière.
 *
 * ── ET IL S'EFFACE DEVANT LE DOIGT ────────────────────────────────────────
 *
 * Il s'arrête DÈS que la personne touche l'écran, et ne repart jamais tant que
 * la page est ouverte. Un carrousel qui reprend sa course pendant qu'on lit
 * déplace la carte qu'on visait au moment où l'on tape — c'est le geste raté
 * le plus agaçant qui soit sur un téléphone.
 *
 * Il s'arrête aussi quand la page n'est pas regardée : faire tourner une
 * animation dans un onglet caché vide la batterie sans rien montrer.
 */

/** Le temps qu'un match reste sous les yeux avant de laisser la place. */
const DUREE_PAR_MATCH_MS = 3000;

export default function MatchsDuJour({
  matchs,
  aujourdhui,
  onChoisir,
  desactive,
}: {
  matchs: MatchDuJour[];
  aujourdhui: boolean;
  /** Rend les deux équipes à l'écran d'analyse, qui lance son flux habituel. */
  onChoisir: (m: MatchDuJour) => void;
  /** Vrai pendant une analyse : on ne relance pas par-dessus. */
  desactive?: boolean;
}) {
  const piste = useRef<HTMLDivElement | null>(null);
  const rang = useRef(0);
  const [manuel, setManuel] = useState(false);

  useEffect(() => {
    if (manuel || matchs.length < 2) return;

    const el = piste.current;
    if (!el) return;

    // ── « ANIMATIONS RÉDUITES » NE VEUT PAS DIRE « RIEN NE BOUGE » ────────
    //
    // La première version renonçait purement et simplement quand le téléphone
    // demandait des animations réduites — un réglage courant sur les appareils
    // d'entrée de gamme, où il est activé pour économiser la batterie. Le
    // carrousel restait alors figé, sans que rien ne l'explique.
    //
    // Ce réglage demande de ne pas ANIMER, pas de ne rien montrer. Les matchs
    // défilent donc quand même : ils changent d'un coup, sans glissement.
    const sansAnimation = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const minuteur = setInterval(() => {
      // Rien ne bouge dans un onglet qu'on ne regarde pas : ce serait de la
      // batterie dépensée pour une animation que personne ne voit.
      if (document.hidden) return;

      const suivant = (rang.current + 1) % matchs.length;
      const carte = el.children[suivant] as HTMLElement | undefined;
      if (!carte) return;

      // La position est MESURÉE sur la carte elle-même, jamais calculée à
      // partir d'une largeur écrite en dur : le jour où la carte change de
      // taille, le défilement suit tout seul.
      const gauche =
        carte.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;

      // Le retour au début se fait d'un coup. Repasser en glissant sur les
      // quinze cartes donnerait trois secondes de défilement fou.
      const glisse = !sansAnimation && suivant !== 0;
      el.scrollTo({ left: gauche, behavior: glisse ? 'smooth' : 'auto' });
      rang.current = suivant;

      // ── LE FILET : AVANCER RESTE PLUS IMPORTANT QUE GLISSER ────────────
      //
      // `behavior: 'smooth'` est une DEMANDE, pas une garantie. Vérifié dans
      // le navigateur : quand la page n'est pas rendue, le glissement n'a
      // simplement pas lieu et la piste ne bouge pas d'un pixel — le
      // carrousel paraît alors cassé, ce qui est exactement le reproche qui
      // nous a été fait.
      //
      // On repasse donc six dixièmes de seconde plus tard : si la piste n'est
      // pas arrivée, on l'y met d'un coup. Quand le glissement fonctionne —
      // le cas normal — ce contrôle ne fait rien.
      if (glisse) {
        setTimeout(() => {
          if (Math.abs(el.scrollLeft - gauche) > 8) el.scrollLeft = gauche;
        }, 600);
      }
    }, DUREE_PAR_MATCH_MS);

    return () => clearInterval(minuteur);
  }, [manuel, matchs.length]);

  const stopper = () => setManuel(true);

  if (matchs.length === 0) {
    // ── JAMAIS DE SECTION VIDE ───────────────────────────────────────────
    //
    // Un bloc au titre sans contenu se lit comme une panne. On dit ce qui se
    // passe, et on rappelle que les sélecteurs, eux, marchent toujours.
    return (
      <div className="w-full min-w-0 rounded-[22px] border border-white/10 bg-[#16252e] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
          Matchs du jour
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/50">
          Pas de grand match aujourd&apos;hui. Choisis deux équipes ci-dessus pour lancer
          une analyse.
        </p>
      </div>
    );
  }

  return (
    // `w-full min-w-0` : sans cela, une piste de quinze cartes (2 660 px)
    // élargit tout ancêtre qui serait un élément « flex » — la page entière se
    // met alors à défiler horizontalement. Le `<main>` du tableau de bord pose
    // déjà `w-full` et `overflow-x-clip`, mais un composant qui ne tient que
    // par la mise en page de son hôte casse le jour où l'hôte change.
    <div className="w-full min-w-0 space-y-2.5">
      {/* ── L'EN-TÊTE ────────────────────────────────────────────────────
          « Touche pour analyser » n'était qu'une ligne de texte perdue à
          droite : rien ne disait que les cartes étaient prenables. C'est une
          pastille pleine, avec une main — l'invitation doit se voir avant
          qu'on ait à la chercher. */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
          {aujourdhui ? 'Matchs du jour' : 'Prochains grands matchs'}
        </h4>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#10B981]/15 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.12em] text-[#34D399]">
          <Hand className="h-3 w-3" />
          Touche pour analyser
        </span>
      </div>

      <div
        ref={piste}
        onPointerDown={stopper}
        onWheel={stopper}
        onTouchStart={stopper}
        className="flex w-full min-w-0 gap-3 overflow-x-auto pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitOverflowScrolling: 'touch',
          // ── LE COLLAGE, SEULEMENT QUAND LE DOIGT MÈNE ─────────────────
          //
          // `scroll-snap-type` ramène la piste sur la carte la plus proche :
          // écrire 100 donnait 178, mesuré dans le navigateur. Il contrarie
          // donc le déplacement commandé par le minuteur.
          //
          // Il est excellent pour un défilement à la main — la carte s'aligne
          // proprement au lieu de rester coupée en deux. On l'allume donc au
          // moment précis où la personne prend la main.
          scrollSnapType: manuel ? 'x mandatory' : 'none',
        }}
      >
        {matchs.map((m) => {
          const [jour, mois] = jourEtMoisLocaux(m.kickoffISO, '');
          return (
            <button
              key={m.id}
              type="button"
              disabled={desactive}
              onClick={() => onChoisir(m)}
              // 204 px de large : une carte pleine et un tiers de la suivante
              // sur un écran de 375 px. On voit qu'il y en a d'autres derrière
              // sans que les noms de club deviennent illisibles.
              className="group relative shrink-0 w-[204px] min-h-[132px] overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-[#1e3140] to-[#16242e] p-3.5 text-left shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all active:scale-[0.97] hover:border-[#10B981]/45 disabled:opacity-40"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Le liseré du haut : il donne son épaisseur à la carte et
                  rappelle la couleur de l'action, sans ajouter un mot. */}
              <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#10B981]/70 to-transparent" />

              {/* ── LE TAUX, EN HAUT À GAUCHE ─────────────────────────────
                  Mesuré le 5 septembre 2026 sur les quatre matchs proposés ce
                  jour-là : AS Roma - Atalanta à 62 %, Le Havre - Brest à 44 %.
                  Dix-huit points d'écart, et le client tapait au hasard.

                  Les vingt-neuf abonnés sous 30 % de réussite ne lancent pas
                  plus d'analyses que les autres : ils les lancent sur d'autres
                  matchs. Ce carrousel est le chemin le plus emprunté, et il ne
                  disait rien de ce qu'il proposait.

                  Absent quand la rencontre n'a jamais été analysée : on ne
                  devine pas un taux. */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {typeof m.fiabilite === 'number' && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-black tabular-nums ${
                        m.fiabilite >= 70
                          ? 'bg-[#10B981]/20 text-[#34D399]'
                          : m.fiabilite >= 55
                            ? 'bg-[#2DD4BF]/15 text-[#5EEAD4]'
                            : 'bg-orange-400/15 text-orange-300'
                      }`}
                      title="Part d'analyses justes sur les rencontres de ce type déjà jouées"
                    >
                      {m.fiabilite} %
                    </span>
                  )}
                  <span className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                    {m.championnat}
                  </span>
                </span>
                <span
                  suppressHydrationWarning
                  className="shrink-0 rounded-full bg-[#10B981]/15 px-2 py-0.5 text-[10px] font-black tabular-nums text-[#34D399]"
                >
                  {/* L'heure du LECTEUR. La liste est mise en réserve et servie
                      identique à tout le monde : elle ne peut pas connaître le
                      fuseau de celui qui la lit, seul le navigateur le sait. */}
                  {heureLocale(m.kickoffISO, '')}
                </span>
              </div>

              {/* ── LES DEUX CLUBS ─────────────────────────────────────────
                  Les écussons occupent une colonne de largeur FIXE, et les
                  noms commencent tous à la même abscisse : deux logos de
                  proportions différentes ne doivent pas décaler les noms l'un
                  par rapport à l'autre.

                  Aucun cercle, aucun cadre, aucun fond : l'écusson d'un club a
                  déjà sa forme. L'enfermer dans une pastille l'écrase et les
                  fait tous se ressembler. Une ombre portée suffit à le
                  détacher du fond. */}
              <div className="mt-3 space-y-2">
                {[m.dom, m.ext].map((equipe, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                      <img
                        src={equipe.logo}
                        alt=""
                        loading="lazy"
                        className="max-h-9 max-w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold leading-tight text-white">
                      {equipe.name}
                    </span>
                  </div>
                ))}
              </div>

              {!aujourdhui && (
                <span
                  suppressHydrationWarning
                  className="mt-2.5 block text-[9px] font-bold uppercase tracking-wider text-white/30"
                >
                  {jour}/{mois}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
