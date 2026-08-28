import { reconcilier, jourEnClair } from '@/lib/reconciliation-partenaire';
import type { PartenaireEnrichi } from '@/lib/partenaires';
import { ShieldCheck, AlertTriangle, WifiOff } from 'lucide-react';

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/**
 * LE CONTRÔLE DES CHIFFRES, À L'ÉCRAN.
 *
 * ── POURQUOI IL EST EN HAUT DE LA PAGE ────────────────────────────────────
 *
 * Le 23 août 2026, le propriétaire a signalé trois fois en une journée que
 * cette page « ne collait pas ». Les trois fois, le calcul était juste : deux
 * périodes différentes, des ventes tombées entre la capture et la
 * vérification, un autre écran.
 *
 * Le défaut n'était pas dans le calcul. Il était dans le fait qu'on ne pouvait
 * pas le vérifier sans ouvrir un terminal. Ce panneau répond aux trois
 * questions d'un coup : sur quelle période, combien la caisse dit, et pourquoi
 * ce montant diffère de celui de la vue d'ensemble.
 *
 * ── ET IL SIGNALE LE JOUR OÙ ÇA CASSERA VRAIMENT ─────────────────────────
 *
 * Le même total est calculé par deux chemins indépendants : ce que la page a
 * additionné mois par mois, et ce que la caisse rend sur la même période. Tant
 * qu'ils sont égaux, le panneau reste discret. S'ils divergent d'un franc, il
 * passe en rouge — à l'instant même, sans attendre que quelqu'un s'en
 * aperçoive.
 */
export default async function Reconciliation({
  partenaire,
}: {
  partenaire: PartenaireEnrichi | undefined;
}) {
  const r = await reconcilier(partenaire);
  if (!r) return null;

  if (r.indisponible) {
    return (
      <div className="rounded-[18px] border border-border-card bg-sidebar/40 p-4 flex items-start gap-3">
        <WifiOff className="w-4 h-4 text-foreground/40 shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] font-bold text-foreground/70">
            Contrôle impossible — la boutique n&apos;a pas répondu
          </p>
          <p className="text-[11.5px] text-foreground/45 leading-relaxed mt-0.5">
            Les montants affichés viennent de la dernière lecture réussie. Ils ne sont
            pas faux, mais ils n&apos;ont pas pu être confrontés à la caisse à l&apos;instant.
          </p>
        </div>
      </div>
    );
  }

  const juste = r.ecartXof === 0;

  return (
    <div
      className={`rounded-[18px] border p-4 ${
        juste ? 'border-primary/25 bg-primary/[0.05]' : 'border-warning/40 bg-warning/[0.08]'
      }`}
    >
      <div className="flex items-start gap-3">
        {juste ? (
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        )}

        <div className="min-w-0 flex-1">
          {/* ── CE PANNEAU NE DOIT PAS NOMMER UNE CAISSE MORTE ─────────────
              Il annonçait « confrontés à la caisse Chariow » alors que
              Chariow est fermée depuis le 27 août 2026 et que l'application
              ne lui parle plus. Le contrôle, lui, est resté juste : il compare
              toujours deux chemins indépendants. Mais un contrôle qui cite
              une source inexistante ne rassure plus — il fait douter de ce
              qu'il vérifie vraiment.

              La source d'aujourd'hui, ce sont les journées Chariow figées
              dans le code plus les ventes MakeTou lues dans notre base. */}
          {juste ? (
            <p className="text-[12.5px] font-bold text-primary">
              Chiffres confrontés à la caisse — aucun écart
            </p>
          ) : (
            <p className="text-[12.5px] font-bold text-warning">
              ÉCART DÉTECTÉ : {fcfa(Math.abs(r.ecartXof))} entre le calcul de cette page et la caisse
            </p>
          )}

          {/* Les trois lignes qui répondent aux trois questions posées le
              23 août. Elles suppriment le doute avant qu'il se forme. */}
          <div className="mt-2.5 space-y-1.5 text-[11.5px] leading-relaxed">
            <p className="text-foreground/70">
              <span className="text-foreground/40">Période comptée — </span>
              depuis le <strong className="text-foreground/85">{jourEnClair(r.debut)}</strong>,
              début du partenariat. {r.ventes} vente{r.ventes > 1 ? 's' : ''} encaissée
              {r.ventes > 1 ? 's' : ''}, <strong className="text-foreground/85">{fcfa(r.caisseXof)}</strong>.
            </p>

            {r.avantPartenariatXof > 0 && (
              <p className="text-foreground/70">
                <span className="text-foreground/40">Écart avec la vue d&apos;ensemble — </span>
                elle affiche <strong className="text-foreground/85">{fcfa(r.totalBoutiqueXof)}</strong>,
                soit {fcfa(r.avantPartenariatXof)} de plus : ce sont les ventes d&apos;avant le{' '}
                {jourEnClair(r.debut)}, qui ne reviennent pas au partenaire.
              </p>
            )}

            <p className="text-foreground/45">
              <span className="text-foreground/35">
                Journées Chariow figées, ventes MakeTou lues à{' '}
              </span>
              <span className="tabular-nums font-bold text-foreground/60">{r.luA}</span>
              <span className="text-foreground/35">
                {' '}— sans mise en réserve. Chaque vente est comptée à la seconde où elle
                est payée ; ce montant monte encore aujourd&apos;hui, et la page se refait
                d&apos;elle-même à chaque nouvelle vente.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
