"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  CHAMPIONNATS_VEDETTES,
  ecussonDe,
  normaliserNom,
  type ClubVedette,
  type EquipeReferentiel,
} from "@/lib/equipes-vedettes";
import { enregistrerEquipePreferee, type EquipePreferee } from "./actions";

/**
 * LE PREMIER MOMENT DE JOIE, ET LE SEUL.
 *
 * ── CE QUE FAIT CET ÉCRAN, ET CE QU'IL NE FAIT PAS ────────────────────────
 *
 * Il demande son club de cœur à quelqu'un qui arrive, le fête, et disparaît.
 * Il ne présélectionne rien pour l'analyse, ne filtre aucun match, ne modifie
 * aucun écran. L'équipe qu'on aime et l'équipe qu'on veut analyser sont deux
 * choses différentes — un supporter du Real ouvre l'application pour regarder
 * le match de son cousin.
 *
 * ── POURQUOI IL VIT DANS LE NAVIGATEUR ────────────────────────────────────
 *
 * La page d'analyse est régénérée toutes les cinq minutes et servie IDENTIQUE
 * à tout le monde. Y calculer quoi que ce soit de personnel côté serveur ferait
 * entrer l'état d'un compte dans une page partagée par tous — le fichier de la
 * page le dit en toutes lettres. Ce qui est propre à quelqu'un se lit donc
 * depuis son navigateur, comme le fait déjà le message personnel.
 *
 * ── UNE SEULE FOIS, ET JAMAIS AU MILIEU D'UN PAIEMENT ─────────────────────
 *
 * L'indicateur `equipe_preferee_faite` ferme la porte définitivement, qu'on ait
 * choisi ou passé. Et l'écran ne s'ouvre que sur le parcours d'arrivée : rien
 * ne doit se poser par-dessus quelqu'un en train de payer.
 */

/** Les seuls chemins où cet écran a le droit de s'ouvrir. */
const ROUTES_ACCUEIL = ["/analyze", "/dashboard"];

/** Au-dessous, la recherche à distance ne rend rien d'utile. */
const MIN_RECHERCHE = 3;

/** Le temps que dure la fête avant de rendre la main. */
const DUREE_FETE_MS = 3000;

type Etape = "sommeil" | "choix" | "fete";

interface Resultat {
  id: string;
  nom: string;
  logo: string | null;
  championnat: string | null;
}

export default function AccueilEquipePreferee() {
  const chemin = usePathname();
  const [etape, setEtape] = useState<Etape>("sommeil");
  const [prenom, setPrenom] = useState("");
  const [referentiel, setReferentiel] = useState<EquipeReferentiel[]>([]);
  const [saisie, setSaisie] = useState("");
  const [distants, setDistants] = useState<Resultat[]>([]);
  const [chercheEncore, setChercheEncore] = useState(false);
  const [choisie, setChoisie] = useState<EquipePreferee | null>(null);
  const [clavier, setClavier] = useState(0);
  const enregistrement = useRef(false);

  // ── FAUT-IL OUVRIR ? ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ROUTES_ACCUEIL.includes(chemin ?? "")) return;

    let vivant = true;
    (async () => {
      try {
        const { data } = await createClient().auth.getUser();
        const u = data?.user;
        if (!vivant || !u) return;
        if (u.user_metadata?.equipe_preferee_faite) return;

        // « Mamadou Diallo » → « Mamadou ». Le nom complet dans une phrase
        // d'exclamation sonne comme un courrier administratif.
        const complet = String(u.user_metadata?.full_name ?? "").trim();
        setPrenom(complet ? complet.split(/\s+/)[0] : "");
        setEtape("choix");
      } catch {
        /* Jamais bloquant : un écran de bienvenue ne doit pas fermer l'app. */
      }
    })();
    return () => {
      vivant = false;
    };
  }, [chemin]);

  // ── LES ÉCUSSONS, EN ARRIÈRE-PLAN ───────────────────────────────────────
  //
  // Le référentiel peut mettre plusieurs secondes à se constituer au premier
  // chargement de la journée. La grille ne l'attend pas : elle s'affiche en
  // monogrammes, et les écussons s'y posent quand ils arrivent.
  useEffect(() => {
    if (etape !== "choix" || referentiel.length) return;
    let vivant = true;
    (async () => {
      try {
        const r = await fetch("/api/teams");
        const j = await r.json();
        if (vivant && Array.isArray(j?.teams)) setReferentiel(j.teams);
      } catch {
        /* Sans écussons, la grille reste lisible. */
      }
    })();
    return () => {
      vivant = false;
    };
  }, [etape, referentiel.length]);

  // ── LA RECHERCHE ────────────────────────────────────────────────────────
  useEffect(() => {
    const q = saisie.trim();
    if (q.length < MIN_RECHERCHE) {
      setDistants([]);
      setChercheEncore(false);
      return;
    }

    setChercheEncore(true);
    let vivant = true;
    const minuteur = setTimeout(async () => {
      try {
        const r = await fetch(`/api/teams/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (!vivant) return;
        setDistants(
          (Array.isArray(j?.teams) ? j.teams : []).map((t: any) => ({
            id: String(t.id ?? ""),
            nom: String(t.name ?? ""),
            logo: t.logo ? String(t.logo) : null,
            championnat: t.league ? String(t.league) : null,
          }))
        );
      } catch {
        if (vivant) setDistants([]);
      } finally {
        if (vivant) setChercheEncore(false);
      }
    }, 350);

    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [saisie]);

  /**
   * Ce que la recherche affiche.
   *
   * Le référentiel déjà en mémoire d'abord — c'est instantané, et sur une
   * connexion mobile lente c'est la différence entre « ça répond » et « ça ne
   * marche pas ». Les résultats venus du réseau complètent ensuite, sans
   * doublon.
   */
  const resultats = useMemo<Resultat[]>(() => {
    const q = normaliserNom(saisie.trim());
    if (q.length < 2) return [];

    const locaux: Resultat[] = referentiel
      .filter((t) => t.name && normaliserNom(t.name).includes(q))
      .slice(0, 30)
      .map((t) => ({
        id: String(t.id ?? ""),
        nom: String(t.name ?? ""),
        logo: t.logo ?? null,
        championnat: null,
      }));

    const vus = new Set(locaux.map((t) => t.id));
    return [...locaux, ...distants.filter((t) => t.id && !vus.has(t.id))].slice(0, 40);
  }, [saisie, referentiel, distants]);

  // ── LA FÊTE ─────────────────────────────────────────────────────────────
  const celebrer = useCallback(async () => {
    try {
      // Quelqu'un qui a demandé moins d'animations à son téléphone ne reçoit
      // pas de confettis. Le message de fête, lui, reste : c'est le fond, pas
      // la forme, qui compte.
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      const confetti = (await import("canvas-confetti")).default;
      const couleurs = ["#10B981", "#34D399", "#FBBF24", "#F59E0B", "#FFFFFF"];
      const commun = { colors: couleurs, zIndex: 2147483000, disableForReducedMotion: true };

      // ── MOINS DE PARTICULES SUR PETIT ÉCRAN ──────────────────────────────
      //
      // Chaque confetti est un objet redessiné soixante fois par seconde. Sur
      // un téléphone d'entrée de gamme, trois cents particules transforment la
      // fête en diaporama — et une célébration qui saccade se lit comme une
      // application qui rame, pas comme un cadeau.
      //
      // Deux cents suffisent largement à remplir un écran de six pouces : la
      // densité perçue dépend de la surface, pas du nombre.
      const petitEcran = window.innerWidth < 480;
      const n = (plein: number) => (petitEcran ? Math.round(plein * 0.6) : plein);

      // Une gerbe centrale, puis deux canons latéraux légèrement décalés : les
      // confettis jaillissent et retombent, au lieu de tomber tout droit.
      confetti({ ...commun, particleCount: n(110), spread: 78, startVelocity: 48, origin: { y: 0.62 } });
      setTimeout(
        () => confetti({ ...commun, particleCount: n(60), angle: 62, spread: 62, origin: { x: 0, y: 0.75 } }),
        180
      );
      setTimeout(
        () => confetti({ ...commun, particleCount: n(60), angle: 118, spread: 62, origin: { x: 1, y: 0.75 } }),
        320
      );
      setTimeout(
        () => confetti({ ...commun, particleCount: n(70), spread: 110, startVelocity: 32, scalar: 0.9, origin: { y: 0.5 } }),
        640
      );
    } catch {
      /* Pas de confettis : le message de fête suffit, l'écran continue. */
    }
  }, []);

  /** Referme l'étape : choix retenu, ou « Passer » quand `equipe` vaut null. */
  const clore = useCallback(async (equipe: EquipePreferee | null) => {
    if (enregistrement.current) return;
    enregistrement.current = true;
    try {
      await enregistrerEquipePreferee(equipe);
    } catch {
      /* L'écran se referme quand même : on ne retient personne à l'entrée. */
    }
  }, []);

  const choisir = useCallback(
    (equipe: EquipePreferee) => {
      setChoisie(equipe);
      setEtape("fete");
      void celebrer();
      // L'enregistrement part en même temps que les confettis : la personne
      // n'attend jamais le réseau pour voir sa fête.
      void clore(equipe);
    },
    [celebrer, clore]
  );

  const passer = useCallback(() => {
    setEtape("sommeil");
    void clore(null);
  }, [clore]);

  // La fête rend la main toute seule. Un écran de joie qui exige un clic pour
  // partir cesse d'être une joie.
  useEffect(() => {
    if (etape !== "fete") return;
    const minuteur = setTimeout(() => setEtape("sommeil"), DUREE_FETE_MS);
    return () => clearTimeout(minuteur);
  }, [etape]);

  // Échap referme comme « Passer » : l'étape est facultative, elle doit se
  // quitter par le geste le plus naturel du clavier.
  useEffect(() => {
    if (etape !== "choix") return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") passer();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [etape, passer]);

  // ── LA FEUILLE MONTE AVEC LE CLAVIER ────────────────────────────────────
  //
  // Sur Android, ouvrir le clavier ne réduit PAS la page : il se pose
  // par-dessus. Une feuille collée au bas de l'écran passe donc dessous, avec
  // ses résultats de recherche — on tape « Espérance de Tunis », les réponses
  // arrivent, et elles sont cachées par le clavier qui a servi à les demander.
  //
  // `visualViewport` donne la hauteur réellement VISIBLE. On rétrécit la
  // couche d'autant, et la feuille se repose juste au-dessus du clavier.
  // Absent sur un très vieux navigateur : il ne se passe rien de plus
  // qu'avant, personne n'est bloqué.
  useEffect(() => {
    if (etape === "sommeil") return;
    const vue = window.visualViewport;
    if (!vue) return;

    const suivre = () => {
      setClavier(Math.max(0, Math.round(window.innerHeight - vue.height - vue.offsetTop)));
    };
    suivre();
    vue.addEventListener("resize", suivre);
    vue.addEventListener("scroll", suivre);
    return () => {
      vue.removeEventListener("resize", suivre);
      vue.removeEventListener("scroll", suivre);
      setClavier(0);
    };
  }, [etape]);

  // Le fond ne défile pas derrière la feuille : sur téléphone, un arrière-plan
  // qui bouge sous le doigt donne l'impression que l'écran est cassé.
  useEffect(() => {
    if (etape === "sommeil") return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, [etape]);

  if (etape === "sommeil") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choisir son équipe préférée"
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm sm:p-6"
      style={clavier ? { height: `calc(100% - ${clavier}px)` } : undefined}
    >
      {/* ── LA FEUILLE, PENSÉE POUR LE POUCE ──────────────────────────────
          Sur téléphone elle est collée au bas de l'écran : c'est la zone
          qu'un pouce atteint sans changer la prise sur l'appareil. Elle ne
          dépasse jamais 94 % de la hauteur, et son corps défile — un écran
          d'accueil qui déborde et dont on ne voit pas le bas est un écran
          dont on ne sort pas.

          `overflow-x-hidden` est la ceinture de sécurité : aucun nom de club
          un peu long ne peut faire glisser la page de côté. */}
      <div className="w-full sm:max-w-[580px] max-h-[94%] sm:max-h-[88%] flex flex-col overflow-hidden overflow-x-hidden rounded-t-[28px] sm:rounded-[28px] border border-white/10 bg-[#0f1a22] shadow-[0_-8px_60px_rgba(0,0,0,0.6)] sm:shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
        {etape === "fete" ? (
          <Fete prenom={prenom} equipe={choisie} onContinuer={() => setEtape("sommeil")} />
        ) : (
          <Choix
            prenom={prenom}
            referentiel={referentiel}
            saisie={saisie}
            setSaisie={setSaisie}
            resultats={resultats}
            chercheEncore={chercheEncore}
            onChoisir={choisir}
            onPasser={passer}
          />
        )}
      </div>
    </div>
  );
}

/* ── L'ÉCRAN DE CHOIX ────────────────────────────────────────────────────── */

function Choix({
  prenom,
  referentiel,
  saisie,
  setSaisie,
  resultats,
  chercheEncore,
  onChoisir,
  onPasser,
}: {
  prenom: string;
  referentiel: EquipeReferentiel[];
  saisie: string;
  setSaisie: (v: string) => void;
  resultats: Resultat[];
  chercheEncore: boolean;
  onChoisir: (e: EquipePreferee) => void;
  onPasser: () => void;
}) {
  const cherche = saisie.trim().length >= 2;

  return (
    <>
      {/* En-tête : la question, et la porte de sortie. */}
      <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-7 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#10B981]">
              {prenom ? `Bienvenue ${prenom}` : "Bienvenue"}
            </p>
            <h2 className="mt-1.5 text-[21px] sm:text-[25px] font-black leading-tight text-white tracking-tight">
              Quelle est ton équipe préférée&nbsp;? ⚽
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">
              Juste pour le plaisir. Tu resteras libre d&apos;analyser
              n&apos;importe quel match.
            </p>
          </div>

          {/* Discret, mais toujours atteignable au pouce. */}
          {/* Discret à l'œil, mais JAMAIS discret au doigt : 44 px de haut,
              la plus petite cible qu'un pouce atteint sans rater. Un bouton
              d'abandon trop petit, c'est quelqu'un qui tape trois fois à côté
              et qui referme l'application. */}
          <button
            type="button"
            onClick={onPasser}
            className="shrink-0 min-h-[44px] min-w-[44px] rounded-full px-4 py-2.5 text-[13px] font-bold text-white/40 hover:text-white/80 hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            Passer
          </button>
        </div>

        {/* Recherche : personne n'est exclu parce que son club n'est pas
            européen. Les clubs africains et les sélections nationales se
            trouvent ici. */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          {/* ── LE CLAVIER DU TÉLÉPHONE NE DOIT PAS AVALER CE CHAMP ────────
              Sur Android, ouvrir le clavier ne réduit pas toujours la page :
              il se pose PAR-DESSUS. Le champ vit donc en haut de la feuille,
              hors de la zone couverte — et au cas où, on le ramène dans la
              vue au moment de la mise au point.

              16 px de corps, et pas moins : au-dessous, iOS zoome
              automatiquement sur le champ à la mise au point et l'écran part
              de travers, ce qu'aucun réglage ne rattrape après coup. */}
          <input
            type="text"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onFocus={(e) => {
              const champ = e.currentTarget;
              setTimeout(() => champ.scrollIntoView({ block: "center" }), 300);
            }}
            // Court exprès : sur 360 px, « Autre équipe — club, pays,
            // sélection… » se faisait couper en plein mot, et une invite
            // tronquée donne l'impression d'un champ à moitié cassé.
            placeholder="Chercher une autre équipe…"
            aria-label="Chercher une autre équipe"
            enterKeyHint="search"
            autoComplete="off"
            className="w-full min-h-[52px] rounded-[16px] border border-white/[0.07] bg-white/[0.04] py-3.5 pl-11 pr-4 text-[16px] sm:text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#10B981]/40"
          />
        </div>
      </div>

      {/* Corps défilant */}
      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 custom-scrollbar">
        {cherche ? (
          <ListeRecherche
            resultats={resultats}
            chercheEncore={chercheEncore}
            onChoisir={onChoisir}
          />
        ) : (
          <div className="space-y-6">
            {CHAMPIONNATS_VEDETTES.map((champ) => (
              <div key={champ.id}>
                <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/30">
                  <span className="mr-1.5 text-[13px] align-middle">{champ.drapeau}</span>
                  {champ.libelle}
                </p>
                {/* Deux colonnes sur téléphone : trois rendraient « Borussia
                    Dortmund » illisible sur 360 px de large. L'espacement est
                    volontairement généreux — deux cartes collées, c'est une
                    carte sur deux touchée par erreur. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {champ.clubs.map((club) => (
                    <CarteClub
                      key={club.id}
                      club={club}
                      ecusson={ecussonDe(club, referentiel)}
                      championnat={champ.id}
                      onChoisir={onChoisir}
                    />
                  ))}
                </div>
              </div>
            ))}

            <p className="pt-1 pb-2 text-center text-[11px] leading-relaxed text-white/25">
              Ton club n&apos;est pas là&nbsp;? Cherche-le en haut — tous les
              championnats et toutes les sélections y sont.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/** Un club de la grille. L'écusson quand on l'a, le monogramme sinon. */
function CarteClub({
  club,
  ecusson,
  championnat,
  onChoisir,
}: {
  club: ClubVedette;
  ecusson: string | null;
  championnat: string;
  onChoisir: (e: EquipePreferee) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChoisir({ id: club.id, nom: club.nom, logo: ecusson, championnat })
      }
      className="group flex min-h-[64px] items-center gap-2.5 rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-3 text-left transition-all hover:border-[#10B981]/40 hover:bg-[#10B981]/[0.07] active:scale-[0.97] active:bg-[#10B981]/10"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/[0.06] overflow-hidden">
        {ecusson ? (
          <img src={ecusson} alt="" className="h-8 w-8 object-contain" />
        ) : (
          <span className="text-[10px] font-black tracking-tight text-white/55">
            {club.monogramme}
          </span>
        )}
      </span>
      {/* `break-words` : « Borussia Dortmund » sur 360 px doit passer à la
          ligne, jamais élargir la carte et pousser la page de côté. */}
      <span className="min-w-0 flex-1 break-words text-[12.5px] font-bold leading-tight text-white/85 group-hover:text-white">
        {club.nom}
      </span>
    </button>
  );
}

/** Les résultats de recherche, en liste : les noms y sont longs. */
function ListeRecherche({
  resultats,
  chercheEncore,
  onChoisir,
}: {
  resultats: Resultat[];
  chercheEncore: boolean;
  onChoisir: (e: EquipePreferee) => void;
}) {
  if (!resultats.length) {
    return (
      <p className="py-10 text-center text-[12.5px] font-semibold text-white/35">
        {chercheEncore
          ? "Recherche dans tous les championnats…"
          : "Aucune équipe trouvée. Essaie une autre orthographe."}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {resultats.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChoisir({ id: t.id, nom: t.nom, logo: t.logo, championnat: t.championnat })}
          className="flex w-full min-h-[56px] items-center gap-3 rounded-[16px] border border-transparent px-3 py-3 text-left transition-colors hover:border-[#10B981]/30 hover:bg-[#10B981]/[0.07] active:bg-[#10B981]/10"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white/[0.06] overflow-hidden">
            {t.logo ? (
              <img src={t.logo} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <span className="text-[11px] font-black text-white/45">
                {t.nom.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white/85">
            {t.nom}
          </span>
        </button>
      ))}

      {chercheEncore && (
        <p className="py-3 text-center text-[11.5px] font-semibold text-white/25">
          Recherche dans tous les championnats…
        </p>
      )}
    </div>
  );
}

/* ── LE MOMENT « WAOUH » ─────────────────────────────────────────────────── */

function Fete({
  prenom,
  equipe,
  onContinuer,
}: {
  prenom: string;
  equipe: EquipePreferee | null;
  onContinuer: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-11 sm:py-14 text-center">
      <div className="relative">
        {/* Halo : il donne au moment son épaisseur sans coûter une image. */}
        <span className="absolute inset-0 -m-4 rounded-full bg-[#10B981]/20 blur-2xl" />
        <span className="relative grid h-24 w-24 place-items-center rounded-[28px] border border-[#10B981]/30 bg-white/[0.06] overflow-hidden animate-fade-in">
          {equipe?.logo ? (
            <img src={equipe.logo} alt="" className="h-16 w-16 object-contain" />
          ) : (
            <Sparkles className="h-10 w-10 text-[#10B981]" />
          )}
        </span>
      </div>

      <p className="mt-7 text-[24px] sm:text-[30px] font-black leading-tight tracking-tight text-white">
        Waouh{prenom ? ` ${prenom}` : ""} 🔥
      </p>
      <p className="mt-2 text-[17px] sm:text-[19px] font-bold leading-snug text-white/80">
        Tu es un GRAND fan de{" "}
        <span className="text-[#10B981]">{equipe?.nom ?? "ton club"}</span>&nbsp;!
      </p>

      <p className="mt-5 max-w-[340px] text-[12.5px] leading-relaxed text-white/35">
        C&apos;est noté. Tu peux maintenant analyser le match que tu veux —
        n&apos;importe quelle équipe, quand tu veux.
      </p>

      {/* Pleine largeur sur téléphone : c'est la seule action de l'écran, elle
          n'a aucune raison d'être une petite pastille qu'on vise. */}
      <button
        type="button"
        onClick={onContinuer}
        className="mt-7 w-full sm:w-auto min-h-[52px] rounded-[16px] bg-[#10B981] px-8 py-3.5 text-[14px] font-black text-[#04140d] transition-colors hover:bg-[#0ea472] active:scale-[0.98]"
      >
        Continuer
      </button>
    </div>
  );
}
