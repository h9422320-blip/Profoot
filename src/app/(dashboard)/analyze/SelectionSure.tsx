'use client';

import { heureLocale } from '@/lib/heure-locale';
import type { MatchSelectionne } from '@/lib/selection-du-jour';
import type { MatchDuJour } from '@/lib/grands-matchs-du-jour';

/**
 * « LES MATCHS LES MIEUX CERNÉS ».
 *
 * ── CE QUE CETTE SECTION RÉPARE ───────────────────────────────────────────
 *
 * L'application voit juste 56 fois sur 100 en moyenne. Cette moyenne recouvre
 * deux produits très différents, mesurés sur 3 467 rencontres jugées : 35 %
 * sur un match serré, 68 % sur une rencontre très déséquilibrée, jusqu'à 77 %
 * dans certains championnats. Un membre qui ouvre des matchs au hasard croise
 * les deux sans le savoir — et le jour où il enchaîne trois matchs serrés, il
 * conclut que l'application ne vaut rien. Deux clients l'ont écrit le
 * 4 septembre 2026, à quelques heures d'intervalle.
 *
 * Cette section ne rend pas le moteur meilleur. Elle montre où il l'est déjà.
 *
 * ── LE TITRE A ÉTÉ CHOISI CONTRE UN AUTRE ─────────────────────────────────
 *
 * Il disait « les matchs les plus sûrs ». La formule se lit aussi comme celle
 * d'une maison de jeu, et ce projet a déjà perdu sa boutique en août 2026 sur
 * un contrôle « produits interdits : paris sportifs, jeux de hasard ».
 * « Mieux cernés » dit la même chose — nous voyons clair sur ces rencontres —
 * dans le vocabulaire de l'analyse. Choisi par le propriétaire le 4 septembre
 * 2026, et à ne pas revenir en arrière sans mesurer ce risque-là.
 *
 * ── ELLE NE LIVRE AUCUN VERDICT ───────────────────────────────────────────
 *
 * Ni score, ni vainqueur, ni tendance chiffrée : ce serait donner gratuitement
 * ce que l'accès payant contient. La carte porte les écussons, l'heure, le
 * profil de la rencontre et le taux observé. Le verdict reste derrière
 * l'analyse.
 *
 * ── POURQUOI LES ÉCUSSONS SEULS, SANS LES NOMS ────────────────────────────
 *
 * Demande du propriétaire, et elle est juste : deux noms de clubs sur une même
 * ligne cassent l'alignement dès que l'un fait vingt caractères et l'autre
 * six. À l'écusson, chaque ligne fait exactement la même largeur, l'œil
 * descend la colonne sans accrocher, et six rencontres tiennent dans la place
 * qu'en occupaient trois. Les noms restent dans `alt` et `title` : ils sont
 * lus par les lecteurs d'écran et apparaissent au survol.
 */

interface Props {
  matchs: MatchSelectionne[];
  aujourdhui: boolean;
  onChoisir: (m: MatchDuJour) => void;
  desactive?: boolean;
}

/**
 * Le vert n'est mérité qu'au-dessus de deux sur trois.
 *
 * Écrites en toutes lettres : Tailwind ne génère que les classes qu'il trouve
 * littéralement dans le code, et une couleur construite à la volée ne
 * produirait aucun style.
 */
function tonDe(taux: number) {
  if (taux >= 70) return { texte: 'text-[#10B981]', anneau: 'ring-[#10B981]/35', fond: 'bg-[#10B981]/[0.07]' };
  if (taux >= 62) return { texte: 'text-[#2DD4BF]', anneau: 'ring-[#2DD4BF]/30', fond: 'bg-[#2DD4BF]/[0.06]' };
  return { texte: 'text-amber-400', anneau: 'ring-amber-400/25', fond: 'bg-amber-400/[0.05]' };
}

export default function SelectionSure({ matchs, aujourdhui, onChoisir, desactive }: Props) {
  // Le serveur n'envoie rien en dessous de trois rencontres : deux cartes
  // présentées comme une sélection diraient surtout qu'il n'y a rien à voir.
  if (!matchs.length) return null;

  return (
    <section className="w-full mt-5">
      {/* ── LE TITRE ─────────────────────────────────────────────────────
          Une barre verticale plutôt qu'une icône : elle tient sur deux
          pixels, s'aligne exactement sur la hauteur du texte, et ne
          ressemble à aucun pictogramme déjà vu ailleurs dans l'écran. */}
      <div className="flex items-stretch gap-2.5 mb-2">
        <div className="w-[3px] rounded-full bg-gradient-to-b from-[#2DD4BF] to-[#10B981] shrink-0" />
        <div className="min-w-0">
          <h3
            className="text-[19px] md:text-[22px] font-black leading-[1.1] tracking-[-0.02em] text-white"
            style={{ fontFamily: 'var(--police-titre), sans-serif' }}
          >
            Les matchs les mieux cernés
            <span className="text-[#10B981]"> {aujourdhui ? "d'aujourd'hui" : 'de demain'}</span>
          </h3>
          <p className="text-[11.5px] leading-[1.45] text-white/45 mt-1.5">
            Pour aller plus loin dans la lecture d&apos;un match. Notre IA classe ici
            les rencontres qu&apos;elle a le mieux comprises par le passé, championnat
            par championnat.
          </p>
        </div>
      </div>

      {/* ── LES LIGNES ───────────────────────────────────────────────────
          Une grille à trois colonnes de largeur FIXE pour les deux
          premières : le taux et les écussons tombent au même pixel sur
          chaque ligne, quelle que soit la longueur du championnat. C'est
          cet alignement qui fait qu'on lit la colonne d'un coup d'œil au
          lieu de déchiffrer six blocs. */}
      <div className="flex flex-col gap-[6px]">
        {matchs.map((m) => {
          const ton = tonDe(m.fiabilite);
          return (
            <button
              key={m.fixtureId}
              type="button"
              disabled={desactive}
              title={`${m.dom.name} — ${m.ext.name}`}
              onClick={() =>
                onChoisir({
                  id: `sel-${m.fixtureId}`,
                  kickoffISO: m.kickoffISO,
                  championnat: m.championnat,
                  dom: m.dom,
                  ext: m.ext,
                })
              }
              className={`group grid w-full grid-cols-[42px_76px_1fr] items-center gap-2.5 rounded-[14px] border border-white/[0.07] ${ton.fond} px-2.5 py-2.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {/* Le taux, première colonne : c'est la raison d'être de la ligne. */}
              <div className="flex items-baseline justify-start gap-[1px]">
                <span className={`text-[20px] font-black leading-none tracking-[-0.03em] ${ton.texte}`}>
                  {m.fiabilite}
                </span>
                <span className={`text-[10px] font-black leading-none ${ton.texte} opacity-60`}>%</span>
              </div>

              {/* Les deux écussons, deuxième colonne, largeur fixe. */}
              <div className="flex items-center gap-1.5">
                {[m.dom, m.ext].map((e, i) => (
                  // ── PLUS DE PASTILLE, L'ÉCUSSON SEUL ──────────────────
                  //
                  // Il était posé sur un rond blanc, qui le rendait visible
                  // mais imposait une pastille de plus dans une interface qui
                  // en compte déjà beaucoup. Demande du propriétaire, le
                  // 5 septembre 2026 : l'écusson occupe désormais toute la
                  // place du rond, et rien ne se voit derrière.
                  //
                  // L'ombre portée remplace le rond dans sa seule fonction
                  // utile : détacher du fond un écusson sombre — un noir et
                  // blanc, un bleu nuit — qui se confondrait sinon avec la
                  // carte. Elle ne se voit pas sur un écusson clair.
                  <div
                    key={i}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center transition-transform group-hover:scale-110"
                  >
                    {e.logo ? (
                      <img
                        src={e.logo}
                        alt={e.name}
                        title={e.name}
                        className="h-[34px] w-[34px] object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
                        // Chargement immédiat, et non paresseux : six images de
                        // vingt-quatre pixels ne coûtent rien, alors qu'un
                        // écusson qui arrive une seconde trop tard laisse un
                        // rond blanc vide — et sans nom de club affiché, la
                        // ligne ne dit alors plus quel match elle désigne.
                        // Constaté à la première capture d'écran.
                        loading="eager"
                      />
                    ) : (
                      // Un écusson manquant ne doit pas laisser un trou : les
                      // deux premières lettres suffisent à tenir la ligne.
                      <span className="text-[11px] font-black text-white/75">
                        {e.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Le contexte, troisième colonne : elle seule s'étire. */}
              <div className="min-w-0">
                {/* Le championnat SEUL sur la première ligne : accolé à
                    l'heure, il se faisait couper au tiers sur un téléphone de
                    375 pixels — « Primeira Liga · … ». */}
                <p className="truncate text-[12.5px] font-bold leading-tight text-white/90">
                  {m.championnat}
                </p>
                {/* L'heure rejoint le nombre de rencontres, qui est ce qui rend
                    le taux crédible : sans lui, « 77 % » n'est qu'une
                    affirmation de plus. Le championnat n'y est pas répété. */}
                {/* « rencontres mesurées » débordait encore : le mot
                    « mesurées » est déjà porté par le titre de la section et
                    par la mention du bas. Un nombre posé à côté d'un
                    pourcentage se comprend sans lui. */}
                <p className="truncate text-[10.5px] leading-tight text-white/40 mt-[3px]">
                  {m.kickoffISO ? `${heureLocale(m.kickoffISO)} · ` : ''}
                  {m.mesureeSur.toLocaleString('fr-FR')} rencontres
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[9.5px] leading-relaxed text-white/25">
        Ce taux décrit nos analyses passées sur des rencontres comparables. Il ne
        décrit pas l&apos;issue de celle-ci, et ne garantit aucun résultat.
      </p>
    </section>
  );
}
