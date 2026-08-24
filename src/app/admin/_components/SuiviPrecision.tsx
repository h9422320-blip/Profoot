import { Target, TrendingUp, Scale } from 'lucide-react';
import { lireSuiviPrecision } from '@/lib/suivi-precision';
import { Panneau } from './Panneaux';
import { Vide } from './Ui';

/**
 * LA PRÉCISION DU MOTEUR, SUIVIE DANS LE TEMPS ET PAR SEGMENT.
 *
 * ── POURQUOI CE PANNEAU EXISTE ────────────────────────────────────────────
 *
 * Le taux global était affiché seul. « 53 % » ne dit ni si le moteur progresse
 * ni où il souffre : le 24 août 2026, ce 53 % cachait 57 % entre équipes d'un
 * même championnat et 43 % entre championnats différents. Quatorze points
 * d'écart, invisibles dans la moyenne, et qui désignaient précisément le
 * défaut à corriger.
 *
 * ── CE QU'IL FAUT REGARDER EN PREMIER ─────────────────────────────────────
 *
 * L'écart entre les deux segments. Tant qu'il est grand, le moteur a un
 * problème d'échelle entre championnats. La normalisation mise en service le
 * 24 août 2026 doit le refermer : mesuré sur 10 157 rencontres, elle fait
 * passer les matchs croisés de 42,5 % à 50,1 % sans toucher aux autres.
 *
 * Puis l'écart de confiance. Positif, le moteur promet plus qu'il ne tient.
 */
export default async function SuiviPrecision() {
  const s = await lireSuiviPrecision();

  if (s.vide) {
    return (
      <Panneau
        titre="Précision du moteur"
        sousTitre="Suivi dans le temps et par segment"
        icone={<Target className="w-4 h-4" />}
        teinte="cyan"
      >
        <Vide message="Aucun pronostic vérifié pour l'instant." />
      </Panneau>
    );
  }

  const ecartSegments =
    s.memeChampionnat.vainqueur !== null && s.championnatsCroises.vainqueur !== null
      ? Math.round((s.memeChampionnat.vainqueur - s.championnatsCroises.vainqueur) * 10) / 10
      : null;

  const cartes = [
    { titre: "Ensemble", seg: s.ensemble, accent: 'text-cyan-400', fond: 'bg-cyan-400/[0.07] border-cyan-400/25' },
    { titre: 'Même championnat', seg: s.memeChampionnat, accent: 'text-white/70', fond: 'bg-white/[0.03] border-[#2e4757]' },
    { titre: 'Championnats différents', seg: s.championnatsCroises, accent: 'text-white/70', fond: 'bg-white/[0.03] border-[#2e4757]' },
  ];

  return (
    <Panneau
      titre="Précision du moteur"
      sousTitre="Suivi dans le temps et par segment"
      icone={<Target className="w-4 h-4" />}
      teinte="cyan"
    >
      <div className="space-y-5">
        {/* ── LES TROIS SEGMENTS ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cartes.map((c) => (
            <div key={c.titre} className={`rounded-[16px] border ${c.fond} px-4 py-3.5`}>
              <span className={`block text-[28px] font-black tabular-nums leading-none ${c.accent}`}>
                {c.seg.vainqueur === null ? '—' : `${c.seg.vainqueur} %`}
              </span>
              <span className="block text-[11.5px] font-bold text-white/70 mt-1.5">{c.titre}</span>
              <span className="block text-[11px] text-white/35 mt-0.5">
                {c.seg.matchs} match{c.seg.matchs > 1 ? 's' : ''}
                {c.seg.scoreExact !== null && ` · score exact ${c.seg.scoreExact} %`}
              </span>
              {c.seg.ecartConfiance !== null && (
                <span
                  className={`block text-[11px] mt-1 font-bold ${
                    c.seg.ecartConfiance > 10 ? 'text-warning' : 'text-white/35'
                  }`}
                >
                  promet {c.seg.confiance} % · {c.seg.ecartConfiance > 0 ? '+' : ''}
                  {c.seg.ecartConfiance} pt d&apos;écart
                </span>
              )}
            </div>
          ))}
        </div>

        {ecartSegments !== null && (
          <div className="flex items-start gap-2 rounded-[16px] border border-[#2e4757] bg-white/[0.02] px-4 py-3">
            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-white/55 leading-relaxed">
              {ecartSegments > 5 ? (
                <>
                  Le moteur réussit <strong className="text-white/80">{ecartSegments} points</strong> de
                  moins quand les deux équipes viennent de championnats différents. Leurs forces sont
                  mesurées dans deux viviers séparés, et les comparer n&apos;a pas de sens tant
                  qu&apos;elles ne sont pas ramenées sur la même échelle.
                </>
              ) : (
                <>
                  L&apos;écart entre matchs internes et matchs entre championnats est de{' '}
                  <strong className="text-[#10b981]">{Math.abs(ecartSegments)} point
                  {Math.abs(ecartSegments) > 1 ? 's' : ''}</strong>. La mise à la même échelle des
                  championnats tient : c&apos;est ce que la normalisation devait produire.
                </>
              )}
            </p>
          </div>
        )}

        {/* ── SEMAINE PAR SEMAINE ──────────────────────────────────────── */}
        {s.semaines.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Semaine par semaine
              </h4>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-[12px] min-w-[420px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    <th className="text-left pb-2">Semaine du</th>
                    <th className="text-right pb-2">Matchs</th>
                    <th className="text-right pb-2">Vainqueur</th>
                    <th className="text-right pb-2">Score exact</th>
                    <th className="text-right pb-2">Écart confiance</th>
                  </tr>
                </thead>
                <tbody>
                  {s.semaines.slice(-10).map((w) => (
                    <tr key={w.debut} className="border-t border-[#2e4757]">
                      <td className="py-2 text-white/70">
                        {new Date(w.debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="py-2 text-right tabular-nums text-white/70">{w.matchs}</td>
                      <td className="py-2 text-right tabular-nums font-bold text-cyan-400">
                        {w.vainqueur === null ? '—' : `${w.vainqueur} %`}
                      </td>
                      <td className="py-2 text-right tabular-nums text-white/70">
                        {w.scoreExact === null ? '—' : `${w.scoreExact} %`}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          w.ecartConfiance !== null && w.ecartConfiance > 15 ? 'text-warning' : 'text-white/50'
                        }`}
                      >
                        {w.ecartConfiance === null ? '—' : `${w.ecartConfiance > 0 ? '+' : ''}${w.ecartConfiance} pt`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-[11px] text-white/30 leading-relaxed">
          Un match compte pour un, quel que soit le nombre d&apos;abonnés qui l&apos;ont analysé :{' '}
          {s.analysesLues.toLocaleString('fr-FR')} analyses vérifiées se ramènent à{' '}
          {s.ensemble.matchs.toLocaleString('fr-FR')} rencontres distinctes. Compter les analyses
          ferait passer une seule affiche pour un échantillon. Sous huit matchs, aucun pourcentage
          n&apos;est publié — il ne décrirait que le hasard.
        </p>
      </div>
    </Panneau>
  );
}
