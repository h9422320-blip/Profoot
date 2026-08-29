import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import { getOrigineAcheteurs } from "@/lib/origine-acheteurs";
import { getBilanEchecsPaiement } from "@/lib/echecs-paiement";
import BoutonRelever from "./BoutonRelever";
import SelecteurPeriode from "../_components/SelecteurPeriode";
import { LienCompte, Vide, dateHeure, montant } from "../_components/Ui";
import { Panneau } from "../_components/Panneaux";
import { Indicateur } from "../_components/Indicateur";
import { EnTete, Rapport } from "../_components/EnTete";
import { AlertTriangle, Globe, Info, Receipt, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLogs({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const params = await searchParams;
  const periode = resoudrePeriode(params);
  const [m, origine, echecs] = await Promise.all([
    getAdminMetrics(periode),
    getOrigineAcheteurs(),
    getBilanEchecsPaiement(),
  ]);

  const parEvenement = new Map<string, number>();
  for (const p of m.paiements) parEvenement.set(p.evenement, (parEvenement.get(p.evenement) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <EnTete
        titre="Journal des paiements"
        sousTitre="Notifications reçues de Chariow, telles qu'enregistrées par l'application"
        icone={<Receipt className="w-6 h-6" />}
        teinte="or"
        action={<SelecteurPeriode />}
        reperes={[
          { libelle: "Événements reçus", valeur: String(m.paiements.length) },
          { libelle: "Abonnements créés", valeur: String(m.abonnements.total) },
          {
            libelle: "Aboutissement",
            valeur: `${m.liens.tauxAboutissementPaiements} %`,
            accent: m.liens.tauxAboutissementPaiements >= 80,
          },
          { libelle: "Encaissé", valeur: montant(m.revenus.totalCumule, m.revenus.devise) },
        ]}
      />

      {/* Les achats à l'unité, comptés à part.
          Les fondre dans le revenu total masquerait exactement ce qu'on veut
          mesurer : la petite porte fait-elle entrer des gens qui n'auraient
          jamais pris d'abonnement ? */}
      {m.revenus.matchsUniques.nombre > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Indicateur
            libelle="Matchs vendus à l'unité"
            valeur={m.revenus.matchsUniques.nombre}
            teinte="cyan"
            aide="Achats uniques, hors abonnement"
            delai={0.05}
          />
          <Indicateur
            libelle="Encaissé à l'unité"
            valeur={montant(m.revenus.matchsUniques.totalXof, m.revenus.devise)}
            teinte="or"
            aide="Compté séparément des abonnements"
            delai={0.1}
          />
          <Indicateur
            libelle="Acheteurs non abonnés"
            valeur={m.revenus.matchsUniques.acheteursSansAbonnement}
            teinte="vert"
            aide="Comptes que seule la vente à l'unité a fait payer"
            delai={0.15}
          />
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicateur
          libelle="Événements reçus"
          valeur={m.paiements.length}
          teinte="cyan"
          icone={<Info className="w-4 h-4" />}
          aide="100 plus récents"
          delai={0.05}
        />
        <Indicateur
          libelle="Abonnements créés"
          valeur={m.abonnements.total}
          teinte="violet"
          aide={`${m.liens.tauxAboutissementPaiements} % des notifications ont produit un abonnement`}
          delai={0.1}
        />
        <Indicateur
          libelle="Abonnements actifs"
          valeur={m.abonnements.actifs}
          teinte="vert"
          aide={`${m.abonnements.expires} expiré${m.abonnements.expires > 1 ? "s" : ""} • ${m.abonnements.expirentBientot} à relancer sous 7 jours`}
          delai={0.15}
        />
        <Indicateur
          libelle="Total encaissé"
          valeur={montant(m.revenus.totalCumule, m.revenus.devise)}
          teinte="or"
          aide={`${m.liens.revenuParAbonne.toLocaleString("fr-FR")} FCFA par abonné actif`}
          delai={0.2}
        />
      </div>

      {/* Un paiement notifié qui ne devient pas un abonnement est un client qui
          a payé sans rien recevoir. C'est le seul chiffre de cette page qui
          demande une action immédiate. */}
      {m.paiements.length > 0 && m.liens.tauxAboutissementPaiements < 80 && (
        <div className="flex items-start gap-3 p-4 rounded-[18px] bg-amber-500/10 border border-amber-500/25">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-300">
              {m.liens.tauxAboutissementPaiements} % des notifications ont abouti à un abonnement
            </p>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              {m.paiements.length} événement{m.paiements.length > 1 ? "s" : ""} reçu{m.paiements.length > 1 ? "s" : ""} pour{" "}
              {m.abonnements.total} abonnement{m.abonnements.total > 1 ? "s" : ""} créé{m.abonnements.total > 1 ? "s" : ""}. Toutes les
              notifications ne sont pas des ventes — annulations et tests en font partie — mais un écart durable
              signale des clients qui ont payé sans rien recevoir.
            </p>
          </div>
        </div>
      )}

      {/* Une détection de pays qui échoue ne se voit nulle part ailleurs : elle
          ne provoque aucune erreur, elle envoie simplement l'acheteur sur les
          mauvais moyens de paiement. C'est exactement ce qui s'est produit, et
          il a fallu lire un tableau de ventes à la main pour s'en apercevoir. */}
      {origine.enEchec > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-[18px] bg-rose-500/10 border border-rose-500/30">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-rose-300">
              {origine.enEchec} paiement{origine.enEchec > 1 ? "s" : ""} sans pays détecté
            </p>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
              Aucun indice n&apos;a permis de situer ces acheteurs : ils ont reçu la page de paiement du pays par
              défaut, donc peut-être les mauvais moyens de paiement. Si ce nombre monte, l&apos;en-tête de
              géolocalisation n&apos;arrive plus jusqu&apos;au serveur.
            </p>
          </div>
        </div>
      )}

      {/* Pourquoi l'argent ne rentre pas.
          Le taux d'aboutissement se voyait déjà ; ce qui manquait, c'était la
          cause. Sans elle il n'y a rien à corriger, seulement des hypothèses. */}
      <Panneau
        titre="Pourquoi les paiements n'aboutissent pas"
        sousTitre="Relevé auprès de la boutique, demande par demande"
        icone={<XCircle className="w-4 h-4" />}
        teinte={echecs.refuses > 0 ? "rose" : "or"}
        action={<BoutonRelever />}
      >
        {echecs.indisponible ? (
          <Vide message="Le relevé des paiements est hors service : la base n'a pas répondu. Ce n'est pas « aucun échec » — c'est « on ne sait pas »." />
        ) : echecs.total === 0 ? (
          <Vide message="Aucune demande de paiement sur les quinze derniers jours." />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Rapport
                libelle="Repartis sans essayer"
                valeur={String(echecs.repartiesSansEssayer)}
                pourcentage={
                  echecs.total ? (echecs.repartiesSansEssayer / echecs.total) * 100 : 0
                }
                teinte="#94a3b8"
                detail="La page s'est ouverte, aucun moyen de paiement n'a été choisi. Rien n'a échoué : ils ont renoncé avant."
              />
              <Rapport
                libelle="Paiements refusés"
                valeur={String(echecs.refuses)}
                pourcentage={echecs.total ? (echecs.refuses / echecs.total) * 100 : 0}
                teinte="#fb7185"
                detail="Le paiement a réellement été tenté, puis rejeté. C'est là que les causes ci-dessous s'appliquent."
              />
              <Rapport
                libelle="Payés"
                valeur={String(echecs.payees)}
                pourcentage={echecs.total ? (echecs.payees / echecs.total) * 100 : 0}
                detail={
                  echecs.nonRelevees > 0
                    ? `${echecs.nonRelevees} demande(s) pas encore relevée(s) auprès de la boutique`
                    : "Toutes les demandes ont été relevées"
                }
              />
            </div>

            {echecs.causes.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2.5">
                  Motifs des refus
                </p>
                <div className="space-y-2">
                  {echecs.causes.map((c) => (
                    <div key={c.code} className="px-4 py-3 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-bold text-white">{c.libelle}</span>
                        <span className="text-sm font-black text-rose-400 tabular-nums shrink-0">
                          {c.nombre} <span className="text-white/30 text-xs">({c.part} %)</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{c.explication}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quelqu'un qui recommence veut payer. C'est le signal le plus fort
                du tableau, et le seul sur lequel une relance a du sens. */}
            {echecs.insistants.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2.5">
                  Ont essayé plusieurs fois sans jamais aboutir
                </p>
                <div className="space-y-1.5">
                  {/* Une clé tirée au hasard change à chaque rendu : React
                      considère alors la ligne comme neuve et la remonte
                      entièrement. Le rang est stable, et il suffit ici. */}
                  {echecs.insistants.map((p, i) => (
                    <div
                      key={p.email ?? p.userId ?? `anonyme-${i}`}
                      className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-amber-500/[0.07] border border-amber-500/20"
                    >
                      <span className="text-sm font-black text-amber-400 tabular-nums shrink-0">
                        {p.tentatives}×
                      </span>
                      <span className="text-[13px] text-white/70 flex-1 min-w-[160px] truncate">
                        <LienCompte userId={p.userId} email={p.email} />
                      </span>
                      <span className="text-[11px] text-white/40">
                        {p.causes.length ? p.causes.join(" · ") : "n'a jamais choisi de moyen de paiement"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {echecs.demandes.map((d) => (
                <div
                  key={d.saleId}
                  className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                  title={d.causeExplication}
                >
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                      d.aPaye
                        ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                        : d.cause
                          ? "text-rose-400 bg-rose-500/10 border-rose-500/25"
                          : "text-white/40 bg-white/5 border-white/10"
                    }`}
                  >
                    {d.statutLibelle}
                  </span>
                  {d.causeLibelle && (
                    <span className="text-[11px] font-bold text-rose-300">{d.causeLibelle}</span>
                  )}
                  <span className="text-[12px] text-white/50 flex-1 min-w-[150px] truncate">
                    <LienCompte userId={d.userId} email={d.email} />
                  </span>
                  <span className="text-[11px] text-white/35">
                    {d.montant !== null ? montant(d.montant) : "—"}
                  </span>
                  {d.moyen && <span className="text-[11px] text-white/30">{d.moyen}</span>}
                  <span className="text-[11px] text-white/25 whitespace-nowrap">{dateHeure(d.creeeLe)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panneau>

      <Panneau
        titre="D'où viennent vos acheteurs"
        sousTitre="Relevé par l'application au moment du clic, indépendamment de la boutique"
        icone={<Globe className="w-4 h-4" />}
        teinte="cyan"
      >
        {origine.total === 0 ? (
          <Vide
            message={
              origine.sansOrigine > 0
                ? `${origine.sansOrigine} intention${origine.sansOrigine > 1 ? "s" : ""} enregistrée${origine.sansOrigine > 1 ? "s" : ""} avant la collecte de l'origine. Les prochaines seront situées.`
                : "Aucune intention de paiement enregistrée pour l'instant."
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {origine.pays.map((p) => (
                <Rapport
                  key={p.code}
                  libelle={`${p.drapeau} ${p.nom}`}
                  valeur={`${p.nombre} / ${origine.total}`}
                  pourcentage={p.part}
                  teinte="#22d3ee"
                  detail={`${p.part} % des demandes de paiement`}
                />
              ))}
            </div>

            <div className="text-[11px] text-white/35 leading-relaxed">
              {origine.total} demande{origine.total > 1 ? "s" : ""} située{origine.total > 1 ? "s" : ""} par adresse IP
              {origine.approchees > 0 && (
                <>
                  {" "}— dont {origine.approchees} obtenue{origine.approchees > 1 ? "s" : ""} par le fuseau horaire,
                  donc approximative{origine.approchees > 1 ? "s" : ""}
                </>
              )}
              {origine.sansOrigine > 0 && (
                <>
                  . {origine.sansOrigine} demande{origine.sansOrigine > 1 ? "s" : ""} plus ancienne
                  {origine.sansOrigine > 1 ? "s" : ""} n&apos;{origine.sansOrigine > 1 ? "ont" : "a"} pas d&apos;origine :
                  elle{origine.sansOrigine > 1 ? "s" : ""} date{origine.sansOrigine > 1 ? "nt" : ""} d&apos;avant la
                  collecte, et rien n&apos;est inventé rétroactivement
                </>
              )}
              .
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {origine.recentes.map((r) => (
                <div
                  key={r.saleId}
                  className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 rounded-[14px] bg-[#1d2f3a] border border-[#2e4757]"
                >
                  <span className="text-base leading-none" title={r.paysNom}>
                    {r.drapeau}
                  </span>
                  <span className="text-xs font-bold text-white/70 min-w-[110px]">{r.paysNom}</span>
                  <span className="text-sm text-white/60 flex-1 min-w-[170px] truncate">
                    <LienCompte userId={r.userId} email={r.email} />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40 bg-[#16242e] border border-[#2e4757] rounded-full px-2 py-0.5">
                    {r.plan}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      r.honoree
                        ? "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25"
                        : "text-amber-400 bg-amber-500/10 border-amber-500/25"
                    }`}
                  >
                    {r.honoree ? "abonné" : "en attente"}
                  </span>
                  {r.source && r.source !== "ip" && (
                    <span
                      className="text-[10px] font-bold text-amber-400/80"
                      title="Pays approché : l'adresse IP n'était pas disponible"
                    >
                      {r.source}
                    </span>
                  )}
                  <span className="text-[11px] text-white/30 whitespace-nowrap">{dateHeure(r.creeeLe)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panneau>

      {parEvenement.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...parEvenement.entries()].map(([nom, n]) => (
            <span key={nom} className="text-xs font-bold text-white/70 bg-[#1d2f3a] border border-[#2e4757] rounded-full px-3 py-1.5">
              {nom} <span className="text-[#10b981]">{n}</span>
            </span>
          ))}
        </div>
      )}

      <div className="bg-[#16242e] border border-[#2e4757] rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2e4757]">
          <h3 className="font-bold text-white text-sm">Historique complet</h3>
        </div>

        {m.paiements.length === 0 ? (
          <Vide message="Aucun événement de paiement enregistré." />
        ) : (
          <div className="divide-y divide-[#2e4757]/50">
            {m.paiements.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/50 bg-[#1d2f3a] border border-[#2e4757] rounded-full px-2 py-0.5">
                  {p.fournisseur}
                </span>
                <span className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 rounded-full px-2.5 py-0.5">
                  {p.evenement}
                </span>
                <span className="text-sm text-white/70 flex-1 min-w-[160px] truncate">
                  <LienCompte userId={p.userId} email={p.email} />
                </span>
                {p.montant !== null && (
                  <span className="text-sm font-bold text-white">{montant(p.montant, p.devise ?? "XOF")}</span>
                )}
                <span className="text-[11px] text-white/35 whitespace-nowrap">{dateHeure(p.recuLe)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Panneau>
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
          <p className="text-sm text-white/50 leading-relaxed">
            Cette page ne montre que ce qui est réellement enregistré en base : les notifications de paiement.
            Les erreurs techniques de l'application (échecs de l'IA, délais d'attente, erreurs réseau) ne sont pas
            stockées dans la base — elles se consultent dans les journaux de Vercel. Aucune ligne affichée ici
            n'est simulée.
          </p>
        </div>
      </Panneau>
    </div>
  );
}
