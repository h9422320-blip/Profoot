import { lireBilanVisites } from '@/lib/mesure-visites';
import { Panneau } from '../_components/Panneaux';
import { Vide } from '../_components/Ui';
import { Activity, DoorOpen, Route, LogOut, ShoppingCart } from 'lucide-react';

/**
 * LA MESURE MAISON, AFFICHÉE.
 *
 * ── POURQUOI ELLE PASSE AVANT CLARITY SUR CETTE PAGE ──────────────────────
 *
 * Elle n'a pas de plafond, ne connaît pas de retard, et répond à la question
 * que Clarity ne sait pas poser : sur quelle page les gens FERMENT.
 *
 * Clarity reste plus bas, pour ce qu'il fait mieux — la comparaison entre pays
 * et navigateurs, et surtout les enregistrements vidéo, que son interface est
 * seule à montrer.
 *
 * ── CE QUI EST DIT, ET CE QUI EST TU ──────────────────────────────────────
 *
 * Les durées ne sont connues que pour les pages effectivement quittées : une
 * fermeture brutale n'en laisse aucune. Le nombre de vues écartées est affiché
 * plutôt que masqué — une moyenne calculée en comptant les trous comme zéro
 * ferait paraître toutes les pages plus courtes qu'elles ne sont.
 */
export default async function MesureMaison({ heures = 24 }: { heures?: number }) {
  const b = await lireBilanVisites(heures);

  if (b.tableAbsente) {
    return (
      <Panneau
        titre="Mesure maison"
        sousTitre="Une étape reste à faire"
        icone={<Activity className="w-4 h-4" />}
        teinte="cyan"
      >
        <Vide message="La table n'existe pas encore. Passez le contenu de supabase/mesure-visites.sql dans l'éditeur SQL de Supabase, puis rechargez cette page." />
      </Panneau>
    );
  }

  if (!b.visites) {
    return (
      <Panneau
        titre="Mesure maison"
        sousTitre={`Aucune visite enregistrée sur ${heures} h`}
        icone={<Activity className="w-4 h-4" />}
        teinte="cyan"
      >
        <Vide message="La mesure vient d'être posée : les premiers chiffres apparaîtront dès qu'un visiteur ouvrira une page." />
      </Panneau>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Les chiffres d'ensemble ──────────────────────────────────────── */}
      <div className="rounded-[20px] border border-primary/25 bg-primary/[0.05] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-[13px] font-black uppercase tracking-wider text-foreground">
            Mesure maison — {heures} dernières heures
          </h2>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-primary">
            temps réel · sans plafond
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { libelle: 'Visites', valeur: b.visites.toLocaleString('fr-FR') },
            { libelle: 'Pages vues', valeur: b.pagesVues.toLocaleString('fr-FR') },
            { libelle: 'Pages par visite', valeur: String(b.pagesParVisite) },
            {
              libelle: 'Repartis aussitôt',
              valeur: `${b.tauxUnePage} %`,
              aide: 'une seule page vue',
            },
          ].map((c) => (
            <div key={c.libelle} className="rounded-[14px] bg-sidebar/40 px-3 py-2.5">
              <span className="block text-[22px] font-black text-foreground tabular-nums leading-none">
                {c.valeur}
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mt-1">
                {c.libelle}
              </span>
              {c.aide && (
                <span className="block text-[9.5px] text-foreground/30 mt-0.5">{c.aide}</span>
              )}
            </div>
          ))}
        </div>

        {b.partMobile !== null && (
          <p className="text-[11.5px] text-foreground/50 mt-3.5 leading-relaxed">
            {b.partMobile} % des visites se font sur téléphone.
          </p>
        )}
      </div>

      {/* ── LE TUNNEL DE VENTE ───────────────────────────────────────────
          Le 23 août 2026, on connaissait les deux bouts et rien du milieu :
          900 personnes voyaient les tarifs, 417 arrivaient en caisse, 48
          payaient. Trois cent soixante-neuf décrochaient quelque part, sans
          qu'on puisse dire où — donc sans pouvoir corriger autrement qu'au
          hasard. */}
      {b.entonnoir.some((e) => e.visites > 0) && (
        <Panneau
          titre="Le tunnel de vente"
          sousTitre="De la page des tarifs au départ vers la caisse"
          icone={<ShoppingCart className="w-4 h-4" />}
          teinte="or"
        >
          <div className="space-y-2.5">
            {b.entonnoir.map((e) => {
              const perte = e.partPrecedente !== null && e.partPrecedente < 50;
              const issue = e.cle.startsWith('notice-') || e.cle === 'echec-lien';
              return (
                <div key={e.cle} className={issue ? 'pl-5' : ''}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[18px] font-black text-foreground tabular-nums w-14 text-right shrink-0">
                      {e.visites}
                    </span>
                    <span className="text-[12.5px] text-foreground/75 flex-1 min-w-0">
                      {e.libelle}
                    </span>
                    {e.partPrecedente !== null && (
                      <span
                        className={`text-[12px] font-bold tabular-nums shrink-0 ${
                          perte ? 'text-warning' : 'text-primary'
                        }`}
                      >
                        {e.partPrecedente} %
                      </span>
                    )}
                  </div>
                  {e.perdues > 0 && !issue && (
                    <p className="text-[11px] text-warning/70 ml-[68px] mt-0.5">
                      {e.perdues} personne{e.perdues > 1 ? 's' : ''} perdue
                      {e.perdues > 1 ? 's' : ''} à cette marche
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-foreground/35 mt-4 leading-relaxed">
            Les trois lignes en retrait sont les issues de la notice de paiement : elles se
            partagent ceux qui ont cliqué sur une offre, elles ne se suivent pas. Cliquer
            « Continuer » est une décision, laisser filer les vingt secondes est de
            l&apos;indifférence, fermer est un refus — les distinguer dit s&apos;il faut
            raccourcir le délai, réécrire le texte, ou ne rien changer.
          </p>
        </Panneau>
      )}

      {/* ── LÀ OÙ ILS FERMENT ────────────────────────────────────────────── */}
      {b.sorties.length > 0 && (
        <Panneau
          titre="Où les visiteurs ferment"
          sousTitre="Dernière page du passage, rapportée à ses vues"
          icone={<LogOut className="w-4 h-4" />}
          teinte="violet"
        >
          <div className="space-y-2">
            {b.sorties.map((p) => (
              <div key={p.chemin} className="flex items-center gap-3 text-[12.5px]">
                <span className="font-black text-warning tabular-nums w-14 text-right shrink-0">
                  {p.tauxDeSortie} %
                </span>
                <span className="text-foreground/80 truncate">{p.chemin}</span>
                <span className="text-foreground/35 text-[11px] ml-auto shrink-0 tabular-nums">
                  {p.sorties} / {p.vues} vues
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-foreground/35 mt-3 leading-relaxed">
            Un taux élevé n&apos;est pas toujours mauvais : on ferme normalement après
            avoir lu son analyse. Il l&apos;est sur une page qui devait mener ailleurs —
            les tarifs, le paiement.
          </p>
        </Panneau>
      )}

      {/* ── Le tableau des pages ─────────────────────────────────────────── */}
      <Panneau
        titre="Les pages"
        sousTitre="Fréquentation, temps passé, arrivées et sorties"
        icone={<DoorOpen className="w-4 h-4" />}
      >
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[12px] min-w-[560px]">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-foreground/35">
                <th className="text-left pb-2">Page</th>
                <th className="text-right pb-2">Vues</th>
                <th className="text-right pb-2">Temps moyen</th>
                <th className="text-right pb-2">Arrivées</th>
                <th className="text-right pb-2">Sorties</th>
              </tr>
            </thead>
            <tbody>
              {b.pages.map((p) => (
                <tr key={p.chemin} className="border-t border-border-card">
                  <td className="py-2 pr-3 text-foreground/80 font-medium truncate max-w-[220px]">
                    {p.chemin}
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground/70">{p.vues}</td>
                  <td className="py-2 text-right tabular-nums text-foreground/70">
                    {p.secondesMoyennes != null ? `${p.secondesMoyennes} s` : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground/70">
                    {p.arrivees || '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-foreground/70">
                    {p.sorties || '—'} <span className="text-foreground/30">({p.tauxDeSortie} %)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panneau>

      {/* ── LES CHEMINS SUIVIS — ce que Clarity ne donne pas ─────────────── */}
      {b.cheminsFrequents.length > 0 && (
        <Panneau
          titre="Les chemins les plus suivis"
          sousTitre="L'ordre dans lequel les pages sont ouvertes"
          icone={<Route className="w-4 h-4" />}
          teinte="cyan"
        >
          <div className="space-y-2">
            {b.cheminsFrequents.map((c) => (
              <div key={c.parcours} className="flex items-start gap-3 text-[12px]">
                <span className="font-black text-primary tabular-nums w-10 text-right shrink-0">
                  {c.passages}
                </span>
                <span className="text-foreground/70 leading-relaxed break-words">
                  {c.parcours}
                </span>
              </div>
            ))}
          </div>
        </Panneau>
      )}

      {/* ── Pays ─────────────────────────────────────────────────────────── */}
      {b.pays.length > 0 && (
        <Panneau titre="Pays des visites" icone={<Activity className="w-4 h-4" />}>
          <div className="space-y-1.5">
            {b.pays.map((p) => (
              <div key={p.valeur} className="flex items-center gap-3 text-[12.5px]">
                <span className="tabular-nums font-bold text-foreground/70 w-12 text-right shrink-0">
                  {p.visites}
                </span>
                <span className="text-foreground/70">{p.valeur}</span>
              </div>
            ))}
          </div>
        </Panneau>
      )}
    </div>
  );
}
