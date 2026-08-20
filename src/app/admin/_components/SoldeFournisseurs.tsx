import { AlertTriangle, CheckCircle2, Coins } from 'lucide-react';
import { soldeOpenRouter, passerellesDisponibles } from '@/lib/passerelle-claude';

/**
 * COMBIEN RESTE-T-IL, ET CHEZ QUI.
 *
 * POURQUOI CE PANNEAU EXISTE
 *
 * Dans la nuit du 20 août 2026, le crédit Anthropic s'est épuisé sans prévenir.
 * L'Agent VIP s'est arrêté pour tous les abonnés, et il a fallu s'en apercevoir
 * en constatant la panne — à trois heures du matin, sans possibilité de
 * recharger avant l'ouverture des banques.
 *
 * Un solde ne prévient jamais de lui-même. Il doit être affiché là où l'on
 * passe déjà, et crier avant d'être à zéro, pas après.
 *
 * LE SEUIL
 *
 * Deux dollars. À la consommation observée de l'Agent VIP, cela laisse environ
 * une journée pleine — assez pour recharger sans urgence, trop peu pour
 * l'ignorer.
 */
const SEUIL_ALERTE = 2;

export default async function SoldeFournisseurs() {
  const [solde, passerelles] = await Promise.all([
    soldeOpenRouter(),
    Promise.resolve(passerellesDisponibles()),
  ]);

  const bas = solde !== null && solde.restant < SEUIL_ALERTE;

  return (
    <section
      className={`rounded-[20px] border p-5 ${
        bas ? 'border-warning/40 bg-warning/5' : 'border-border-card bg-card'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Coins className={`w-4 h-4 ${bas ? 'text-warning' : 'text-primary'}`} />
        <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground">
          Crédit des fournisseurs
        </h2>
      </div>

      {solde === null ? (
        <p className="text-[12px] text-foreground/50 leading-relaxed">
          Solde OpenRouter illisible — clé absente ou service muet.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className={`text-[40px] font-black leading-none tabular-nums ${
                bas ? 'text-warning' : 'text-primary'
              }`}
            >
              {solde.restant.toFixed(2)} $
            </span>
            <span className="text-[13px] font-bold text-foreground/50">restants chez OpenRouter</span>
          </div>
          <p className="text-[11px] text-foreground/40 mb-4">
            {solde.utilise.toFixed(2)} $ consommés sur {solde.total.toFixed(2)} $ achetés
          </p>

          {bas ? (
            <div className="flex items-start gap-3 rounded-[14px] bg-warning/10 border border-warning/20 px-4 py-3.5">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed text-foreground/70">
                <strong className="text-foreground">Solde bas — rechargez.</strong>
                <br />
                Sous {SEUIL_ALERTE} $, il reste environ une journée d&apos;analyses et
                d&apos;Agent VIP. En dessous de zéro, les deux s&apos;arrêtent pour tout le
                monde.
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-foreground/60">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Au-dessus du seuil d&apos;alerte ({SEUIL_ALERTE} $).
            </div>
          )}
        </>
      )}

      {/* Par où l'Agent VIP passe, dans l'ordre où il essaie. */}
      <div className="mt-4 pt-4 border-t border-border-card">
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-2">
          Passerelles de l&apos;Agent VIP, dans l&apos;ordre
        </p>
        {passerelles.length === 0 ? (
          <p className="text-[12px] text-warning">
            Aucune passerelle configurée : l&apos;Agent VIP ne peut pas répondre.
          </p>
        ) : (
          <ol className="space-y-1">
            {passerelles.map((p, i) => (
              <li key={p.nom} className="flex items-center gap-2 text-[12px] text-foreground/70">
                <span className="text-[10px] font-black text-foreground/30 w-4">{i + 1}.</span>
                <span className="font-bold">{p.nom}</span>
                <span className="text-foreground/40">— {p.modele}</span>
                {!p.rechercheWeb && (
                  <span className="text-[10px] text-foreground/35">(sans recherche web)</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
