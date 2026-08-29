"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  clubsVedettes,
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

/**
 * Le temps que dure la fête avant de rendre la main.
 *
 * Quatre secondes et demie : assez pour que les confettis retombent et qu'on
 * lise son nom à côté de son club, jamais assez pour se demander comment on
 * sort. Le plafond est de cinq secondes — au-delà, une célébration cesse
 * d'être un cadeau et devient une porte qu'on attend.
 *
 * On peut aussi la fermer d'une simple tape, n'importe où sur la carte.
 */
const DUREE_FETE_MS = 4500;

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
  /** Le club touché, le temps que sa carte s'allume avant la fête. */
  const [enCours, setEnCours] = useState<string | null>(null);
  /** Faux au premier rendu : la carte entre en scène au lieu d'apparaître. */
  const [entree, setEntree] = useState(false);
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
      // ── LA CARTE S'ALLUME AVANT QUE L'ÉCRAN NE CHANGE ────────────────────
      //
      // Sans ce battement, la grille disparaissait à l'instant du contact et
      // rien ne confirmait CE QUI avait été touché. Sur un téléphone, où le
      // doigt cache la moitié de la carte, on n'était même pas sûr d'avoir
      // appuyé au bon endroit. Deux dixièmes de seconde suffisent à voir sa
      // carte s'allumer en vert avant la fête.
      setEnCours(equipe.id);
      setTimeout(() => {
        setChoisie(equipe);
        setEtape("fete");
        void celebrer();
      }, 200);

      // L'enregistrement part tout de suite : la personne n'attend jamais le
      // réseau pour voir sa fête.
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

  // ── L'ENTRÉE EN SCÈNE ───────────────────────────────────────────────────
  //
  // La carte monte et se révèle en trois dixièmes de seconde au lieu de
  // surgir. C'est ce qui distingue une notice qui s'impose d'un objet qu'on
  // vous présente — et ça ne coûte que deux propriétés animées, opacité et
  // déplacement, les deux seules que le téléphone traite sans repeindre.
  //
  // Fait en état React plutôt qu'en image-clé CSS : aucune règle à déclarer,
  // donc rien qui puisse ne pas être généré.
  useEffect(() => {
    if (etape === "sommeil") return;
    const t = setTimeout(() => setEntree(true), 20);
    return () => clearTimeout(t);
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
      className="fixed inset-0 z-[300] flex items-center justify-center backdrop-blur-sm p-4 sm:p-6"
      // ── L'AMBIANCE : DES PROJECTEURS, PAS UN VOILE GRIS ────────────────
      //
      // Un `bg-black/80` uniforme aplatit tout : la carte y flotte sur du
      // néant. Deux halos posés en haut et en bas donnent la profondeur d'un
      // stade éclairé — la carte semble prise dans la lumière au lieu d'être
      // collée dessus. C'est un dégradé, pas un flou : aucune image par
      // seconde perdue sur un téléphone d'entrée de gamme.
      style={{
        background:
          "radial-gradient(130% 85% at 50% -10%, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.05) 35%, rgba(0,0,0,0) 65%)," +
          "radial-gradient(120% 80% at 50% 110%, rgba(16,185,129,0.12) 0%, rgba(0,0,0,0) 60%)," +
          "rgba(2,6,10,0.90)",
        ...(clavier ? { height: `calc(100% - ${clavier}px)` } : {}),
      }}
    >
      {/* ── UNE NOTICE POSÉE SUR LA PAGE, PAS UN ÉCRAN QUI LA REMPLACE ─────
          Elle occupait toute la hauteur du téléphone : on ne voyait plus
          l'application derrière, et une question facultative prenait l'allure
          d'une porte fermée. Contenue et centrée, elle se lit comme ce
          qu'elle est — un mot de bienvenue qu'on peut écarter.

          400 px au plus, 16 px de marge de chaque côté sur téléphone, et 85 %
          de la hauteur au maximum : c'est L'INTÉRIEUR qui défile, jamais la
          page. `overflow-x-hidden` est la ceinture de sécurité — aucun nom de
          club un peu long ne peut faire glisser la page de côté. */}
      {/* ── LA CARTE ───────────────────────────────────────────────────────
          Le liseré vert du haut et l'ombre colorée sont écrits en style en
          ligne, pas en classes : les valeurs Tailwind sur mesure contenant des
          virgules ne sont pas générées ici — vérifié dans le navigateur, où
          `shadow-[0_0_0_3px_rgba(...)]` ne produisait rigoureusement rien. Un
          style qui a l'air écrit et qui n'existe pas est le pire des défauts,
          parce qu'il survit à toutes les relectures. */}
      <div
        className={`relative w-full max-w-[400px] max-h-[85%] flex flex-col overflow-hidden overflow-x-hidden rounded-[26px] border border-white/[0.09] transition-all duration-300 ease-out ${
          entree ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
        }`}
        style={{
          background:
            "linear-gradient(180deg, #12212b 0%, #0d161d 38%, #0a1218 100%)",
          boxShadow:
            "0 30px 90px rgba(0,0,0,0.8), 0 0 70px rgba(16,185,129,0.14)",
        }}
      >
        {/* Le fil de lumière sur l'arête haute : c'est ce détail qui fait la
            différence entre une boîte et un objet. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(16,185,129,0) 0%, rgba(52,211,153,0.85) 50%, rgba(16,185,129,0) 100%)",
          }}
        />
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
            enCours={enCours}
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
  enCours,
  onChoisir,
  onPasser,
}: {
  prenom: string;
  referentiel: EquipeReferentiel[];
  saisie: string;
  setSaisie: (v: string) => void;
  resultats: Resultat[];
  chercheEncore: boolean;
  enCours: string | null;
  onChoisir: (e: EquipePreferee) => void;
  onPasser: () => void;
}) {
  const cherche = saisie.trim().length >= 2;

  return (
    <>
      {/* ── L'EN-TÊTE NE DÉFILE PAS ────────────────────────────────────────
          La question et la porte de sortie restent sous les yeux quelle que
          soit la position dans la liste. Un bouton « Passer » qu'il faut
          remonter chercher n'est pas une porte de sortie.

          Le voile vert très pâle en haut de la carte tient lieu de signature
          de marque : c'est le vert de ProFoot, à peine posé, jamais crié. */}
      <div className="relative shrink-0 overflow-hidden border-b border-white/[0.06] px-5 pt-5 pb-4">
        {/* ── LA LUEUR DE MARQUE ──────────────────────────────────────────
            Un dégradé radial posé en calque plutôt qu'un `blur` : sur un
            téléphone d'entrée de gamme, flouter une grande surface coûte des
            images par seconde, un dégradé n'en coûte aucune. Et il est écrit
            en style en ligne parce que les valeurs Tailwind sur mesure
            contenant des virgules ne sont pas générées — vérifié à l'écran. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -20%, rgba(16,185,129,0.30) 0%, rgba(16,185,129,0.08) 42%, rgba(16,185,129,0) 72%)",
          }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#34D399]">
              {prenom ? `Bienvenue ${prenom}` : "Bienvenue"}
            </p>

            {/* ── ON NE DEMANDE PAS UNE PRÉFÉRENCE, ON LANCE UN DÉFI ───────
                « Choisis ton club de cœur, juste pour le plaisir » était une
                case de formulaire polie : rien à défendre, rien à ressentir,
                on passe. Un supporter ne se lève pas pour une préférence — il
                se lève pour dire que SON club est le meilleur du monde, et
                que la question ne se pose même pas.

                C'est le même clic, et ce n'est pas le même geste. */}
            <h2 className="mt-2 text-[23px] font-black leading-[1.14] tracking-tight text-white">
              Alors, c&apos;est qui le{" "}
              {/* Le mot qui porte la provocation est écrit en dégradé plutôt
                  qu'en couleur plate : c'est lui qu'on doit voir en premier,
                  avant même d'avoir lu la phrase. */}
              <span
                style={{
                  background: "linear-gradient(100deg, #34D399 0%, #A7F3D0 45%, #FBBF24 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 0 28px rgba(16,185,129,0.35)",
                }}
              >
                MEILLEUR
              </span>{" "}
              club du monde&nbsp;? 🔥⚽
            </h2>
            {/* Une affirmation — « chaque vrai fan a SA réponse » — laisse le
                lecteur spectateur : il acquiesce et ne fait rien. Une demande
                directe le met en position de répondre. C'est la dernière ligne
                avant la grille, elle doit pousser le doigt vers le bas. */}
            <p className="mt-2 text-[13.5px] font-bold leading-relaxed text-white/60">
              Donne-nous ta réponse 👇
            </p>
          </div>

          {/* Discret à l'œil, mais JAMAIS discret au doigt : 44 px de haut,
              la plus petite cible qu'un pouce atteint sans rater. Un bouton
              d'abandon trop petit, c'est quelqu'un qui tape trois fois à côté
              et qui referme l'application. */}
          <button
            type="button"
            onClick={onPasser}
            className="shrink-0 min-h-[44px] min-w-[44px] rounded-full px-3.5 py-2.5 text-[12.5px] font-bold text-white/40 transition-colors hover:bg-white/5 hover:text-white/80 active:bg-white/10"
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

      {/* ── SEUL L'INTÉRIEUR DÉFILE ────────────────────────────────────────
          La page derrière ne bouge pas, la carte garde sa taille : c'est
          cette zone-ci, et elle seule, qui glisse sous le doigt. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 custom-scrollbar">
        {cherche ? (
          <ListeRecherche
            resultats={resultats}
            chercheEncore={chercheEncore}
            onChoisir={onChoisir}
          />
        ) : (
          <>
            {/* ── UNE SEULE GRILLE, SANS CHAMPIONNATS ──────────────────────
                Les clubs étaient rangés sous cinq en-têtes — La Liga, Premier
                League, Ligue 1… On demandait « quelle est ton équipe
                préférée » et on répondait par un classement administratif :
                il fallait d'abord trouver le bon pays pour chercher son
                blason. Quatorze clubs tiennent dans une seule grille, et
                celui qu'on aime se reconnaît à son écusson.

                Deux colonnes sur téléphone : trois rendraient « Borussia
                Dortmund » illisible sur 360 px. L'espacement est volontairement
                généreux — deux cartes collées, c'est une carte sur deux
                touchée par erreur. */}
            <div className="grid grid-cols-2 gap-2.5">
              {clubsVedettes().map((club) => (
                <CarteClub
                  key={club.id}
                  club={club}
                  ecusson={ecussonDe(club, referentiel)}
                  championnat={club.championnat}
                  choisi={enCours === club.id}
                  onChoisir={onChoisir}
                />
              ))}
            </div>

            {/* La réassurance descend ici, en tout petit : elle est
                nécessaire — cette réponse ne filtre aucune analyse — mais au
                milieu d'un moment d'émotion elle éteignait la question. */}
            <p className="pt-4 pb-1 text-center text-[11.5px] leading-relaxed text-white/25">
              Ton club n&apos;est pas là&nbsp;? Cherche-le en haut — tous les
              championnats et toutes les sélections y sont.
              <br />
              Ta réponse ne change rien à tes analyses.
            </p>
          </>
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
  choisi,
  onChoisir,
}: {
  club: ClubVedette;
  ecusson: string | null;
  championnat: string;
  choisi: boolean;
  onChoisir: (e: EquipePreferee) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={choisi}
      onClick={() =>
        onChoisir({ id: club.id, nom: club.nom, logo: ecusson, championnat })
      }
      // ── L'ÉTAT CHOISI SE VOIT À LA BORDURE ET AU FOND ────────────────────
      //
      // Une première version ajoutait un halo `shadow-[0_0_0_3px_rgba(...)]`.
      // Mesuré dans le navigateur : Tailwind ne générait AUCUNE règle pour
      // cette valeur, ni pour le `ring` essayé ensuite. La classe était bien
      // sur l'élément, et il ne se passait rien — le pire des cas, du style
      // qui a l'air écrit et qui n'existe pas.
      //
      // Ne restent donc que des classes vérifiées à l'écran : bordure verte
      // pleine, doublée d'épaisseur, et fond teinté. C'est la confirmation que
      // le bon club a été touché, sur un écran où le doigt cache la moitié de
      // la carte.
      // ── LE CLUB CHOISI S'ALLUME À SES PROPRES COULEURS ───────────────────
      //
      // Un halo vert de marque, identique pour les quatorze clubs, disait
      // « bouton sélectionné ». Le rouge de Liverpool, le jaune de Dortmund ou
      // le ciel de City disent « c'est TON club » — et c'est exactement ce
      // qu'on vient de lui demander de revendiquer.
      //
      // La carte grandit légèrement au lieu de rétrécir : on ne récompense pas
      // un geste en enfonçant le bouton.
      className={`group flex min-h-[68px] items-center gap-3 rounded-[18px] p-3 text-left transition-all duration-200 ${
        choisi
          ? "border-2 scale-105"
          : "border border-white/[0.08] bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.97]"
      }`}
      style={
        choisi
          ? {
              borderColor: club.couleur,
              background: `linear-gradient(160deg, ${club.couleur}2E 0%, ${club.couleur}12 100%)`,
              boxShadow: `0 0 0 4px ${club.couleur}33, 0 12px 34px ${club.couleur}55`,
            }
          : undefined
      }
    >
      {/* L'écusson posé sur un fond légèrement bombé : il se détache du noir
          au lieu d'y flotter, et les blasons sombres restent lisibles. */}
      <span
        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[14px]"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)",
        }}
      >
        {ecusson ? (
          <img src={ecusson} alt="" className="h-8 w-8 object-contain" />
        ) : (
          <span className="text-[10px] font-black tracking-tight text-white/60">
            {club.monogramme}
          </span>
        )}
      </span>
      {/* `break-words` : « Borussia Dortmund » sur 360 px doit passer à la
          ligne, jamais élargir la carte et pousser la page de côté. */}
      <span
        className={`min-w-0 flex-1 break-words text-[12.5px] font-bold leading-tight transition-colors ${
          choisi ? "text-white" : "text-white/85 group-hover:text-white"
        }`}
      >
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
    // ── TOUTE LA CARTE FERME LA FÊTE ────────────────────────────────────
    //
    // Un moment de joie ne doit pas se terminer par la recherche d'un bouton.
    // N'importe quelle tape referme, le bouton reste pour ceux qui cherchent
    // quoi faire. Elle se referme aussi seule au bout de quatre secondes et
    // demie — au-delà, une célébration devient une porte qu'on attend.
    <div
      role="button"
      tabIndex={0}
      aria-label="Continuer"
      onClick={onContinuer}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onContinuer();
      }}
      className="relative flex cursor-pointer flex-col items-center overflow-hidden px-6 py-8 text-center"
    >
      {/* Le halo de fond, en dégradé plutôt qu'en flou : même effet, aucune
          image par seconde perdue sur un téléphone d'entrée de gamme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 50% 20%, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.06) 45%, rgba(16,185,129,0) 75%)",
        }}
      />

      {/* ── PLUS COMPACT QU'AVANT ──────────────────────────────────────────
          L'écusson est passé de 96 à 80 px, le message de deux lignes à une,
          et la marge intérieure a fondu. Le moment reste le même ; il tient
          simplement dans la moitié de la hauteur, ce qui lui va mieux : une
          célébration qui remplit tout l'écran finit par se faire attendre. */}
      <span
        className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-[24px] border border-[#10B981]/40 animate-fade-in"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)",
          boxShadow: "0 0 36px rgba(16,185,129,0.35), 0 10px 32px rgba(0,0,0,0.5)",
        }}
      >
        {equipe?.logo ? (
          <img src={equipe.logo} alt="" className="h-14 w-14 object-contain" />
        ) : (
          <Sparkles className="h-9 w-9 text-[#10B981]" />
        )}
      </span>

      {/* ── LE NOM, PUIS LE CLUB, DANS LA MÊME PHRASE ──────────────────────
          « Waouh Ousmane 🔥 » sur une ligne et « Tu es un GRAND fan de… » sur
          la suivante séparaient la personne de son club. Réunis, ils forment
          une étiquette qu'on porte : Ousmane, vrai fan de Liverpool. */}
      <p
        className="relative mt-5 text-[21px] font-black leading-[1.2] tracking-tight text-white"
        style={{ textShadow: "0 0 26px rgba(16,185,129,0.35)" }}
      >
        {prenom ? `${prenom}, ` : ""}vrai fan de{" "}
        <span className="text-[#34D399]">{equipe?.nom ?? "ton club"}</span>&nbsp;! 🔥
      </p>

      <p className="relative mt-2 text-[12.5px] leading-relaxed text-white/40">
        Et personne ne te fera changer d&apos;avis.
      </p>

      <button
        type="button"
        onClick={onContinuer}
        className="relative mt-5 w-full min-h-[48px] rounded-[14px] px-6 py-3 text-[13.5px] font-black text-[#04140d] transition-transform active:scale-[0.98]"
        style={{
          background: "linear-gradient(180deg, #34D399 0%, #10B981 100%)",
          boxShadow: "0 8px 26px rgba(16,185,129,0.35)",
        }}
      >
        Continuer
      </button>
    </div>
  );
}
