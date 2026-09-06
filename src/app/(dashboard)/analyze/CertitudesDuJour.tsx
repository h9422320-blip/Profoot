'use client';

import type { Certitude } from '@/lib/certitudes-du-jour';

/**
 * LES CERTITUDES DU JOUR, À L'ÉCRAN.
 *
 * ── CE À QUOI CETTE SECTION RÉPOND ───────────────────────────────────────
 *
 * Le 6 septembre 2026, des abonnés payants se plaignaient que l'application
 * « ne fonctionne pas ». Le malentendu vient de ce qu'elle mettait en avant
 * « qui va gagner », qui plafonne à 82,7 % de réussite — trois issues
 * possibles, c'est le mur du domaine.
 *
 * Ici, ce sont des affirmations à DEUX réponses, tirées de la même grille de
 * scores, qui tiennent 92,8 % quand elles sont annoncées au-dessus de 85 %.
 * Mesuré sur 1 544 rencontres hors échantillon, stable dans les deux moitiés
 * du contrôle.
 *
 * ── POURQUOI L'HEURE N'EST PAS AFFICHÉE ICI ──────────────────────────────
 *
 * Elle le serait au mauvais fuseau. Cette liste est mise en réserve et servie
 * identique à tout le monde : elle ne peut pas connaître le fuseau de celui
 * qui la lit. Le nom des équipes et le championnat suffisent à retrouver la
 * rencontre, et le carrousel juste en dessous porte les heures, lui, mises à
 * l'heure du lecteur par son navigateur.
 */
export default function CertitudesDuJour({
  liste,
  aujourdhui,
}: {
  liste: Certitude[];
  aujourdhui: boolean;
}) {
  // Rien à montrer plutôt qu'une section vide qui donnerait l'impression que
  // l'application n'a rien à dire aujourd'hui.
  if (!liste?.length) return null;

  return (
    <section className="w-full mt-4 rounded-[26px] border border-[#10B981]/25 bg-[#10B981]/[0.07] p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3
          className="text-[15px] font-black text-white"
          style={{ fontFamily: 'var(--police-titre), sans-serif' }}
        >
          🔒 Ce qui est presque certain {aujourdhui ? "aujourd'hui" : 'demain'}
        </h3>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-[#34D399]">
          {liste.length} affirmation{liste.length > 1 ? 's' : ''}
        </span>
      </div>

      <ul className="space-y-2">
        {liste.map((c) => (
          <li
            key={`${c.fixtureId}-${c.texte}`}
            className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-black/25 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-black leading-snug text-white">
                {c.texte}
              </span>
              <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-white/45">
                {c.affiche}
                {c.championnat ? ` · ${c.championnat}` : ''}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-[#10B981]/20 px-2.5 py-1 text-[13px] font-black tabular-nums text-[#34D399]">
              {c.probabilite} %
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[10.5px] leading-relaxed text-white/45 font-semibold">
        Ces affirmations portent sur une question à deux réponses, et non sur le vainqueur.
        C&apos;est ce qui les rend beaucoup plus sûres. Sur les rencontres déjà jouées, celles
        annoncées au-dessus de 85 % se sont réalisées <strong className="text-white/70">92,8 %</strong>{' '}
        du temps.
      </p>
    </section>
  );
}
