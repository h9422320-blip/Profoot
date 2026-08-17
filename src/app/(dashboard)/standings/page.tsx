"use client";

import { Trophy, Loader2, CalendarClock, Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { competitions } from "@/lib/data";
import { getSeasonLabel } from "@/lib/api-football";
import { listerCompetitionsSuivies, type CompetitionSuivie } from "@/lib/competitions-suivies";
// Le MÊME calcul que celui qui a rempli la réserve d'équipes : un lien de
// classement doit tomber exactement sur l'identifiant de la fiche, sinon il
// mène à une page introuvable.
import { slugify as slugClub } from "@/lib/teams-live";

const leagueOrder = ["epl", "laliga", "seriea", "bundesliga", "ligue1"];

interface Ligne {
  rang: number; equipe: string; logo: string; groupe?: string | null; joues: number;
  gagnes: number; nuls: number; perdus: number;
  bp: number; bc: number; diff: number; points: number; forme: string[];
}
interface Classement { saison: string; aCommence: boolean; lignes: Ligne[]; }

/**
 * Les classements.
 *
 * CINQ CHAMPIONNATS SUR CINQUANTE-HUIT
 *
 * La page annonçait « les 5 grands championnats européens » — c'était honnête,
 * mais l'application en suit cinquante-huit et connaît le classement de chacun.
 * Un abonné qui suit le Portugal, la Suisse ou la Pologne devait ouvrir la
 * fiche de la compétition pour le voir.
 *
 * CHARGÉS À LA DEMANDE, ET C'EST VOULU
 *
 * Les cinq grands s'affichent d'emblée. Les autres arrivent quand on les
 * déplie : aller chercher cinquante-huit classements à l'ouverture coûterait
 * autant d'appels au fournisseur, et le quota a déjà frôlé la rupture le
 * 16 août. Un classement déjà lu est conservé en base et ne coûte plus rien.
 */
export default function StandingsPage() {
  const [classements, setClassements] = useState<Record<string, Classement>>({});
  const [statuts, setStatuts] = useState<Record<string, any>>({});
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    Promise.all([
      fetch('/api/standings/live').then(r => (r.ok ? r.json() : { classements: {} })),
      fetch('/api/competitions/status').then(r => (r.ok ? r.json() : { statuses: {} })),
    ])
      .then(([c, s]) => { setClassements(c.classements || {}); setStatuts(s.statuses || {}); })
      .catch(() => { /* on n'affiche rien plutôt que des chiffres faux */ })
      .finally(() => setChargement(false));
  }, []);

  // Les autres championnats : tout ce que le moteur suit, moins les cinq déjà
  // dépliés et moins les coupes, qui ont des poules et un tableau final plutôt
  // qu'un classement.
  const autres = useMemo(
    () =>
      listerCompetitionsSuivies().filter(
        (c) => c.region === "europe" && !leagueOrder.includes(c.id)
      ),
    []
  );

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return autres;
    return autres.filter(
      (c) => c.nom.toLowerCase().includes(q) || c.pays.toLowerCase().includes(q)
    );
  }, [autres, recherche]);

  /** Déplie un championnat, et va chercher son classement la première fois. */
  async function basculer(comp: CompetitionSuivie) {
    if (ouvert === comp.id) { setOuvert(null); return; }
    setOuvert(comp.id);
    if (classements[comp.id]) return;

    setEnCours(comp.id);
    try {
      const r = await fetch(`/api/standings/live?id=${comp.id}`);
      const data = r.ok ? await r.json() : { classements: {} };
      if (data.classements?.[comp.id]) {
        setClassements((c) => ({ ...c, [comp.id]: data.classements[comp.id] }));
      }
    } catch {
      /* le message « classement indisponible » s'affichera */
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Classements</h1>
        <p className="text-foreground/50 text-sm mt-1">
          Les classements officiels des {autres.length + leagueOrder.length} championnats suivis •
          Saison {getSeasonLabel('epl')}
        </p>
      </div>

      {chargement && (
        <div className="flex items-center justify-center py-16 gap-3 text-foreground/50">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Récupération des classements officiels…</span>
        </div>
      )}

      {!chargement && leagueOrder.map(leagueId => {
        const comp = competitions.find(c => c.id === leagueId);
        const cl = classements[leagueId];
        if (!comp) return null;

        return (
          <div key={leagueId} className="bg-card border border-border-card rounded-[16px] overflow-hidden">
            <Link href={`/competitions/${leagueId}`} className="px-5 py-4 border-b border-border-card flex items-center gap-3 hover:bg-sidebar/50 transition-colors">
              <img src={comp.logo} alt={comp.shortName} className="w-6 h-6 object-contain" />
              <h2 className="text-sm font-bold text-foreground">{comp.name}</h2>
              {statuts[leagueId]?.status && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                  {statuts[leagueId].status}
                </span>
              )}
            </Link>

            {/* Tant qu'aucun match n'est joué, le classement est vide : on le dit
                clairement au lieu d'afficher un tableau de la saison passée. */}
            {!cl || !cl.aCommence ? (
              <PasCommence statut={statuts[leagueId]?.status} />
            ) : (
              <Tableau lignes={cl.lignes} />
            )}
          </div>
        );
      })}

      {/* ── Tous les autres championnats ─────────────────────────────────── */}
      {!chargement && (
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
              Les autres championnats
            </h2>
            <p className="text-xs text-foreground/40">
              {autres.length} championnats suivis. Dépliez-en un pour voir son classement.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-foreground/30 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un championnat ou un pays…"
              className="w-full bg-card border border-border-card rounded-[14px] py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {filtres.length === 0 && (
            <p className="text-sm text-foreground/40 py-6 text-center">
              Aucun championnat ne correspond à « {recherche} ».
            </p>
          )}

          <div className="space-y-2">
            {filtres.map((comp) => {
              const cl = classements[comp.id];
              const estOuvert = ouvert === comp.id;

              return (
                <div key={comp.id} className="bg-card border border-border-card rounded-[16px] overflow-hidden">
                  <button
                    onClick={() => basculer(comp)}
                    aria-expanded={estOuvert}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-sidebar/50 transition-colors"
                  >
                    <img src={comp.logo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" />
                    <span className="text-sm font-bold text-foreground truncate">{comp.nom}</span>
                    <span className="text-xs text-foreground/40 shrink-0">{comp.pays}</span>
                    {statuts[comp.id]?.status && (
                      <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20 truncate max-w-[45%]">
                        {statuts[comp.id].status}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-foreground/30 shrink-0 ml-auto transition-transform ${estOuvert ? "rotate-180" : ""}`}
                    />
                  </button>

                  {estOuvert && (
                    <div className="border-t border-border-card">
                      {enCours === comp.id ? (
                        <div className="flex items-center justify-center py-10 gap-3 text-foreground/50">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Récupération du classement…</span>
                        </div>
                      ) : !cl ? (
                        // Ni chiffres inventés ni tableau vide qui laisserait
                        // croire à un bug : on dit ce qui se passe.
                        <div className="px-5 py-8 text-center space-y-2">
                          <p className="text-sm font-semibold text-foreground/70">
                            Classement indisponible pour le moment
                          </p>
                          <Link
                            href={`/competitions/${comp.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Voir la page de la compétition
                          </Link>
                        </div>
                      ) : !cl.aCommence ? (
                        <PasCommence statut={statuts[comp.id]?.status} />
                      ) : (
                        <Tableau lignes={cl.lignes} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-foreground/35">
            Les coupes — Ligue des champions, Europa, Conference, CAN — ont des poules et un
            tableau final :{" "}
            <Link href="/competitions" className="text-primary hover:underline">
              elles se consultent sur leur page
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}

function PasCommence({ statut }: { statut?: string }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center gap-2">
      <CalendarClock className="w-6 h-6 text-foreground/30" />
      <p className="text-sm font-semibold text-foreground/70">La saison n&apos;a pas encore commencé</p>
      <p className="text-xs text-foreground/40 max-w-sm">
        {statut
          ? `${statut}. Le classement s'affichera dès la première journée.`
          : "Le classement s'affichera dès la première journée."}
      </p>
    </div>
  );
}

function Tableau({ lignes }: { lignes: Ligne[] }) {
  // La Belgique et l'Écosse coupent leur saison en deux tableaux : sans ce
  // découpage, les deux se suivraient et le classement recommencerait à 1 au
  // milieu, sans qu'on sache pourquoi.
  const groupes = new Map<string, Ligne[]>();
  for (const l of lignes) {
    const cle = l.groupe || "";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push(l);
  }
  const plusieurs = groupes.size > 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] text-foreground/40 uppercase bg-sidebar/30 border-b border-border-card">
          <tr>
            <th className="px-4 py-3 text-left font-medium w-8">#</th>
            <th className="px-4 py-3 text-left font-medium">Club</th>
            <th className="px-4 py-3 text-center font-medium">MJ</th>
            <th className="px-4 py-3 text-center font-medium">V</th>
            <th className="px-4 py-3 text-center font-medium">N</th>
            <th className="px-4 py-3 text-center font-medium">D</th>
            <th className="px-4 py-3 text-center font-medium">BP</th>
            <th className="px-4 py-3 text-center font-medium">BC</th>
            <th className="px-4 py-3 text-center font-medium">Diff</th>
            <th className="px-4 py-3 text-center font-medium">Forme</th>
            <th className="px-4 py-3 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-card/50">
          {[...groupes.entries()].map(([nomGroupe, rangees]) => (
            <BlocGroupe key={nomGroupe} nom={plusieurs ? nomGroupe : ""} rangees={rangees} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocGroupe({ nom, rangees }: { nom: string; rangees: Ligne[] }) {
  return (
    <>
      {nom && (
        <tr className="bg-sidebar/20">
          <td colSpan={11} className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-foreground/50">
            {nom}
          </td>
        </tr>
      )}
      {rangees.map((row, i) => {
        const isChampion = i === 0;
        const isUCL = i < 4;
        return (
          <tr key={`${nom}-${row.equipe}`} className={`hover:bg-sidebar/30 transition-colors ${isChampion ? "bg-primary/5" : ""}`}>
            <td className="px-4 py-3">
              <span className={`text-xs font-bold ${isUCL ? "text-primary" : "text-foreground/50"}`}>{row.rang}</span>
            </td>
            <td className="px-4 py-3">
              {/* Chaque club mène à sa fiche.
                  Le classement cite les huit cents clubs suivis
                  sans jamais y renvoyer : un moteur découvre les
                  pages en suivant les liens, et ces fiches
                  n'étaient atteignables que par le plan du site.
                  C'est aussi le geste attendu par le lecteur —
                  voir le détail d'une équipe du tableau. */}
              <Link
                href={`/club/${slugClub(row.equipe)}`}
                className="flex items-center gap-2 group/club"
              >
                <img src={row.logo} alt={row.equipe} className="w-6 h-6 rounded-full bg-card" />
                <span className="text-xs font-semibold text-foreground group-hover/club:text-primary transition-colors">
                  {row.equipe}
                </span>
                {isChampion && <Trophy className="w-3 h-3 text-warning" />}
              </Link>
            </td>
            <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.joues}</td>
            <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.gagnes}</td>
            <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.nuls}</td>
            <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.perdus}</td>
            <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.bp}</td>
            <td className="px-4 py-3 text-center text-xs text-foreground/60">{row.bc}</td>
            <td className="px-4 py-3 text-center text-xs font-medium">
              <span className={row.diff > 0 ? "text-primary" : row.diff < 0 ? "text-danger" : "text-foreground/50"}>
                {row.diff > 0 ? "+" : ""}{row.diff}
              </span>
            </td>
            <td className="px-4 py-3 text-center">
              <div className="flex gap-0.5 justify-center">
                {row.forme.map((f, j) => (
                  <span key={j} className={`w-4 h-4 rounded-full text-[7px] font-bold flex items-center justify-center ${f === "W" ? "bg-primary/20 text-primary" : f === "D" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}>{f}</span>
                ))}
              </div>
            </td>
            <td className="px-4 py-3 text-right text-sm font-black text-foreground">{row.points}</td>
          </tr>
        );
      })}
    </>
  );
}
