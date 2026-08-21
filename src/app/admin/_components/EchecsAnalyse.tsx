import { AlertTriangle, CheckCircle2, Globe, Clock, Cpu } from 'lucide-react';
import { getBilanEchecs } from '@/lib/echecs-analyse';
import { bilanSante } from '@/lib/sante-modeles';

/**
 * LES ANALYSES QUI ONT ÉCHOUÉ, ET POURQUOI.
 *
 * POURQUOI CE PANNEAU EXISTE
 *
 * Le bilan des échecs était calculé depuis longtemps — causes, taux, adresses
 * des comptes touchés — et n'était affiché nulle part. Chaque panne était donc
 * découverte de la même façon : le propriétaire lançait une analyse et voyait
 * « ANALYSE INTERROMPUE ». Trois fois dans la seule journée du 21 août.
 *
 * Un chiffre calculé que personne ne regarde ne sert à rien.
 *
 * CE QU'IL MONTRE, ET DANS QUEL ORDRE
 *
 * Le taux d'abord : c'est lui qui dit s'il y a un problème. Puis les causes,
 * parce qu'un taux sans cause oblige à tout reprendre à zéro. Puis les derniers
 * échecs, avec le pays — une panne ne frappe pas partout de la même façon, et
 * dix échecs venant tous du même endroit ne racontent pas la même histoire que
 * dix échecs répartis.
 *
 * LA LIGNE QUI COMPTE VRAIMENT
 *
 * « Sans réponse » : les cas où l'abonné n'a RIEN reçu, pas même une analyse de
 * secours. Ce nombre doit rester à zéro. Tout le reste est du confort ; celui-là
 * est un client qui a payé et qui est reparti les mains vides.
 */
export default async function EchecsAnalyse() {
  const [b, sante] = await Promise.all([getBilanEchecs(200), bilanSante()]);

  // Rien à montrer tant qu'il n'y a rien : un panneau vide dans une page
  // d'administration finit par être ignoré, et le jour où il se remplit,
  // personne ne le voit plus.
  if (!b.total && !b.analysesTotales) return null;

  const alerte = (b.tauxEchec ?? 0) >= 5 || b.sansReponse > 0;

  return (
    <section
      className={`rounded-[20px] border p-5 ${
        alerte ? 'border-warning/40 bg-warning/5' : 'border-border-card bg-card'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className={`w-4 h-4 ${alerte ? 'text-warning' : 'text-foreground/40'}`} />
        <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground">
          Analyses en échec
        </h2>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-foreground/40">
          {b.recents} sur 24 h
        </span>
      </div>

      {/* ── Les trois chiffres qui disent tout ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-[14px] bg-sidebar/40 px-3 py-2.5">
          <span
            className={`block text-[22px] font-black tabular-nums leading-none ${
              alerte ? 'text-warning' : 'text-primary'
            }`}
          >
            {b.tauxEchec === null ? '—' : `${b.tauxEchec} %`}
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-1">
            taux d&apos;échec
          </span>
        </div>

        <div className="rounded-[14px] bg-sidebar/40 px-3 py-2.5">
          <span className="block text-[22px] font-black text-foreground tabular-nums leading-none">
            {b.analysesTotales.toLocaleString('fr-FR')}
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-1">
            analyses servies
          </span>
        </div>

        {/* Le seul chiffre qui doit rester à zéro. */}
        <div
          className={`rounded-[14px] px-3 py-2.5 ${
            b.sansReponse > 0 ? 'bg-warning/15 border border-warning/30' : 'bg-sidebar/40'
          }`}
        >
          <span
            className={`block text-[22px] font-black tabular-nums leading-none ${
              b.sansReponse > 0 ? 'text-warning' : 'text-foreground'
            }`}
          >
            {b.sansReponse}
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-1">
            sans réponse
          </span>
        </div>
      </div>

      {/* ── L'ÉTAT DES MODÈLES, ET CE QUE L'APPLICATION EN A DÉDUIT ────────
          Un modèle qui échoue au moins une fois sur deux sur les six dernières
          heures est renvoyé en fin de cascade, tout seul. Il n'est pas
          supprimé, et il reprend sa place dès que la fenêtre se referme.
          Ce classement doit être visible : une décision automatique que
          personne ne peut relire est une décision qu'on finit par subir. */}
      {sante.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
            Modèles · 6 dernières heures
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sante.map((s) => (
              <span
                key={s.modele}
                title={s.derniereCause ?? undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                  s.declasse
                    ? 'bg-warning/15 text-warning border border-warning/30'
                    : 'bg-sidebar/50 text-foreground/60'
                }`}
              >
                <Cpu className="w-3 h-3 shrink-0" />
                {s.modele}
                <span className="tabular-nums opacity-70">
                  {s.ok}✓ {s.ko}✕
                </span>
                {s.declasse && <span className="uppercase tracking-wider">déclassé</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {b.total === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-foreground/60">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          Aucune analyse en échec sur les derniers relevés.
        </div>
      ) : (
        <>
          {/* ── Les causes, de la plus fréquente à la plus rare ──────────── */}
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
              Causes
            </p>
            <div className="space-y-1.5">
              {b.causes.slice(0, 5).map((c) => (
                <div key={c.cause} className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-foreground/80 w-52 truncate">
                    {c.libelle}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-sidebar/60 overflow-hidden">
                    <div
                      className="h-full bg-warning/60 rounded-full"
                      style={{ width: `${Math.max(3, Math.round(c.part))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-foreground/50 tabular-nums w-16 text-right">
                    {c.nombre} · {c.part} %
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Les derniers, avec le pays et le modèle ──────────────────── */}
          <div className="pt-4 border-t border-border-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
              Les derniers
            </p>
            <div className="space-y-2">
              {b.derniers.slice(0, 12).map((e) => (
                <div
                  key={e.id}
                  className="rounded-[12px] bg-sidebar/30 px-3 py-2 text-[11.5px] leading-relaxed"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground/85">
                      {e.equipe1} — {e.equipe2}
                    </span>
                    {e.pays && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground/45">
                        <Globe className="w-3 h-3" />
                        {e.pays}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40">
                      <Clock className="w-3 h-3" />
                      {new Date(e.creeLe).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {e.dureeMs ? ` · ${Math.round(e.dureeMs / 1000)} s` : ''}
                    </span>
                    {/* Un échec où rien n'a été servi est le seul qui mérite
                        d'être signalé en couleur : les autres ont abouti. */}
                    {!e.serviQuandMeme && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-warning">
                        rien servi
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-foreground/50">
                    <span>{e.causeLibelle}</span>
                    {e.modele && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-foreground/35">
                        <Cpu className="w-3 h-3" />
                        {e.modele}
                      </span>
                    )}
                  </div>
                  {e.email && (
                    <div className="text-[10px] text-foreground/35 mt-0.5 truncate">{e.email}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
