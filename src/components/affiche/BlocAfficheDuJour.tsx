'use client';

import { useEffect, useState } from 'react';
import { Share2, Link2, ChevronRight, ChevronDown } from 'lucide-react';
import { GlypheReseau, RESEAUX, lienDeSecours, type Reseau } from './ReseauxAffiche';

/**
 * « MON AFFICHE DU JOUR » — LE BLOC DE LA PAGE MON PROFIL.
 *
 * ── CE QU'IL FAIT ────────────────────────────────────────────────────────
 *
 * Il demande au serveur si la fonctionnalité est ouverte pour ce compte. Si
 * non, il ne rend RIEN — pas un bouton grisé, pas un message : rien. Pendant
 * l'essai privé, les autres abonnés ne doivent pas même savoir qu'elle existe.
 *
 * Si oui, « Partager mon affiche » ouvre les QUATRE RÉSEAUX — WhatsApp,
 * TikTok, Instagram, Facebook. Taper l'un d'eux produit le PNG et ouvre la
 * feuille de partage du téléphone, l'image déjà attachée. Le pourquoi de ce
 * détour est écrit dans `ReseauxAffiche.tsx` : aucun de ces réseaux n'accepte
 * qu'une page web lui envoie une image, seule la feuille du système le fait.
 *
 * ── LA VERSION CARRÉE A ÉTÉ RETIRÉE ──────────────────────────────────────
 *
 * Elle proposait un second format que personne n'avait demandé, et qui posait
 * la question « lequel je prends ? » avant même de partager. Décision du
 * propriétaire le 13 septembre 2026. La route sait toujours la produire avec
 * `?format=carre` — rien n'a été supprimé côté serveur, seulement le choix
 * imposé à l'écran.
 *
 * ── L'HABILLAGE EST CELUI DE CETTE PAGE, PAS UN AUTRE ───────────────────
 *
 * Tout est repris de la carte de profil juste en dessous : même fond, mêmes
 * coins, même tuile d'icône en dégradé vert, mêmes rangées avec chevron. Le
 * bloc doit avoir l'air d'avoir toujours été là.
 */

interface Etat {
  disponible: boolean;
  jour?: string;
  analysesDuJour?: number;
  analysesDuMois?: number;
  serie?: number;
  matchs?: number;
}

export default function BlocAfficheDuJour() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState<Reseau | null>(null);
  const [reseauxOuverts, setReseauxOuverts] = useState(false);
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

  async function produire(): Promise<File | null> {
    const r = await fetch('/api/affiche?format=story');
    if (!r.ok) {
      setMessage("L'affiche n'a pas pu être créée. Réessayez dans un instant.");
      return null;
    }
    const blob = await r.blob();
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(URL.createObjectURL(blob));
    return new File([blob], nomFichier, { type: 'image/png' });
  }

  async function partagerVers(reseau: Reseau) {
    setMessage(null);
    setEnCours(reseau);
    try {
      const fichier = await produire();
      if (!fichier) return;

      const partageur = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      // ── LE CHEMIN QUI ABOUTIT VRAIMENT ──────────────────────────────────
      //
      // La feuille de partage du système porte l'image et liste toutes les
      // applications installées, le réseau visé compris. `canShare` est demandé
      // AVANT : tous les navigateurs n'acceptent pas le partage de fichiers, et
      // un écran ne doit jamais rester bloqué parce qu'une interface manque.
      if (partageur.share && partageur.canShare?.({ files: [fichier] })) {
        await partageur.share({
          files: [fichier],
          title: 'Mon affiche du jour — ProFoot AI',
          text: 'Mon activité d’analyse du jour avec ProFoot AI — profootai.com',
        });
        return;
      }

      // ── LE REPLI : ENREGISTRER, PUIS OUVRIR LE RÉSEAU ───────────────────
      //
      // Sur un ordinateur, le partage de fichier n'existe presque jamais.
      // L'affiche est enregistrée et le réseau ouvert dans un onglet : il n'y a
      // plus qu'à la déposer. Un bouton qui ne ferait rien serait pire.
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(fichier);
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lien.href);
      window.open(lienDeSecours(reseau), '_blank', 'noopener,noreferrer');
      setMessage('Affiche enregistrée dans vos images — il ne reste qu’à la déposer.');
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

  return (
    <div className="bg-[#1d2f3a]/80 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-2xl">
      {/* En-tête : même tuile en dégradé vert que la carte de profil. */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6 mb-6">
        {/* La lueur est posée en style direct : une classe d'ombre arbitraire
            contenant des virgules — `shadow-[0_0_20px_rgba(...)]` — ne génère
            rien chez Tailwind, un piège déjà rencontré sur ce projet. */}
        <div
          className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#10B981] to-[#059669] text-white flex items-center justify-center shrink-0"
          style={{ boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}
        >
          <Share2 className="w-7 h-7" />
        </div>
        {/* Le titre a sa ligne entière : à côté du badge, il sortait tronqué
            en « Mon affi… » sur un écran de téléphone. */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white leading-tight">Mon affiche du jour</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-[#10B981]/20 text-[#10B981] text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 border border-[#10B981]/20">
              Essai privé
            </span>
            <span className="text-[11px] text-white/50 whitespace-nowrap">pour votre statut</span>
          </div>
        </div>
      </div>

      {/* Deux tuiles de chiffres, comme celles du profil. Libellés COURTS :
          sur 375 pixels de large, « matchs analysés aujourd'hui » partait sur
          deux lignes et cassait l'alignement des deux tuiles. */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 border border-white/5 rounded-[20px] p-4 text-center">
          <span className="text-2xl font-black text-white">{n}</span>
          <p className="text-[11px] text-white/50 font-medium mt-1 uppercase tracking-wider">aujourd’hui</p>
        </div>
        <div className="bg-white/5 border border-white/5 rounded-[20px] p-4 text-center">
          <span className="text-2xl font-black text-white">{etat.analysesDuMois ?? 0}</span>
          <p className="text-[11px] text-white/50 font-medium mt-1 uppercase tracking-wider">ce mois-ci</p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setReseauxOuverts((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-[#10B981]/10 hover:bg-[#10B981]/20 rounded-[20px] transition-colors border border-[#10B981]/20 group"
        >
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-[#10B981] group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-[#10B981] whitespace-nowrap">Partager mon affiche</span>
          </div>
          {reseauxOuverts ? (
            <ChevronDown className="w-4 h-4 text-[#10B981]/50" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#10B981]/50" />
          )}
        </button>

        {/* Les quatre réseaux, en deux colonnes : sur un téléphone, quatre
            rangées pleines auraient poussé le reste de la page hors de vue. */}
        {reseauxOuverts ? (
          <div className="grid grid-cols-2 gap-3">
            {RESEAUX.map((r) => (
              <button
                key={r.cle}
                type="button"
                onClick={() => partagerVers(r.cle)}
                disabled={enCours !== null}
                className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 disabled:opacity-60 rounded-[20px] transition-colors border border-white/5"
              >
                <span style={{ color: r.couleur }} className="shrink-0 flex items-center">
                  <GlypheReseau reseau={r.cle} />
                </span>
                <span className="text-sm font-bold text-white whitespace-nowrap">
                  {enCours === r.cle ? '…' : r.nom}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={copierLeLien}
          className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-[20px] transition-colors border border-white/5 group"
        >
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
            <span className="text-sm font-bold text-white whitespace-nowrap">Copier le lien</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>
      </div>

      {message ? <p className="mt-4 text-xs text-white/50 text-center">{message}</p> : null}

      {apercu ? (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={apercu}
            alt="Aperçu de mon affiche du jour"
            className="w-full max-w-[220px] rounded-[20px] border border-white/10 shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  );
}
