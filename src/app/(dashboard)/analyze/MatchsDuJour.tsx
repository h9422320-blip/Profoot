'use client';

import { useEffect, useRef, useState } from 'react';
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
 * ── LE DÉFILEMENT AUTOMATIQUE S'EFFACE DEVANT LE DOIGT ────────────────────
 *
 * Il avance d'un cheveu toutes les trente millisecondes : assez pour qu'on
 * voie qu'il y a d'autres matchs derrière, assez lent pour qu'on puisse lire.
 *
 * Il s'arrête DÈS que la personne touche l'écran, et ne repart jamais tant que
 * la page est ouverte. Un carrousel qui reprend sa course pendant qu'on lit
 * déplace la carte qu'on visait au moment où l'on tape — c'est le geste raté
 * le plus agaçant qui soit sur un téléphone.
 *
 * Il s'arrête aussi quand la page n'est pas regardée : faire tourner une
 * animation dans un onglet caché vide la batterie sans rien montrer.
 */

/**
 * Un demi-pixel, trente fois par seconde : le mouvement se voit, le texte se
 * lit, et la traversée des quinze cartes prend près de trois minutes.
 */
const PAS_PX = 0.5;
const CADENCE_MS = 30;

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
  const [manuel, setManuel] = useState(false);

  /**
   * LA POSITION VOULUE, TENUE ICI ET JAMAIS RELUE DANS LA PAGE.
   *
   * `scrollLeft` est ARRONDI par le navigateur. Écrire 0,4 puis relire rend
   * 0 : le pas était perdu à chaque tour, et le carrousel restait immobile —
   * mesuré dans le navigateur, pas supposé. En tenant le compte ici, les
   * demi-pixels finissent par faire des pixels.
   */
  const position = useRef(0);

  useEffect(() => {
    if (manuel || matchs.length < 2) return;

    const el = piste.current;
    if (!el) return;

    // Sur un téléphone réglé sur « animations réduites », on ne bouge rien :
    // ce réglage existe aussi pour les personnes que le mouvement gêne.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const minuteur = setInterval(() => {
      // Rien ne bouge dans un onglet qu'on ne regarde pas : ce serait de la
      // batterie dépensée pour une animation que personne ne voit.
      if (document.hidden) return;
      const large = el.scrollWidth - el.clientWidth;
      if (large <= 0) return;

      // Revenu au bout : on repart du début. Le saut se fait au moment où la
      // dernière carte vient de disparaître, il ne se remarque pas.
      position.current = position.current >= large ? 0 : position.current + PAS_PX;
      el.scrollLeft = position.current;
    }, CADENCE_MS);

    return () => clearInterval(minuteur);
  }, [manuel, matchs.length]);

  const stopper = () => setManuel(true);

  if (matchs.length === 0) {
    // ── JAMAIS DE SECTION VIDE ───────────────────────────────────────────
    //
    // Un bloc au titre sans contenu se lit comme une panne. On dit ce qui se
    // passe, et on rappelle que les sélecteurs, eux, marchent toujours.
    return (
      <div className="w-full min-w-0 rounded-[20px] border border-white/5 bg-[#1d2f3a]/40 px-4 py-3.5">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
          Matchs du jour
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
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
    <div className="w-full min-w-0 space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">
          {aujourdhui ? 'Matchs du jour' : 'Prochains grands matchs'}
        </h4>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#10B981]/70">
          Touche pour analyser
        </span>
      </div>

      <div
        ref={piste}
        onPointerDown={stopper}
        onWheel={stopper}
        onTouchStart={stopper}
        onScroll={(e) => {
          // Un défilement lancé au doigt (élan) arrive sans nouvel appui :
          // sans ce garde-fou, la reprise automatique lutterait contre l'élan.
          if (!manuel && e.currentTarget.scrollLeft % 1 !== 0) setManuel(true);
        }}
        className="flex w-full min-w-0 gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitOverflowScrolling: 'touch',
          // ── LE COLLAGE, SEULEMENT QUAND LE DOIGT MÈNE ─────────────────
          //
          // `scroll-snap-type` ramène la piste sur la carte la plus proche :
          // écrire 100 donnait 178, mesuré dans le navigateur. Il annulait
          // donc chaque pas du défilement automatique, qui restait immobile.
          //
          // Il est excellent pour un défilement à la main — la carte s'aligne
          // proprement au lieu de rester coupée en deux. On l'allume donc au
          // moment précis où la personne prend la main.
          scrollSnapType: manuel ? 'x proximity' : 'none',
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
              // 168 px de large, 88 px de haut : deux cartes et demie tiennent
              // sur un écran de 390 px, ce qui montre qu'il y en a d'autres
              // derrière sans que le texte devienne illisible.
              className="group shrink-0 w-[168px] min-h-[88px] rounded-[18px] border border-white/8 bg-[#1d2f3a]/70 px-3 py-2.5 text-left transition-all active:scale-[0.97] hover:border-[#10B981]/40 disabled:opacity-40"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[8.5px] font-black uppercase tracking-wider text-white/30">
                  {m.championnat}
                </span>
                <span
                  suppressHydrationWarning
                  className="shrink-0 text-[9px] font-black text-[#10B981]"
                >
                  {/* L'heure du LECTEUR. La liste est mise en réserve et servie
                      identique à tout le monde : elle ne peut pas connaître le
                      fuseau de celui qui la lit, seul le navigateur le sait. */}
                  {heureLocale(m.kickoffISO, '')}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <img src={m.dom.logo} alt="" className="h-5 w-5 shrink-0 object-contain" />
                  <span className="truncate text-[11.5px] font-extrabold text-white/90">
                    {m.dom.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={m.ext.logo} alt="" className="h-5 w-5 shrink-0 object-contain" />
                  <span className="truncate text-[11.5px] font-extrabold text-white/90">
                    {m.ext.name}
                  </span>
                </div>
              </div>

              {!aujourdhui && (
                <span suppressHydrationWarning className="mt-1.5 block text-[8.5px] font-bold text-white/25">
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
