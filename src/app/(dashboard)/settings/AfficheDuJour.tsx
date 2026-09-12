'use client';

import { useEffect, useState } from 'react';
import { Share2, Download, Link2, Image as ImageIcon } from 'lucide-react';

/**
 * « MON AFFICHE DU JOUR » — LE BLOC DE LA SECTION PROFIL.
 *
 * ── CE QU'IL FAIT ────────────────────────────────────────────────────────
 *
 * Il demande au serveur si la fonctionnalité est ouverte pour ce compte. Si
 * non, il ne rend RIEN — pas un bouton grisé, pas un message : rien. Pendant
 * l'essai privé, les autres abonnés ne doivent pas même savoir qu'elle existe.
 *
 * Si oui, il récupère le PNG produit par `/api/affiche`, le propose au partage
 * natif du téléphone (statut WhatsApp, story Instagram) et, à défaut, au
 * téléchargement.
 *
 * ── POURQUOI ICI, ET PLUS SUR LA PAGE D'ANALYSE ─────────────────────────
 *
 * Il y était placé au bas de la page, sous plusieurs écrans de défilement :
 * personne ne le voyait. Sa place est dans le profil, avec ce qui appartient à
 * la personne — son avatar, son nom, son club de cœur.
 *
 * ── L'HABILLAGE SUIT CELUI DES RÉGLAGES ─────────────────────────────────
 *
 * Mêmes classes que les autres cartes de cette page (`bg-card`,
 * `border-border-card`, `rounded-[28px]`, couleur `primary`) : une carte qui
 * aurait ses propres couleurs et ses propres coins jurerait avec le reste.
 */

interface Etat {
  disponible: boolean;
  jour?: string;
  analysesDuJour?: number;
  analysesDuMois?: number;
  serie?: number;
  matchs?: number;
}

type Format = 'story' | 'carre';

export default function AfficheDuJour() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState<Format | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch('/api/affiche/etat')
      .then((r) => (r.ok ? r.json() : { disponible: false }))
      .then((x) => {
        if (vivant) setEtat(x);
      })
      .catch(() => {
        if (vivant) setEtat({ disponible: false });
      });
    return () => {
      vivant = false;
    };
  }, []);

  // Libérer l'aperçu quand il est remplacé ou que le composant disparaît.
  useEffect(
    () => () => {
      if (apercu) URL.revokeObjectURL(apercu);
    },
    [apercu]
  );

  if (!etat?.disponible) return null;

  const nomFichier = `profoot-affiche-${etat.jour ?? 'du-jour'}.png`;

  async function produire(format: Format): Promise<File | null> {
    const r = await fetch(`/api/affiche?format=${format === 'carre' ? 'carre' : 'story'}`);
    if (!r.ok) {
      setMessage("L'affiche n'a pas pu être créée. Réessayez dans un instant.");
      return null;
    }
    const blob = await r.blob();
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(URL.createObjectURL(blob));
    return new File([blob], nomFichier, { type: 'image/png' });
  }

  async function partager(format: Format) {
    setMessage(null);
    setEnCours(format);
    try {
      const fichier = await produire(format);
      if (!fichier) return;

      const partageur = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      // `canShare` demandé AVANT : tous les navigateurs n'acceptent pas le
      // partage de fichiers, et un écran ne doit jamais rester bloqué parce
      // qu'une interface manque.
      if (partageur.share && partageur.canShare?.({ files: [fichier] })) {
        await partageur.share({
          files: [fichier],
          title: 'Mon affiche du jour — ProFoot AI',
          text: 'Mon activité d’analyse du jour avec ProFoot AI — profootai.com',
        });
        return;
      }

      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(fichier);
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lien.href);
      setMessage('Affiche enregistrée dans vos images — partagez-la depuis votre galerie.');
    } catch (e: any) {
      // Un partage annulé par la personne n'est pas une erreur.
      if (e?.name !== 'AbortError') setMessage("Le partage n'a pas abouti. L'affiche reste téléchargeable.");
    } finally {
      setEnCours(null);
    }
  }

  async function copierLeLien() {
    try {
      await navigator.clipboard.writeText('https://profootai.com');
      setMessage('Lien profootai.com copié.');
    } catch {
      setMessage('Copie impossible sur ce navigateur : profootai.com');
    }
  }

  const n = etat.analysesDuJour ?? 0;
  const resume =
    n === 0
      ? "Aucune analyse aujourd'hui pour l'instant"
      : n === 1
        ? '1 match analysé aujourd’hui'
        : `${n} matchs analysés aujourd’hui`;

  return (
    <div className="bg-card/80 backdrop-blur-md border border-border-card rounded-[28px] p-8 shadow-2xl animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[16px] bg-primary/10 border border-primary/25 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2
              className="text-xl font-black text-foreground"
              style={{ fontFamily: 'var(--police-titre), sans-serif' }}
            >
              Mon affiche du jour
            </h2>
            <p className="text-xs text-foreground/50 font-medium mt-0.5">
              {resume}
              {etat.serie && etat.serie > 1 ? ` · ${etat.serie} jours d’affilée` : ''}
              {etat.analysesDuMois ? ` · ${etat.analysesDuMois} ce mois-ci` : ''}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 rounded-full px-3 py-1">
          essai privé
        </span>
      </div>

      <p className="text-sm text-foreground/60 leading-relaxed mb-6">
        Une image de votre activité d’analyse, prête pour votre statut WhatsApp.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => partager('story')}
          disabled={enCours !== null}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-[16px] bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-sm font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Share2 className="w-4 h-4" />
          {enCours === 'story' ? 'Création…' : 'Partager mon affiche'}
        </button>
        <button
          type="button"
          onClick={() => partager('carre')}
          disabled={enCours !== null}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-[16px] border border-border-card text-foreground/80 hover:text-foreground hover:bg-foreground/5 disabled:opacity-60 text-sm font-bold transition-all"
        >
          <Download className="w-4 h-4" />
          {enCours === 'carre' ? 'Création…' : 'Format carré'}
        </button>
        <button
          type="button"
          onClick={copierLeLien}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-[16px] border border-border-card text-foreground/60 hover:text-foreground hover:bg-foreground/5 text-sm font-bold transition-all"
        >
          <Link2 className="w-4 h-4" />
          Copier le lien
        </button>
      </div>

      {message ? <p className="mt-4 text-xs text-foreground/60">{message}</p> : null}

      {apercu ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={apercu}
          alt="Aperçu de mon affiche du jour"
          className="mt-6 w-full max-w-[260px] rounded-[20px] border border-border-card block"
        />
      ) : null}
    </div>
  );
}
