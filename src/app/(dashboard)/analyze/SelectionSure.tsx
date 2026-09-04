'use client';

import { ShieldCheck } from 'lucide-react';
import { heureLocale } from '@/lib/heure-locale';
import type { MatchSelectionne } from '@/lib/selection-du-jour';
import type { MatchDuJour } from '@/lib/grands-matchs-du-jour';

/**
 * « LES MATCHS LES PLUS SÛRS DU JOUR ».
 *
 * ── CE QUE CETTE SECTION RÉPARE ───────────────────────────────────────────
 *
 * L'application a raison 56 fois sur 100 en moyenne. Mais cette moyenne cache
 * deux produits très différents : 35 % sur un match serré, 68 % sur un favori
 * écrasant, et jusqu'à 77 % sur certains championnats. Un abonné qui analyse
 * au hasard tombe sur les deux sans le savoir, et le jour où il enchaîne trois
 * matchs serrés, il conclut que l'application ne vaut rien. Deux clients l'ont
 * écrit le 4 septembre 2026, à quelques heures d'intervalle.
 *
 * Cette section ne rend pas le moteur meilleur. Elle montre où il l'est déjà.
 *
 * ── ELLE NE DONNE AUCUN PRONOSTIC ─────────────────────────────────────────
 *
 * Ni score, ni vainqueur, ni probabilité : ce serait donner gratuitement ce
 * que l'abonnement vend. On annonce la FAMILLE de la rencontre et la fiabilité
 * observée sur cette famille. Le verdict reste derrière l'analyse.
 *
 * ── ET ELLE PASSE PAR LE MÊME CHEMIN QUE LE CARROUSEL ─────────────────────
 *
 * `onChoisir` est exactement celui des grands matchs du jour : mêmes
 * identifiants, même fonction, même décompte de quota. Aucune seconde façon de
 * lancer une analyse — c'est ainsi qu'on finit par facturer deux fois.
 */

interface Props {
  matchs: MatchSelectionne[];
  aujourdhui: boolean;
  onChoisir: (m: MatchDuJour) => void;
  desactive?: boolean;
}

/** Le vert n'est mérité qu'au-dessus de deux sur trois. */
function couleurDe(taux: number) {
  if (taux >= 70) return { texte: 'text-[#10B981]', fond: 'bg-[#10B981]/10', bord: 'border-[#10B981]/30' };
  if (taux >= 62) return { texte: 'text-[#2DD4BF]', fond: 'bg-[#2DD4BF]/10', bord: 'border-[#2DD4BF]/25' };
  return { texte: 'text-amber-400', fond: 'bg-amber-400/10', bord: 'border-amber-400/25' };
}

export default function SelectionSure({ matchs, aujourdhui, onChoisir, desactive }: Props) {
  // Une section vide ne s'affiche pas : le serveur ne l'envoie qu'à partir de
  // trois rencontres, et deux cartes annoncées comme « les plus sûres du
  // jour » diraient surtout qu'il n'y a rien à analyser.
  if (!matchs.length) return null;

  return (
    <section className="w-full mt-4">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
        <h3 className="text-[12px] font-black uppercase tracking-[0.14em] text-white/85">
          Les matchs les plus sûrs {aujourdhui ? 'du jour' : 'de demain'}
        </h3>
      </div>
      <p className="text-[11px] leading-relaxed text-white/45 mb-3">
        Classés d&apos;après ce que l&apos;IA a réellement réussi sur les rencontres de
        ce type déjà jouées.
      </p>

      <div className="flex flex-col gap-2">
        {matchs.map((m) => {
          const c = couleurDe(m.fiabilite);
          return (
            <button
              key={m.fixtureId}
              type="button"
              disabled={desactive}
              onClick={() =>
                onChoisir({
                  id: `sel-${m.fixtureId}`,
                  kickoffISO: m.kickoffISO,
                  championnat: m.championnat,
                  dom: m.dom,
                  ext: m.ext,
                })
              }
              className={`w-full text-left rounded-[18px] border ${c.bord} bg-[#1d2f3a]/60 px-3.5 py-3 transition-all active:scale-[0.99] hover:bg-[#1d2f3a]/90 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-3">
                {/* Le taux d'abord : c'est la raison d'être de cette carte. */}
                <div
                  className={`shrink-0 w-[52px] h-[52px] rounded-[14px] ${c.fond} border ${c.bord} flex flex-col items-center justify-center`}
                >
                  <span className={`text-[15px] font-black leading-none ${c.texte}`}>
                    {m.fiabilite}
                  </span>
                  <span className={`text-[8.5px] font-black leading-none mt-0.5 ${c.texte} opacity-70`}>
                    %
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {m.dom.logo ? (
                      <img src={m.dom.logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                    ) : null}
                    <span className="text-[13px] font-bold text-white truncate">{m.dom.name}</span>
                    <span className="text-[10px] text-white/30 shrink-0">vs</span>
                    {m.ext.logo ? (
                      <img src={m.ext.logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                    ) : null}
                    <span className="text-[13px] font-bold text-white truncate">{m.ext.name}</span>
                  </div>
                  <p className="text-[10.5px] text-white/40 font-semibold mt-1 truncate">
                    {m.championnat}
                    {m.kickoffISO ? ` · ${heureLocale(m.kickoffISO)}` : ''} · {m.famille}
                  </p>
                  {/* Le nombre de rencontres est ce qui rend le taux crédible :
                      sans lui, « 77 % » n'est qu'une affirmation de plus. */}
                  <p className="text-[10px] text-white/30 mt-0.5 truncate">
                    mesuré sur {m.mesureeSur.toLocaleString('fr-FR')} rencontres
                    {m.ligueMesuree ? ` en ${m.ligueMesuree}` : ''}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-white/30 leading-relaxed mt-2.5">
        Une fiabilité élevée ne garantit aucun résultat : elle dit seulement que
        l&apos;IA s&apos;est trompée moins souvent sur ce type de rencontre.
      </p>
    </section>
  );
}
