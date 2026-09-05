'use client';

import { useEffect, useState } from 'react';

/**
 * CE QUE PROFOOT VEND, RAPPELÉ UNE FOIS PAR MOIS.
 *
 * ── LE MESSAGE QUI A PRODUIT CE FICHIER ───────────────────────────────────
 *
 * 5 septembre 2026. Un membre répond au courriel du matin : « Oui mais je
 * commence trop à perdre de l'argent il faut améliorer vos analyses. » Il
 * avait pris l'accès annuel trois jours plus tôt.
 *
 * Ses chiffres, eux, disaient autre chose : dix-sept rencontres vérifiées,
 * 41 % de résultats justes — contre 56 % en moyenne. Ses réussites étaient
 * toutes sur des matchs très déséquilibrés, ses échecs tous sur des matchs
 * serrés. Il n'avait pas un problème d'analyse, il avait un problème
 * d'attente : il croyait acheter des certitudes.
 *
 * ── ET CE QUE CELA FAIT COURIR AU PROJET ──────────────────────────────────
 *
 * Sa phrase établit par écrit qu'il engage de l'argent sur nos analyses. Ce
 * projet a perdu sa boutique en août 2026 sur un contrôle « produits
 * interdits : paris sportifs, jeux de hasard » ; un échange pareil est
 * exactement la pièce qui déclenche le suivant.
 *
 * Ce rappel n'est donc pas une formule pour se couvrir. Il dit la vérité de
 * ce qui est vendu — une lecture statistique — et il la dit à l'endroit où
 * elle se joue : devant le bouton d'analyse.
 *
 * ── POURQUOI UNE SEULE FOIS PAR MOIS ──────────────────────────────────────
 *
 * Un avertissement affiché à chaque visite cesse d'être lu au troisième
 * passage, et devient un meuble qu'on contourne des yeux. Une fois par mois,
 * il est encore lu. C'est aussi la fréquence qui permet de dire, sans mentir,
 * que chaque membre actif l'a vu.
 *
 * Le repère vit dans le navigateur : il ne coûte aucune requête, il n'a
 * aucune valeur pour qui que ce soit, et le perdre — navigation privée,
 * données effacées — se paie d'un affichage de trop, jamais d'un de moins.
 */

const CLE = 'profoot:rappel-analyse';
const UN_MOIS_MS = 30 * 24 * 60 * 60 * 1000;

export default function RappelAnalyse() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const vu = Number(localStorage.getItem(CLE) ?? 0);
      if (!Number.isFinite(vu) || Date.now() - vu > UN_MOIS_MS) setVisible(true);
    } catch {
      // Stockage refusé — navigation privée, réglages stricts. On affiche :
      // mieux vaut le montrer une fois de trop qu'une fois de moins.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const fermer = () => {
    try {
      localStorage.setItem(CLE, String(Date.now()));
    } catch {
      // Sans repère, il reviendra à la prochaine visite. Ce n'est pas grave.
    }
    setVisible(false);
  };

  return (
    <div className="w-full mt-4 rounded-[16px] border border-white/10 bg-[#1d2f3a]/50 px-4 py-3.5">
      <p className="text-[12px] font-bold leading-snug text-white/85">
        Ce que fait ProFoot AI, et ce qu&apos;il ne fait pas
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">
        Nos analyses lisent des milliers de rencontres passées pour décrire une
        tendance. Elles ne prédisent pas l&apos;avenir et ne garantissent aucun
        résultat : un match de football se joue sur le terrain, et le nôtre voit
        juste un peu plus d&apos;une fois sur deux.
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">
        N&apos;engagez jamais sur une analyse un argent dont vous avez besoin.
      </p>
      <button
        type="button"
        onClick={fermer}
        className="mt-2.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/60 transition-colors hover:border-white/30 hover:text-white/90"
      >
        J&apos;ai compris
      </button>
    </div>
  );
}
