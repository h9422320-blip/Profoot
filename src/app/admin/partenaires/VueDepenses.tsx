/**
 * LES FRAIS DE FONCTIONNEMENT — LE DESSIN SEUL.
 *
 * ── POURQUOI LE DESSIN EST SÉPARÉ DE LA LECTURE ───────────────────────────
 *
 * `BlocDepenses` lit la session et la base ; ce fichier-ci ne fait que
 * dessiner ce qu'on lui donne. La séparation n'est pas de l'élégance : elle
 * permet de REGARDER l'écran du fondateur au navigateur, avec des chiffres
 * d'exemple, sans jamais emprunter son compte ni ouvrir une porte dérobée dans
 * le contrôle d'accès. Le propriétaire demande une vérification vue, pas une
 * lecture de code — et cette vérification ne doit pas coûter une faille.
 *
 * Aucune décision d'autorisation ici : `fondateur` ARRIVE déjà tranché, et la
 * garde qui compte vit dans les actions serveur (voir `actions.ts`), parce
 * qu'une action est une adresse appelable directement.
 */
import { FOURNISSEURS, libelleDepense, type LigneDepense, type MoisDeDepenses } from "@/lib/depenses";
import { Panneau } from "../_components/Panneaux";
import { ajouterDepense, supprimerDepense, reglerTauxDollar } from "./actions";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/** Le jour en court — « 26/09 » — parce que l'année est déjà dans le titre du mois. */
const jourCourt = (iso: string) => {
  const [, m, j] = String(iso).split("-");
  return j && m ? `${j}/${m}` : String(iso);
};

/** Le mois en clair : « septembre 2026 », pas « 2026-09 ». */
const moisEnClair = (mois: string) => {
  const [an, m] = String(mois).split("-").map(Number);
  if (!an || !m) return String(mois);
  return new Date(Date.UTC(an, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const champ =
  "min-h-[44px] rounded-[12px] border border-white/10 bg-[#0f1b23] px-3 text-[12px] text-white placeholder:text-white/25";

export default function VueDepenses({
  fondateur,
  taux,
  mois,
}: {
  /** Le fondateur écrit ; le partenaire lit. Tranché en amont. */
  fondateur: boolean;
  /** Francs CFA pour un dollar, tel qu'il s'appliquera aux prochaines dépenses. */
  taux: number;
  /** Les mois, du plus récent au plus ancien. */
  mois: MoisDeDepenses[];
}) {
  const total = mois.reduce((s, m) => s + (Number(m.totalXof) || 0), 0);

  return (
    <Panneau
      titre="Frais de fonctionnement"
      sousTitre={`Retirés du chiffre d'affaires avant le partage · 1 $ = ${taux.toLocaleString("fr-FR")} FCFA`}
      teinte="violet"
    >
      <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
        {fondateur
          ? "Hébergement, base de données, modèles d’analyse, données des matchs, publicité : ce que l’application coûte pour tourner. Chaque ligne inscrite ici sort du chiffre d’affaires avant le calcul de la part du partenaire."
          : "Lecture seule. Ces lignes sont inscrites par le fondateur d’après les factures réelles, et retirées du chiffre d’affaires avant le calcul de votre part."}
      </p>

      {fondateur && (
        <form
          action={ajouterDepense}
          className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6 rounded-[16px] border border-white/10 p-3"
        >
          <input
            type="date"
            name="jour"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            aria-label="Jour du paiement"
            className={`col-span-2 sm:col-span-1 ${champ}`}
          />
          <select name="fournisseur" aria-label="Fournisseur" className={`col-span-2 sm:col-span-1 ${champ}`}>
            {Object.entries(FOURNISSEURS).map(([cle, nom]) => (
              <option key={cle} value={cle}>
                {nom.split(" — ")[0]}
              </option>
            ))}
          </select>
          <input name="libelle" placeholder="abonnement mensuel" aria-label="Libellé" className={`col-span-2 ${champ}`} />
          <input
            name="montant"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="25"
            required
            aria-label="Montant"
            className={champ}
          />
          <select name="devise" aria-label="Devise" className={champ}>
            <option value="USD">$</option>
            <option value="XOF">FCFA</option>
            <option value="EUR">€</option>
          </select>
          <button
            type="submit"
            className="col-span-2 sm:col-span-6 min-h-[44px] rounded-[12px] bg-[#8b5cf6] px-4 text-[12px] font-black text-white"
          >
            Inscrire la dépense
          </button>
        </form>
      )}

      {mois.length === 0 ? (
        /* ── L'ÉTAT VIDE S'AFFICHE, IL NE DISPARAÎT PAS ──────────────────
           « Même si les chiffres ne sont pas là pour le moment, il faut qu'il y
           ait cette partie quand même. » Un bloc masqué quand il est vide ne se
           distingue pas d'un bloc qui n'a jamais été écrit. */
        <div className="rounded-[16px] border border-dashed border-white/15 p-4">
          <p className="text-[12px] text-white/45 leading-relaxed">
            Aucune dépense inscrite pour l’instant. Le suivi commence le 26 septembre 2026 : chaque
            facture payée apparaîtra ici avec sa date, son montant d’origine et sa conversion en
            francs, et sera retirée du chiffre d’affaires du mois avant le partage.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mois.map((m) => (
            <div key={m.mois} className="rounded-[16px] border border-[#2e4757] bg-[#1a2b36] p-3">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <p className="text-[12px] font-black text-white capitalize">{moisEnClair(m.mois)}</p>
                <p className="text-[12px] font-black text-[#c4b5fd] tabular-nums">
                  &minus; {fcfa(m.totalXof)}
                </p>
              </div>
              <ul className="space-y-1.5">
                {m.lignes.map((d: LigneDepense) => (
                  <li key={d.cle} className="flex items-start justify-between gap-2">
                    <span className="text-[11px] text-white/55 leading-relaxed">
                      <span className="tabular-nums">{jourCourt(d.jour)}</span> · {libelleDepense(d)}{" "}
                      <span className="tabular-nums text-white/70">= {fcfa(d.montantXof)}</span>
                    </span>
                    {fondateur && (
                      <form action={supprimerDepense}>
                        <input type="hidden" name="cle" value={d.cle} />
                        <button
                          type="submit"
                          className="min-h-[32px] shrink-0 rounded-[10px] border border-white/10 px-2 text-[10px] font-bold text-white/40"
                        >
                          retirer
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] font-bold text-white/55 tabular-nums">Total inscrit : {fcfa(total)}</p>
        </div>
      )}

      {fondateur && (
        <form action={reglerTauxDollar} className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="taux" className="text-[11px] text-white/40">
            Taux du dollar (les dépenses déjà inscrites gardent le leur)
          </label>
          <input id="taux" name="taux" type="number" min="100" max="2000" defaultValue={taux} className={`w-24 ${champ}`} />
          <button
            type="submit"
            className="min-h-[44px] rounded-[12px] border border-white/10 px-4 text-[12px] font-bold text-white/70"
          >
            Enregistrer
          </button>
        </form>
      )}
    </Panneau>
  );
}
