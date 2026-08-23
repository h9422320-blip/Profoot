import { lireApercuClarity, lireComportementClarity, clarityConfigure } from '@/lib/clarity-api';
import { composerBilan } from '@/lib/bilan-clarity';
import { etatQuota, PLAFOND_MICROSOFT } from '@/lib/clarity-quota';
import MesureMaison from './MesureMaison';
import { EnTete } from '../_components/EnTete';
import { Panneau } from '../_components/Panneaux';
import { Vide } from '../_components/Ui';
import { Eye, AlertTriangle, MousePointerClick, ArrowLeftRight, Globe, Smartphone, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * CE QUE CLARITY OBSERVE, EN FRANÇAIS SIMPLE.
 *
 * ── POURQUOI UNE PAGE, ET PAS SEULEMENT UN SCRIPT ─────────────────────────
 *
 * Le bilan existait en ligne de commande, mais il exigeait de recopier le
 * jeton d'API sur l'ordinateur — une manipulation que le propriétaire ne fait
 * pas, et qui n'a aucune raison d'exister : le jeton est déjà sur Vercel, où
 * il sert à la page d'audience.
 *
 * Ici, il n'y a rien à installer, rien à copier, rien à comprendre. On ouvre
 * la page, on lit.
 *
 * ── LE PLAFOND DE DIX APPELS PAR JOUR ─────────────────────────────────────
 *
 * Microsoft en autorise dix, tous usages confondus. Les deux lectures sont
 * conservées trois heures : rafraîchir cette page dix fois de suite ne coûte
 * qu'une seule série d'appels. Quand les chiffres viennent de la réserve, la
 * page le dit — un chiffre daté n'est pas un chiffre faux, mais on doit savoir
 * de quand il date.
 *
 * ── RIEN N'EST INVENTÉ ────────────────────────────────────────────────────
 *
 * Chaque ligne affichée vient d'un nombre rendu par l'API. Ce que Clarity n'a
 * pas fourni figure dans un encadré à part, au lieu d'être comblé.
 */
export default async function ClarityPage() {
  if (!clarityConfigure()) {
    return (
      <div className="space-y-6">
        <EnTete
          titre="Ce que Clarity observe"
          sousTitre="Comportement réel des visiteurs, sur les trois derniers jours"
          icone={<Eye className="w-6 h-6" />}
          teinte="violet"
        />
        <Panneau titre="Clarity n'est pas relié" sousTitre="Il manque le jeton d'API">
          <Vide message="Ajoutez CLARITY_API_TOKEN dans Vercel (Settings → Environment Variables), puis redéployez." />
        </Panneau>
      </div>
    );
  }

  const [apercu, comportement] = await Promise.all([
    lireApercuClarity(3),
    lireComportementClarity(3),
  ]);
  const b = composerBilan(apercu, comportement);
  const quota = await etatQuota();

  const quand = new Date(b.releveLe).toLocaleString('fr-FR', {
    timeZone: 'Africa/Conakry',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  const taux = (part: number, total: number) =>
    total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Ce que Clarity observe"
        sousTitre={`${b.periode} — relevé à ${quand}${b.enReserve ? ', depuis la réserve' : ''}`}
        icone={<Eye className="w-6 h-6" />}
        teinte="violet"
        reperes={[
          { libelle: 'Sessions', valeur: b.sessions.toLocaleString('fr-FR'), accent: true },
          { libelle: 'Pages vues', valeur: b.pagesVues.toLocaleString('fr-FR') },
          { libelle: 'Problèmes repérés', valeur: String(b.problemes.length) },
          { libelle: 'Appels restants', valeur: `${quota.restants} / ${quota.plafond}` },
        ]}
      />

      {/* ── LE QUOTA SE DIT, IL NE SE DÉCOUVRE PAS ─────────────────────────
          Le 23 août 2026, les dix appels quotidiens de Microsoft ont été
          épuisés en une soirée : rien n'indiquait qu'ouvrir cette page coûtait
          quelque chose. Un plafond invisible se heurte toujours. */}
      {quota.restants === 0 && (
        <div className="rounded-[18px] border border-warning/30 bg-warning/[0.07] p-4">
          <p className="text-[13px] font-bold text-warning mb-1">
            Plafond quotidien atteint
          </p>
          <p className="text-[12px] text-foreground/60 leading-relaxed">
            {quota.plafond} appels utilisés sur les {PLAFOND_MICROSOFT} autorisés par Microsoft.
            Les chiffres ci-dessous viennent de la dernière lecture réussie. La remise à zéro
            a lieu à minuit, heure universelle.
          </p>
        </div>
      )}

      {/* ── LA MESURE MAISON D'ABORD ───────────────────────────────────────
          Elle passe avant Clarity parce qu'elle n'a ni plafond ni retard, et
          qu'elle seule répond à « sur quelle page ferment-ils ». Clarity suit
          en dessous, pour ce qu'il fait mieux : la comparaison des supports, et
          les enregistrements vidéo que son interface est seule à montrer. */}
      <MesureMaison heures={24} />

      <div className="pt-2">
        <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground/70 px-1">
          Ce que Clarity ajoute
        </h2>
        <p className="text-[11.5px] text-foreground/40 px-1 mt-1 leading-relaxed">
          Chiffres agrégés sur trois jours, plafonnés à dix appels quotidiens par
          Microsoft. Pour les enregistrements vidéo, ouvrez Clarity directement.
        </p>
      </div>

      {/* ── Ce qu'il faut retenir ───────────────────────────────────────── */}
      {b.resume.length > 0 && (
        <Panneau titre="Ce qu'il faut retenir" icone={<FileText className="w-4 h-4" />} teinte="cyan">
          <ul className="space-y-2">
            {b.resume.map((l, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-foreground/75 leading-relaxed">
                <span className="text-primary shrink-0">•</span>
                {l}
              </li>
            ))}
          </ul>
        </Panneau>
      )}

      {/* ── Les trois problèmes qui coûtent des ventes ──────────────────── */}
      {b.problemes.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground/70 px-1">
            Ce qui coûte des ventes
          </h2>
          {b.problemes.map((p) => (
            <div
              key={p.rang}
              className="rounded-[20px] border border-warning/25 bg-warning/[0.06] p-5"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-warning/20 border border-warning/40 text-[13px] font-black text-warning flex items-center justify-center">
                  {p.rang}
                </span>
                <div className="min-w-0 space-y-2.5">
                  <h3 className="text-[15px] font-black text-foreground leading-tight">{p.titre}</h3>
                  <p className="text-[12.5px] text-foreground/70 leading-relaxed">
                    <span className="font-bold text-foreground/50">Constat — </span>
                    {p.constat}
                  </p>
                  <p className="text-[12.5px] text-foreground/70 leading-relaxed">
                    <span className="font-bold text-foreground/50">Pourquoi ça coûte — </span>
                    {p.consequence}
                  </p>
                  <p className="text-[12.5px] text-primary leading-relaxed">
                    <span className="font-bold">Que faire — </span>
                    {p.recommandation}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : b.sessions > 0 ? (
        <Panneau titre="Ce qui coûte des ventes" icone={<AlertTriangle className="w-4 h-4" />}>
          <Vide message="Aucun signal au-dessus des seuils retenus sur cette période." />
        </Panneau>
      ) : null}

      {/* ── Les pages ───────────────────────────────────────────────────── */}
      {b.pagesLesPlusVues.length > 0 && (
        <Panneau
          titre="Les pages les plus vues"
          sousTitre="Et ce que les visiteurs y font"
          icone={<MousePointerClick className="w-4 h-4" />}
        >
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[12px] min-w-[520px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                  <th className="text-left pb-2">Page</th>
                  <th className="text-right pb-2">Sessions</th>
                  <th className="text-right pb-2">Rage</th>
                  <th className="text-right pb-2">Morts</th>
                  <th className="text-right pb-2">Demi-tours</th>
                  <th className="text-right pb-2">Lecture</th>
                </tr>
              </thead>
              <tbody>
                {b.pagesLesPlusVues.map((p) => (
                  <tr key={p.url} className="border-t border-border-card">
                    <td className="py-2 pr-3 text-foreground/80 font-medium truncate max-w-[240px]">{p.url}</td>
                    <td className="py-2 text-right tabular-nums text-foreground/70">{p.sessions}</td>
                    <td className={`py-2 text-right tabular-nums ${p.clicsDeRage > 0 ? 'text-warning font-bold' : 'text-foreground/30'}`}>{p.clicsDeRage || '—'}</td>
                    <td className={`py-2 text-right tabular-nums ${p.clicsMorts > 0 ? 'text-warning font-bold' : 'text-foreground/30'}`}>{p.clicsMorts || '—'}</td>
                    <td className={`py-2 text-right tabular-nums ${p.retoursRapides > 0 ? 'text-warning font-bold' : 'text-foreground/30'}`}>{p.retoursRapides || '—'}</td>
                    <td className="py-2 text-right tabular-nums text-foreground/70">
                      {p.profondeurScroll != null ? `${p.profondeurScroll} %` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panneau>
      )}

      {/* ── Où l'on décroche ────────────────────────────────────────────── */}
      {b.pagesQuiDecrochent.length > 0 && (
        <Panneau
          titre="Où les gens décrochent le plus"
          sousTitre="Arrivée suivie d'un demi-tour immédiat"
          icone={<ArrowLeftRight className="w-4 h-4" />}
          teinte="violet"
        >
          <div className="space-y-2">
            {b.pagesQuiDecrochent.map((p) => (
              <div key={p.url} className="flex items-center gap-3 text-[12.5px]">
                <span className="font-black text-warning tabular-nums w-14 text-right shrink-0">
                  {taux(p.retoursRapides, p.sessions)} %
                </span>
                <span className="text-foreground/75 truncate">{p.url}</span>
                <span className="text-foreground/35 text-[11px] ml-auto shrink-0">
                  {p.sessions} sessions
                </span>
              </div>
            ))}
          </div>
        </Panneau>
      )}

      {/* ── Pays et appareils ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {b.pays.length > 0 && (
          <Panneau titre="D'où viennent les visiteurs" icone={<Globe className="w-4 h-4" />}>
            <div className="space-y-1.5">
              {b.pays.map((p) => (
                <div key={p.valeur} className="flex items-center gap-3 text-[12.5px]">
                  <span className="tabular-nums font-bold text-foreground/70 w-12 text-right shrink-0">{p.sessions}</span>
                  <span className="text-foreground/70">{p.valeur}</span>
                </div>
              ))}
            </div>
          </Panneau>
        )}

        {b.appareils.length > 0 && (
          <Panneau titre="Sur quel appareil" icone={<Smartphone className="w-4 h-4" />} teinte="cyan">
            <div className="space-y-1.5">
              {b.appareils.map((a) => (
                <div key={a.valeur} className="flex items-center gap-3 text-[12.5px]">
                  <span className="tabular-nums font-bold text-foreground/70 w-12 text-right shrink-0">{a.sessions}</span>
                  <span className="text-foreground/70">{a.valeur}</span>
                </div>
              ))}
            </div>
          </Panneau>
        )}
      </div>

      {/* ── Ce que Clarity n'a pas fourni ───────────────────────────────── */}
      {b.manques.length > 0 && (
        <div className="rounded-[18px] border border-border-card bg-sidebar/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/35 mb-2">
            Ce que Clarity n&apos;a pas fourni
          </p>
          <ul className="space-y-1">
            {b.manques.map((m, i) => (
              <li key={i} className="text-[12px] text-foreground/50 leading-relaxed">• {m}</li>
            ))}
          </ul>
          <p className="text-[11px] text-foreground/35 mt-2.5 leading-relaxed">
            Ces trous ne sont pas comblés : un bilan qui devine ne sert à rien.
          </p>
        </div>
      )}

      <p className="text-[11px] text-foreground/30 px-1 leading-relaxed">
        L&apos;API de Clarity rend des totaux, pas les enregistrements vidéo. Elle dit
        combien de personnes ont cliqué avec agacement sur une page, pas sur quoi — pour
        cela, ouvrez les enregistrements dans Clarity. Les chiffres sont conservés trois
        heures : Microsoft n&apos;autorise que dix appels par jour.
      </p>
    </div>
  );
}
