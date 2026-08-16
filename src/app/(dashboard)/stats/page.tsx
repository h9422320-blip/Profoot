import type { Metadata } from "next";
import Link from "next/link";
import { Target, Brain } from "lucide-react";
import { getSeasonLabel, getTopScorers } from "@/lib/api-football";

/**
 * Les meilleurs buteurs des grands championnats.
 *
 * CE QUI A CHANGÉ
 *
 * Les chiffres étaient déjà réels — la liste écrite à la main, Haaland 29 buts
 * et Lewandowski 26 figés sur une saison révolue, avait été retirée. Le défaut
 * restant était ailleurs : la page les chargeait DANS LE NAVIGATEUR. Un moteur
 * de recherche recevait donc une page vide, et un visiteur sur connexion lente
 * un écran d'attente.
 *
 * Elle est maintenant rendue par le serveur : les buteurs se trouvent dans la
 * page envoyée. C'est ce qui permet de répondre à « meilleur buteur Ligue 1 ».
 *
 * Un classement vide reste affiché comme vide. Un classement périmé serait un
 * mensonge ; un classement absent n'en est pas un.
 */

const LIGUES = [
  { id: "epl", label: "Premier League" },
  { id: "laliga", label: "La Liga" },
  { id: "seriea", label: "Serie A" },
  { id: "ligue1", label: "Ligue 1" },
];

export const metadata: Metadata = {
  title: "Meilleurs buteurs des grands championnats",
  description:
    "Le classement des meilleurs buteurs de Premier League, La Liga, Serie A et Ligue 1 : buts et passes décisives de la saison en cours.",
  alternates: { canonical: "https://profootai.com/stats" },
};

export const revalidate = 1800;

export default async function StatsPage() {
  const saison = getSeasonLabel("epl");

  // Un championnat qui ne répond pas ne doit pas emporter les trois autres.
  const paires = await Promise.all(
    LIGUES.map(async (l) => {
      try {
        return [l.id, (await getTopScorers(l.id)) ?? []] as const;
      } catch {
        return [l.id, []] as const;
      }
    })
  );
  const buteurs = Object.fromEntries(paires) as Record<string, any[]>;
  const total = Object.values(buteurs).reduce((n, b) => n + b.length, 0);

  return (
    <div className="space-y-8 pb-20 pt-4">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Meilleurs buteurs
        </h1>
        <p className="text-foreground/50 text-sm font-semibold">
          Premier League, La Liga, Serie A et Ligue 1 — saison {saison}
        </p>
      </header>

      {total === 0 && (
        <p className="text-sm text-white/40 py-8 text-center rounded-[20px] border border-border-card bg-card/60">
          La saison n&apos;a pas encore produit de statistiques de buteurs. Revenez après les
          premières journées.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {LIGUES.map((ligue) => (
          <Classement key={ligue.id} titre={ligue.label} liste={buteurs[ligue.id] ?? []} />
        ))}
      </div>

      <Link
        href="/analyze"
        className="flex items-center justify-center gap-2 w-full sm:w-auto sm:self-start px-6 py-4 min-h-[52px] rounded-full font-black text-[14px] text-[#06231a] bg-primary hover:bg-primary/90 transition"
      >
        <Brain className="w-4 h-4" />
        Analyser un match avec l&apos;IA
      </Link>
    </div>
  );
}

function Classement({ titre, liste }: { titre: string; liste: any[] }) {
  return (
    <section className="rounded-[20px] border border-border-card bg-card/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-border-card flex items-center gap-2.5">
        <Target className="w-4 h-4 text-primary" />
        <h2 className="text-[13px] font-black text-white">{titre}</h2>
      </div>

      {liste.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-white/35">
          Aucun buteur classé pour le moment.
        </p>
      ) : (
        <ol className="divide-y divide-border-card">
          {liste.slice(0, 10).map((b, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="w-5 text-[13px] font-black text-white/30 tabular-nums shrink-0">
                {i + 1}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.logoClub && (
                <img src={b.logoClub} alt="" className="w-5 h-5 object-contain shrink-0" loading="lazy" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-white truncate">{b.nom}</p>
                <p className="text-[11px] text-white/35 truncate">{b.club}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[15px] font-black text-primary tabular-nums">{b.buts}</p>
                {b.passes > 0 && (
                  <p className="text-[10px] text-white/30">{b.passes} passe{b.passes > 1 ? "s" : ""}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
