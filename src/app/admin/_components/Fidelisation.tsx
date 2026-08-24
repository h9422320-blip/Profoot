import { Repeat, TrendingUp, Clock, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { lireBilanFidelisation } from '@/lib/fidelisation';
import { Panneau } from './Panneaux';
import { Vide } from './Ui';

/**
 * LA FIDÉLISATION, AFFICHÉE COMME ELLE DOIT L'ÊTRE.
 *
 * ── POURQUOI LE TAUX BRUT N'EST PAS EN HAUT ───────────────────────────────
 *
 * Parce qu'il ment quand la boutique est jeune. Au 24 août 2026 il valait
 * 6 % — non parce que le produit ne retenait pas, mais parce qu'aucun
 * abonnement mensuel n'avait encore eu le temps d'expirer. Le mettre en
 * évidence, c'est inviter à conclure trop tôt, et à corriger un problème qui
 * n'existe pas.
 *
 * Ce qui est en haut, c'est la comparaison qui se répond dès aujourd'hui :
 * ceux qui sont à sec repayent-ils plus que ceux qui ont encore du crédit ?
 * Seize fois plus, mesuré. C'est ce chiffre qui dit si le produit retient.
 *
 * ── L'AVERTISSEMENT FAIT PARTIE DE LA MESURE ──────────────────────────────
 *
 * Tant qu'aucun abonnement n'a pu arriver à terme, le panneau le dit en
 * toutes lettres et donne la date à partir de laquelle le taux brut voudra
 * dire quelque chose. Un chiffre sans son échéance se lit toujours de travers.
 */
export default async function Fidelisation() {
  const b = await lireBilanFidelisation();

  if (b.vide) {
    return (
      <Panneau
        titre="Fidélisation"
        sousTitre="Le produit retient-il, ou se contente-t-il d'attirer ?"
        icone={<Repeat className="w-4 h-4" />}
        teinte="violet"
      >
        <Vide message="Aucun paiement enregistré pour l'instant." />
      </Panneau>
    );
  }

  const ecart =
    b.encoreDuCredit.taux > 0
      ? Math.round(b.aSec.taux / b.encoreDuCredit.taux)
      : b.aSec.ontRepaye > 0
        ? null
        : 0;

  return (
    <Panneau
      titre="Fidélisation"
      sousTitre="Le produit retient-il, ou se contente-t-il d'attirer ?"
      icone={<Repeat className="w-4 h-4" />}
      teinte="violet"
    >
      <div className="space-y-5">
        {/* ── LA COMPARAISON QUI RÉPOND ───────────────────────────────── */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-3">
            Repayent-ils quand ils tombent à sec ?
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                titre: 'Ont fini leurs analyses',
                g: b.aSec,
                accent: 'text-[#10b981]',
                fond: 'bg-[#10b981]/[0.07] border-[#10b981]/25',
              },
              {
                titre: 'Il leur en reste',
                g: b.encoreDuCredit,
                accent: 'text-white/60',
                fond: 'bg-white/[0.03] border-[#2e4757]',
              },
            ].map((c) => (
              <div key={c.titre} className={`rounded-[16px] border ${c.fond} px-4 py-3.5`}>
                <span className={`block text-[30px] font-black tabular-nums leading-none ${c.accent}`}>
                  {c.g.taux} %
                </span>
                <span className="block text-[11.5px] font-bold text-white/70 mt-1.5">{c.titre}</span>
                <span className="block text-[11px] text-white/35 mt-0.5">
                  {c.g.ontRepaye} sur {c.g.total} ont repayé
                </span>
              </div>
            ))}
          </div>

          {ecart !== null && ecart > 1 && (
            <p className="text-[12px] text-white/60 mt-3 leading-relaxed">
              Tomber à zéro multiplie par <strong className="text-[#10b981]">{ecart}</strong> la
              chance qu&apos;un client repaye. Ce n&apos;est pas la lassitude qui fait partir,
              c&apos;est le compteur qui fait revenir.
            </p>
          )}
        </div>

        {/* ── COMBIEN DE TEMPS TIENT LE CRÉDIT D'ENTRÉE ────────────────── */}
        {b.dureeQuotaJours && (
          <div className="rounded-[16px] border border-[#2e4757] bg-white/[0.02] px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">
                Combien de temps durent les analyses incluses
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="text-[22px] font-black text-white tabular-nums">
                {b.dureeQuotaJours.mediane} j
              </span>
              <span className="text-[11.5px] text-white/40">
                en médiane · {b.dureeQuotaJours.moyenne} j en moyenne
              </span>
            </div>
            <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
              Mesuré sur les {b.aSec.total} abonnés qui les ont épuisées. Un crédit consommé en
              moins d&apos;une journée transforme l&apos;offre d&apos;entrée en essai, pas en
              abonnement.
            </p>
          </div>
        )}

        {/* ── CE QUI SE RACHÈTE APRÈS QUOI ────────────────────────────── */}
        {b.montees.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Ce qui se rachète, après quoi
              </h4>
            </div>
            <div className="space-y-1.5">
              {b.montees.map((m) => (
                <div key={`${m.de}-${m.vers}`} className="flex items-center gap-3 text-[12.5px]">
                  <span className="font-black text-cyan-400 tabular-nums w-8 text-right shrink-0">
                    {m.nombre}
                  </span>
                  <span className="text-white/70">
                    {m.de} <span className="text-white/25 mx-1">→</span> {m.vers}
                  </span>
                </div>
              ))}
            </div>
            {b.delaiMedianJours !== null && (
              <p className="text-[11px] text-white/35 mt-2.5 leading-relaxed">
                Délai entre deux paiements du même client : {b.delaiMedianJours} j en médiane,{' '}
                {b.delaiMoyenJours} j en moyenne.
              </p>
            )}
          </div>
        )}

        {/* ── L'ÉVOLUTION SEMAINE PAR SEMAINE ──────────────────────────── */}
        {b.parSemaine.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Depuis le lancement, semaine par semaine
              </h4>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-[12px] min-w-[340px]">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                    <th className="text-left pb-2">Semaine du</th>
                    <th className="text-right pb-2">Nouveaux</th>
                    <th className="text-right pb-2">Ont repayé</th>
                    <th className="text-right pb-2">Part</th>
                  </tr>
                </thead>
                <tbody>
                  {b.parSemaine.map((s) => (
                    <tr key={s.debut} className="border-t border-[#2e4757]">
                      <td className="py-2 text-white/70">
                        {new Date(s.debut).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-2 text-right tabular-nums text-white/70">{s.nouveaux}</td>
                      <td className="py-2 text-right tabular-nums text-white/70">{s.ontRepaye}</td>
                      <td className="py-2 text-right tabular-nums font-bold text-violet-400">
                        {s.taux} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── LE TAUX BRUT, ET POURQUOI IL NE VEUT PAS ENCORE DIRE GRAND-CHOSE ── */}
        <div className="rounded-[16px] border border-[#2e4757] bg-white/[0.02] px-4 py-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[20px] font-black text-white tabular-nums">{b.tauxBrut} %</span>
            <span className="text-[11.5px] text-white/50">
              de taux de rachat brut — {b.ontPayePlusieursFois} clients sur {b.acheteurs} ont payé
              plus d&apos;une fois
            </span>
          </div>

          {b.tropJeunePourJuger && b.premierRenouvellementPossible && (
            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-[#2e4757]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-white/55 leading-relaxed">
                Ce chiffre n&apos;est pas encore lisible. La boutique a {b.ageBoutiqueJours} jours,
                et aucun abonnement mensuel n&apos;a pu arriver à terme : le premier expire le{' '}
                <strong className="text-white/80">
                  {new Date(b.premierRenouvellementPossible).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                . D&apos;ici là, les paiements répétés sont des montées en gamme, pas des
                renouvellements — c&apos;est la comparaison du haut qui fait foi.
              </p>
            </div>
          )}

          {b.aSecTropRecemment > 0 && (
            <p className="text-[11px] text-white/35 mt-2.5 leading-relaxed">
              Sur les {b.aSec.total} abonnés à sec, {b.aSecTropRecemment} le sont depuis moins de
              trois jours : trop récemment pour savoir s&apos;ils reviendront.{' '}
              {b.aSecDepuisAssezLongtemps} ont eu le temps de choisir.
            </p>
          )}
        </div>
      </div>
    </Panneau>
  );
}
