import { Activity, Globe, Smartphone, AlertCircle } from 'lucide-react';
import { lirePresenceLive } from '@/lib/presence-live';
import { lireApercuClarity, clarityConfigure } from '@/lib/clarity-api';

/**
 * QUI EST LÀ, ET D'OÙ ILS VIENNENT.
 *
 * DEUX SOURCES, PARCE QU'AUCUNE NE SUFFIT SEULE
 *
 * À GAUCHE, NOTRE PROPRE BASE. Instantanée, sans plafond, sans dépendance :
 * elle sait exactement qui vient de lancer une analyse. C'est la réponse à
 * « combien de personnes sont dans l'application maintenant ».
 *
 * À DROITE, MICROSOFT CLARITY. Il voit ce que la base ne voit pas : les
 * visiteurs qui n'ont pas de compte, ceux qui ouvrent la page d'accueil et
 * repartent. C'est la seule source capable de dire si des Marocains arrivent
 * jusqu'au site — et sur quel navigateur.
 *
 * Clarity plafonne à dix appels par jour : ses chiffres sont conservés trois
 * heures. Un horodatage le dit en clair, pour qu'on ne prenne jamais une valeur
 * d'il y a deux heures pour du direct.
 */
export default async function Audience() {
  const [presence, clarity] = await Promise.all([lirePresenceLive(), lireApercuClarity(3)]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Ce que sait notre base : le direct ─────────────────────────── */}
      <section className="rounded-[20px] border border-border-card bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground">
            En ce moment
          </h2>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary">
            direct
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[40px] font-black text-primary leading-none tabular-nums">
            {presence.maintenant}
          </span>
          <span className="text-[13px] font-bold text-foreground/50">
            {presence.maintenant > 1 ? 'personnes actives' : 'personne active'}
          </span>
        </div>
        <p className="text-[11px] text-foreground/40 mb-5">
          Comptes ayant lancé une analyse dans les 15 dernières minutes.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { libelle: 'Dernière heure', valeur: presence.derniereHeure },
            { libelle: "Aujourd'hui", valeur: presence.aujourdhui },
            { libelle: 'Analyses du jour', valeur: presence.analysesAujourdhui },
            { libelle: 'Inscrits du jour', valeur: presence.inscritsAujourdhui },
          ].map((x) => (
            <div key={x.libelle} className="rounded-[14px] bg-sidebar/40 px-3 py-2.5">
              <span className="block text-[20px] font-black text-foreground tabular-nums leading-none">
                {x.valeur}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-1">
                {x.libelle}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[14px] bg-primary/10 border border-primary/20 px-3 py-2.5">
          <span className="text-[20px] font-black text-primary tabular-nums leading-none">
            {presence.encaisseAujourdhui.toLocaleString('fr-FR')} F
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-1">
            encaissé aujourd&apos;hui — {presence.paiementsAujourdhui} paiement
            {presence.paiementsAujourdhui > 1 ? 's' : ''}
          </span>
        </div>

        {presence.parPays.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
              Pays des personnes actives aujourd&apos;hui
            </p>
            <div className="flex flex-wrap gap-1.5">
              {presence.parPays.slice(0, 12).map((p) => (
                <span
                  key={p.pays}
                  className="text-[11px] font-bold px-2 py-1 rounded-full bg-sidebar/60 text-foreground/70"
                >
                  {p.pays} {p.comptes}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Ce que voit Clarity : les visiteurs sans compte ────────────── */}
      <section className="rounded-[20px] border border-border-card bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground">
            Visiteurs — Microsoft Clarity
          </h2>
        </div>

        {!clarityConfigure() ? (
          <div className="flex items-start gap-3 rounded-[14px] bg-warning/10 border border-warning/20 px-4 py-3.5">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="text-[12px] leading-relaxed text-foreground/70">
              <strong className="text-foreground">Clarity n&apos;est pas encore relié.</strong>
              <br />
              Dans Clarity : <em>Settings → Data export → Generate new API token</em>. Puis coller
              ce jeton dans Vercel sous le nom <code className="text-primary">CLARITY_API_TOKEN</code>.
            </div>
          </div>
        ) : !clarity ? (
          <p className="text-[12px] text-foreground/50 leading-relaxed">
            Clarity n&apos;a rien renvoyé pour l&apos;instant. Ses chiffres n&apos;apparaissent
            qu&apos;après les premières visites, et le plafond est de dix appels par jour.
          </p>
        ) : clarity.sessions === 0 ? (
          /* Rien lu : on montre POURQUOI, et un extrait de ce que Clarity a
             réellement répondu. Un panneau muet obligerait à ouvrir les
             journaux du serveur pour comprendre. */
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-[14px] bg-warning/10 border border-warning/20 px-4 py-3.5">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed text-foreground/70">
                <strong className="text-foreground">Aucune visite lue.</strong>
                <br />
                {clarity.probleme ??
                  "Clarity a répondu, mais aucune session n'a pu être lue. Ses chiffres n'apparaissent qu'après quelques heures de collecte."}
              </div>
            </div>
            {clarity.brut && (
              <details className="text-[11px] text-foreground/45">
                <summary className="cursor-pointer font-bold uppercase tracking-wider text-[10px]">
                  Réponse brute de Clarity
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all bg-sidebar/40 rounded-[10px] p-3 leading-relaxed">
                  {clarity.brut}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[40px] font-black text-foreground leading-none tabular-nums">
                {clarity.sessions.toLocaleString('fr-FR')}
              </span>
              <span className="text-[13px] font-bold text-foreground/50">visites</span>
            </div>
            <p className="text-[11px] text-foreground/40 mb-5">
              Sur {clarity.jours} jour{clarity.jours > 1 ? 's' : ''} — relevé{' '}
              {new Date(clarity.releveLe).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {clarity.enReserve && ' (conservé, Clarity limite à 10 appels par jour)'}
            </p>

            <ListeClarity titre="Par pays" lignes={clarity.pays} icone={<Globe className="w-3.5 h-3.5" />} />
            <ListeClarity
              titre="Par navigateur"
              lignes={clarity.navigateurs}
              icone={<Smartphone className="w-3.5 h-3.5" />}
            />
          </>
        )}
      </section>
    </div>
  );
}

function ListeClarity({
  titre,
  lignes,
  icone,
}: {
  titre: string;
  lignes: { valeur: string; sessions: number }[];
  icone: React.ReactNode;
}) {
  if (!lignes.length) return null;
  const total = lignes.reduce((a, l) => a + l.sessions, 0) || 1;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-2 text-foreground/40">
        {icone}
        <span className="text-[10px] font-bold uppercase tracking-wider">{titre}</span>
      </div>
      <div className="space-y-1.5">
        {lignes.slice(0, 7).map((l) => (
          <div key={l.valeur} className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-foreground/80 w-28 truncate">{l.valeur}</span>
            <div className="flex-1 h-1.5 rounded-full bg-sidebar/60 overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full"
                style={{ width: `${Math.max(3, Math.round((100 * l.sessions) / total))}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-foreground/50 tabular-nums w-10 text-right">
              {l.sessions}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
