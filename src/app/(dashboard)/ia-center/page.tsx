import { Brain, Target, TrendingUp, BarChart3, CheckCircle2, XCircle, Activity } from "lucide-react";
import { getClub } from "@/lib/data";
import { getPrecisionReelle } from "@/lib/precision-reelle";

export const dynamic = "force-dynamic";

/**
 * Cette page annonçait « 79,2 % de vainqueurs corrects », « 23,4 % de scores
 * exacts » et une série de 11 matchs. Ces chiffres étaient écrits en dur dans
 * le code et ne reposaient sur aucune mesure — une promesse de performance
 * chiffrée montrée à des abonnés qui paient sur cette base.
 *
 * Ils viennent maintenant de la confrontation entre chaque pronostic passé et
 * le résultat réel du match. Tant qu'aucun match n'a été vérifié, la page le
 * dit au lieu d'afficher un pourcentage.
 *
 * Over/Under et BTTS ont disparu : rien dans ce qui est enregistré ne permet de
 * les mesurer. Mieux vaut trois chiffres vrais que cinq dont deux inventés.
 */
export default async function IACenterPage() {
  const precision = await getPrecisionReelle();
  const mesure = precision.verifiees > 0;
  const valeur = (v: number | null) => (mesure && v !== null ? `${v}%` : "—");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">IA Center</h1>
        <p className="text-foreground/50 text-sm mt-1">Performance, transparence et explications de notre intelligence artificielle football.</p>
      </div>

      {!mesure && (
        <div className="bg-warning/10 border border-warning/25 rounded-[16px] p-5">
          <p className="text-sm text-warning font-bold mb-1">Pas encore de précision mesurée</p>
          <p className="text-xs text-foreground/60 leading-relaxed">
            {precision.enAttente > 0
              ? `${precision.enAttente} pronostic${precision.enAttente > 1 ? "s" : ""} en attente : les matchs concernés n'ont pas encore été joués. Chaque résultat est comparé automatiquement à la prédiction dès qu'il tombe, et les taux ci-dessous apparaîtront à ce moment-là.`
              : "Les taux apparaîtront dès que des pronostics auront été confrontés à des résultats réels."}{" "}
            Aucun chiffre n'est affiché tant qu'il n'est pas constaté.
          </p>
        </div>
      )}

      {/* Performance Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <PerformanceCard icon={Target} title="Vainqueur correct" value={valeur(precision.vainqueurCorrect)} color="text-primary" bgColor="bg-primary/10" />
        <PerformanceCard icon={Brain} title="Score exact" value={valeur(precision.scoreExact)} color="text-info" bgColor="bg-info/10" />
        <PerformanceCard icon={CheckCircle2} title="Matchs vérifiés" value={String(precision.verifiees)} color="text-warning" bgColor="bg-warning/10" />
        <PerformanceCard icon={Activity} title="En attente de résultat" value={String(precision.enAttente)} color="text-danger" bgColor="bg-danger/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* How the IA works */}
        <div className="lg:col-span-2 bg-card border border-border-card rounded-[16px] p-6">
          <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> Comment fonctionne notre IA ?
          </h2>
          <div className="space-y-6">
            <IAStep number={1} title="Collecte de données" desc="Notre IA ingère les données de plus de 50 sources : statistiques de match, xG, compositions, blessures, conditions météo, historique des confrontations, et tendances récentes." />
            <IAStep number={2} title="Analyse multi-factorielle" desc="L'algorithme croise plus de 200 variables par match. Il identifie les patterns invisibles à l'œil nu : corrélations entre possession et victoire, impact des déplacements, fatigue des joueurs." />
            <IAStep number={3} title="Génération de la prédiction" desc="Le modèle produit un score probable, un vainqueur avec un indice de confiance (0-100%), et des scénarios tactiques détaillés expliquant le raisonnement de l'IA." />
            <IAStep number={4} title="Vérification post-match" desc="Après chaque match, l'IA compare sa prédiction au résultat réel. Toute erreur est utilisée pour affiner le modèle. Transparence totale." />
          </div>
        </div>

        {/* Accuracy panel */}
        <div className="space-y-6">
          <div className="bg-card border border-border-card rounded-[16px] p-6">
            <h3 className="text-sm font-bold text-foreground mb-4">Récapitulatif</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/50">Pronostics vérifiés</span>
                <span className="text-sm font-bold text-foreground">{precision.verifiees}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/50">Vainqueurs corrects</span>
                <span className="text-sm font-bold text-primary">
                  {mesure && precision.vainqueurCorrect !== null
                    ? `${Math.round((precision.vainqueurCorrect / 100) * precision.verifiees)}/${precision.verifiees}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/50">Scores exacts</span>
                <span className="text-sm font-bold text-info">
                  {mesure && precision.scoreExact !== null
                    ? `${Math.round((precision.scoreExact / 100) * precision.verifiees)}/${precision.verifiees}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground/50">Série en cours</span>
                <span className="text-sm font-bold text-warning">
                  {precision.serieEnCours > 0 ? `🔥 ${precision.serieEnCours} matchs` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-[16px] p-6">
            <h3 className="text-sm font-bold text-primary mb-2">Niveau de confiance</h3>
            <p className="text-xs text-foreground/50 mb-4">L'IA n'affiche une prédiction que si sa confiance dépasse 50%. Plus la barre est haute, plus la prédiction est fiable.</p>
            <div className="space-y-3">
              <ConfidenceBar label="90-100%" width="15%" desc="Très rare, fiabilité maximale" />
              <ConfidenceBar label="70-89%" width="45%" desc="Confiance élevée" />
              <ConfidenceBar label="50-69%" width="35%" desc="Confiance modérée" />
              <ConfidenceBar label="< 50%" width="5%" desc="Non affiché" muted />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({ icon: Icon, title, value, color, bgColor }: any) {
  return (
    <div className="bg-card border border-border-card rounded-[16px] p-5">
      <div className={`p-2.5 rounded-[14px] ${bgColor} w-fit mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-black text-foreground">{value}</div>
      <div className="text-xs text-foreground/50 mt-0.5">{title}</div>
    </div>
  );
}

function IAStep({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border border-primary/20 shrink-0">
        {number}
      </div>
      <div>
        <h4 className="font-semibold text-sm text-foreground mb-1">{title}</h4>
        <p className="text-xs text-foreground/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ConfidenceBar({ label, width, desc, muted }: { label: string; width: string; desc: string; muted?: boolean }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-medium ${muted ? "text-foreground/30" : "text-foreground"}`}>{label}</span>
        <span className="text-[10px] text-foreground/40">{desc}</span>
      </div>
      <div className="h-1.5 w-full bg-border-card rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${muted ? "bg-foreground/10" : "bg-primary"}`} style={{ width }} />
      </div>
    </div>
  );
}
