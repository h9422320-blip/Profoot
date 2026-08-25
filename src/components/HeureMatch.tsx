'use client';

import { useEffect, useState } from 'react';
import { dateCourteLocale, dateLongueLocale, heureLocale } from '@/lib/heure-locale';

/**
 * « 25 août · 21:00 », dans le fuseau de celui qui regarde.
 *
 * ── POURQUOI UN COMPOSANT, ET PAS UN SIMPLE APPEL ─────────────────────────
 *
 * La liste des rencontres est une page SERVEUR, mise en cache dix minutes et
 * servie identique à tout le monde. Elle ne peut donc PAS connaître le fuseau
 * de son lecteur : une page mise en cache pour Conakry serait resservie à
 * Tokyo. C'est exactement ce qui se passait — l'heure sortait du fuseau du
 * serveur, UTC, pour la planète entière.
 *
 * Seul le navigateur connaît son fuseau. Ce composant rend donc d'abord la
 * version du serveur — celle qui est en cache, lisible tout de suite, bonne
 * pour le référencement — puis la remplace par l'heure locale dès qu'il
 * s'exécute chez le lecteur.
 *
 * ── POURQUOI `suppressHydrationWarning` ───────────────────────────────────
 *
 * Les deux rendus DIVERGENT volontairement : c'est tout l'objet du composant.
 * Sans cette mention, React signalerait la différence comme une anomalie.
 *
 * ── CE QUI NE CHANGE PAS ──────────────────────────────────────────────────
 *
 * Le repli n'est jamais vide. Si l'instant est illisible, la chaîne du serveur
 * reste affichée : une heure approximative vaut mieux qu'un trou dans la page.
 */
export function HeureMatch({
  iso,
  repliJour,
  repliHeure,
}: {
  /** L'instant du coup d'envoi, tel que le fournisseur le donne. */
  iso: string | number | null | undefined;
  /** Ce que le serveur avait calculé, affiché jusqu'à l'arrivée du navigateur. */
  repliJour: string;
  repliHeure: string;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    const jour = dateCourteLocale(iso, '');
    const heure = heureLocale(iso, '');
    if (jour && heure) setLocal(`${jour} · ${heure}`);
  }, [iso]);

  return (
    <span suppressHydrationWarning>{local ?? `${repliJour} · ${repliHeure}`}</span>
  );
}

/**
 * La même correction, pour une date OU une heure prise séparément.
 *
 * La fiche d'une rencontre les affiche à deux endroits éloignés — la date en
 * en-tête, l'heure au centre à la place du score. Les deux sortaient du fuseau
 * du serveur.
 */
export function InstantLocal({
  iso,
  rendu,
  repli,
}: {
  iso: string | number | null | undefined;
  rendu: 'heure' | 'date-longue';
  repli: string;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    const v = rendu === 'heure' ? heureLocale(iso, '') : dateLongueLocale(iso, '');
    if (v) setLocal(v);
  }, [iso, rendu]);

  return <span suppressHydrationWarning>{local ?? repli}</span>;
}
