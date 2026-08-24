import { Scale, CheckCircle2, Hourglass } from 'lucide-react';
import { lireControleMarche, RENCONTRES_POUR_LIVRER } from '@/lib/controle-marche';

/**
 * LE MOTEUR CONFRONTÉ AUX BOOKMAKERS.
 *
 * ── POURQUOI CE BLOC EXISTE DANS L'ADMINISTRATION ─────────────────────────
 *
 * Le contrôle tourne aussi hors ligne, dans un script. Mais un chiffre qui
 * n'existe que dans un terminal n'est regardé par personne, et la décision de
 * livrer le mélange appartient au propriétaire, pas au script.
 *
 * Le verdict est donc écrit ici, en toutes lettres, avec ce qui manque encore.
 */
export default async function ControleMarche() {
  const c = await lireControleMarche();

  return (
    <div className="rounded-[16px] border border-[#2e4757] bg-white/[0.02] px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <Scale className="w-3.5 h-3.5 text-amber-400" />
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-white/45">
          Le moteur contre les bookmakers
        </h4>
        {!c.vide && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-white/30">
            {c.rencontres} / {RENCONTRES_POUR_LIVRER} rencontres
          </span>
        )}
      </div>

      {c.vide ? (
        <p className="text-[11.5px] text-white/50 leading-relaxed">{c.verdict}</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[12px] min-w-[420px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                  <th className="text-left pb-1.5">Dosage</th>
                  <th className="text-right pb-1.5">Vainqueur</th>
                  <th className="text-right pb-1.5">1<sup>re</sup> moitié</th>
                  <th className="text-right pb-1.5">2<sup>e</sup> moitié</th>
                  <th className="text-right pb-1.5">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {c.dosages.map((d) => (
                  <tr key={d.part} className="border-t border-[#2e4757]">
                    <td className={`py-1.5 ${d.part === 0 ? 'text-white/45' : 'text-white/75'}`}>
                      {d.libelle}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-white/80">
                      {d.vainqueur} %
                    </td>
                    {[d.gainMoitie1, d.gainMoitie2].map((g, i) => (
                      <td
                        key={i}
                        className={`py-1.5 text-right tabular-nums ${
                          d.part === 0 ? 'text-white/25' : g > 0 ? 'text-[#10b981]' : 'text-warning'
                        }`}
                      >
                        {d.part === 0 ? '—' : `${g > 0 ? '+' : ''}${g} pt`}
                      </td>
                    ))}
                    <td className="py-1.5 text-right text-[11px]">
                      {d.part === 0 ? (
                        <span className="text-white/25">référence</span>
                      ) : d.tient ? (
                        <span className="text-[#10b981] font-bold">tient</span>
                      ) : (
                        <span className="text-white/30">ne tient pas</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 mt-3 pt-3 border-t border-[#2e4757]">
            {c.pretALivrer ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0 mt-0.5" />
            ) : (
              <Hourglass className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <p
              className={`text-[11.5px] leading-relaxed ${
                c.pretALivrer ? 'text-[#10b981]' : 'text-white/55'
              }`}
            >
              {c.verdict}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
