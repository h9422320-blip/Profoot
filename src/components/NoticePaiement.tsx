'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, ArrowRight, Smartphone, ChevronDown, Wallet, Globe } from 'lucide-react';
import {
  moyensDuPays,
  ordonnerPourAfrique,
  MOYEN_GENERIQUE,
  PAYS_SERVIS,
  type MoyenPaiement,
} from '@/lib/moyens-paiement';
import { signalerEtape } from './etapes-vente';

/**
 * LE DERNIER PAS AVANT LE PAIEMENT.
 *
 * ── POURQUOI CETTE FENÊTRE EXISTE ─────────────────────────────────────────
 *
 * La page de paiement appartient à la boutique — Chariow hier, MakeTou depuis
 * le 28 août 2026 : on ne peut rien y écrire. Un acheteur à Abidjan y arrive
 * sans savoir s'il pourra payer avec Wave, et beaucoup renoncent là.
 *
 * La dernière occasion de le rassurer est donc chez nous, à la seconde où il
 * clique. Cette fenêtre lui dit, avant de partir, ce qu'il va trouver.
 *
 * ── CE QU'ELLE N'A PAS À EXPLIQUER : LA MONNAIE ───────────────────────────
 *
 * Un avertissement rouge a vécu ici pendant deux heures, le 2 septembre 2026.
 * Il disait à l'acheteur : « la page suivante s'ouvre sur la Guinée et affiche
 * 31 242 GNF, choisissez d'abord votre pays ».
 *
 * C'ÉTAIT FAUX, et l'erreur mérite d'être racontée parce qu'elle est facile à
 * refaire. En ouvrant la boutique pour l'inspecter, on y a lu « Guinea » et
 * « 31 242 GNF » — et on en a conclu que la boutique, guinéenne, imposait sa
 * monnaie à tout le monde. La vérification manquait d'une ligne : d'où venait
 * la connexion qui inspectait ? D'une adresse IP guinéenne, 197.149.245.9,
 * à Beyla.
 *
 * MakeTou n'imposait rien. Il détectait correctement le pays et affichait la
 * monnaie locale. Vérifié en forçant son cookie `COUNTRY_V3` :
 *
 *     COUNTRY_V3 = GN  →  Guinea         →  31 242 GNF
 *     COUNTRY_V3 = CI  →  Côte d'Ivoire  →   2 000 F CFA
 *
 * Un acheteur à Abidjan voit donc son prix, dans sa monnaie, sans rien faire.
 * L'avertissement lui aurait annoncé un problème qui n'existe pas — et semer
 * le doute sur le prix à l'instant du paiement est exactement ce qu'on essayait
 * d'éviter.
 *
 * NE PAS LE REMETTRE sans avoir d'abord vérifié depuis une adresse du pays
 * concerné. Ce que l'on voit sur une boutique dépend d'où l'on regarde.
 *
 * ── ELLE NE RETIENT PERSONNE ──────────────────────────────────────────────
 *
 * Au bout de vingt secondes, la redirection se fait toute seule. Quelqu'un qui
 * sait déjà comment payer n'a rien à cliquer et ne perd rien ; quelqu'un qui
 * hésite a le temps de lire. Un obstacle de plus sur le chemin du paiement
 * serait exactement le contraire du but recherché.
 *
 * Le compte à rebours s'arrête dès qu'on touche la fenêtre — ouvrir la liste
 * des pays ne doit pas déclencher un départ au milieu du geste.
 *
 * ── PENSÉE POUR UN TÉLÉPHONE, PAS ADAPTÉE À LUI ───────────────────────────
 *
 * La quasi-totalité des acheteurs sont sur mobile. La fenêtre est donc une
 * feuille ancrée en bas de l'écran — là où le pouce se trouve — et devient une
 * carte centrée seulement à partir de la tablette. Sa hauteur est bornée et la
 * liste défile à l'intérieur : le Nigeria propose neuf moyens de paiement, et
 * rien ne doit pousser le bouton hors de l'écran.
 */

export interface NoticePaiementProps {
  /** Pays détecté à l'ouverture, ou null si la détection a échoué. */
  paysDetecte: string | null;
  /** Ce que l'acheteur s'apprête à payer, affiché tel quel. */
  libelleOffre: string;
  /**
   * L'identifiant de l'offre, pour la mesure. Jamais affiché.
   *
   * ── POURQUOI IL EST INDISPENSABLE ────────────────────────────────────────
   *
   * Cette fenêtre émettait ses trois sorties — continuer, fermer, laisser
   * filer — SANS nom d'offre. Elles tombaient donc toutes dans un panier
   * commun, séparé des clics qui les avaient provoquées. Mesuré du 22 au
   * 24 août 2026 : 146 clics sur l'offre Essentiel d'un côté, 192 « Continuer »
   * sans offre de l'autre, et un entonnoir qui affichait « 267 % ont cliqué
   * Continuer » — un pourcentage impossible, faute de dénominateur commun.
   *
   * L'appelant sait quelle offre il vend ; il le dit maintenant.
   */
  cleOffre?: string;
  /**
   * Le montant à payer, en francs CFA.
   *
   * ── POURQUOI IL EST AFFICHÉ UNE SECONDE FOIS ─────────────────────────────
   *
   * Il figure déjà dans `libelleOffre`, en petit, sous le titre. Mais il sert
   * ici à autre chose : rappeler d'avoir la somme SUR SON COMPTE avant de
   * partir.
   *
   * Mesuré du 6 au 24 août 2026 : sur 1 974 arrivées à la caisse, 267 se sont
   * soldées par un ÉCHEC de paiement — 13,5 %. Ce ne sont pas des hésitants,
   * ce sont des gens qui ont saisi leur numéro et validé. Le motif le plus
   * banal d'un refus mobile money est un solde insuffisant, et personne ne le
   * vérifie avant de cliquer.
   *
   * Absent, la ligne ne s'affiche pas : mieux vaut aucune consigne qu'une
   * consigne sans montant.
   */
  montantXof?: number;
  /**
   * Lance le paiement. Reçoit le pays retenu — celui détecté, ou celui que
   * l'acheteur a corrigé dans la liste.
   */
  onContinuer: (paysRetenu: string | null) => void;
  onFermer: () => void;
}

/**
 * ── LE SEUL RÉGLAGE À TOUCHER POUR CHANGER LE DÉLAI ──────────────────────
 *
 * Combien de secondes la notice reste affichée avant de partir toute seule
 * vers le paiement. Le compte à rebours, la barre de progression et la phrase
 * affichée en dessous se calent tous sur cette valeur : la changer ici suffit,
 * il n'y a rien d'autre à modifier ailleurs.
 *
 * ── POURQUOI VINGT, ET PLUS CINQ ─────────────────────────────────────────
 *
 * Cinq secondes suffisaient à voir la fenêtre, pas à la lire. Il y a trois
 * étapes numérotées, la liste des moyens de paiement du pays — jusqu'à neuf au
 * Nigeria — et le lien pour corriger son pays. Personne ne lit tout cela en
 * cinq secondes sur un téléphone, et une notice qu'on n'a pas eu le temps de
 * lire ne sert à rien : elle ajoute une étape sans rien expliquer.
 *
 * Vingt secondes laissent le temps de comprendre. Et cela ne retient personne :
 * le bouton « Continuer vers le paiement » reste actif dès la première seconde,
 * et le simple fait de toucher la fenêtre arrête le compte à rebours.
 */
const SECONDES = 20;

export default function NoticePaiement({
  paysDetecte,
  libelleOffre,
  cleOffre,
  montantXof,
  onContinuer,
  onFermer,
}: NoticePaiementProps) {
  const [pays, setPays] = useState<string | null>(paysDetecte);
  const [reste, setReste] = useState(SECONDES);
  const [arrete, setArrete] = useState(false);
  const [choisirPays, setChoisirPays] = useState(false);
  const [monte, setMonte] = useState(false);
  /** Vrai dès que l'acheteur a choisi son pays lui-même. */
  const [corrigeALaMain, setCorrigeALaMain] = useState(false);

  // ── LE PAYS ARRIVE APRÈS L'OUVERTURE, ET LA FENÊTRE DOIT SUIVRE ─────────
  //
  // La détection est une requête au serveur : elle se termine une fraction de
  // seconde après l'affichage. Sans cette synchronisation, l'état initial —
  // « pays inconnu » — restait figé, et un acheteur ivoirien lisait la notice
  // générique alors que le serveur savait parfaitement où il était.
  //
  // Un pays choisi à la main n'est jamais écrasé : c'est le seul cas où
  // quelqu'un a explicitement contredit la détection.
  useEffect(() => {
    if (!corrigeALaMain && paysDetecte) setPays(paysDetecte);
  }, [paysDetecte, corrigeALaMain]);

  const fiche = moyensDuPays(pays);
  const moyens: MoyenPaiement[] = fiche
    ? ordonnerPourAfrique(fiche.moyens)
    : [MOYEN_GENERIQUE];

  // ── CHAQUE SORTIE DE LA NOTICE EST NOMMÉE ────────────────────────────────
  //
  // Trois façons d'en sortir, et elles ne disent pas la même chose : cliquer
  // « Continuer » est une décision, laisser filer les vingt secondes est de
  // l'indifférence, fermer est un refus. Les confondre reviendrait à mesurer
  // un départ sans savoir s'il faut raccourcir le délai, réécrire le texte, ou
  // ne rien changer.
  const partir = useCallback(
    (cause: 'notice-continuer' | 'notice-auto' = 'notice-continuer') => {
      signalerEtape(cause, cleOffre);
      onContinuer(pays);
    },
    [onContinuer, pays, cleOffre]
  );

  // `createPortal` a besoin du document : on attend le montage côté navigateur.
  useEffect(() => setMonte(true), []);

  // ── L'OUVERTURE EST SIGNALÉE PAR L'APPELANT, PAS D'ICI ──────────────────
  //
  // Cette fenêtre ne sait pas quelle offre a été choisie : le paywall vend un
  // match seul à 600 FCFA, la page des tarifs trois abonnements. Signaler
  // depuis ici aurait tout fondu dans un seul compteur — et, sur le paywall
  // qui signale déjà, aurait compté deux fois le même clic.
  //
  // Chaque porte d'achat émet donc son propre signal, avec le nom de l'offre.

  // Le corps de la page ne défile plus derrière la feuille : sur téléphone,
  // un fond qui bouge sous le doigt donne l'impression que rien n'est cliquable.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  useEffect(() => {
    if (arrete) return;
    if (reste <= 0) {
      partir('notice-auto');
      return;
    }
    const t = setTimeout(() => setReste((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [reste, arrete, partir]);

  // Fermer, c'est refuser. On le note avant de rendre la main.
  const fermer = useCallback(() => {
    signalerEtape('notice-fermee', cleOffre);
    onFermer();
  }, [onFermer, cleOffre]);

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, [fermer]);

  if (!monte) return null;

  // ── LA DEUXIÈME ÉTAPE DÉPEND DU MOYEN, PAS DU PAYS ──────────────────────
  //
  // « Saisissez votre numéro, puis validez la demande reçue sur votre
  // téléphone » décrit le mobile money. Servie à un acheteur autrichien, qui
  // n'a que la carte, cette phrase décrit une manipulation qui n'existera pas
  // — et une consigne qui ne correspond pas à l'écran fait douter de tout le
  // reste.
  const premier = moyens[0];
  const parMobile = !(
    premier.cle === 'card' ||
    premier.cle === 'card_cb' ||
    premier.cle.startsWith('bank_')
  );

  const etapes = [
    fiche && moyens.length > 1
      ? `Choisissez votre moyen de paiement — ${premier.nom} apparaît en premier.`
      : `Choisissez « ${premier.nom} » sur la page de paiement.`,
    parMobile
      ? 'Saisissez votre numéro, puis validez la demande reçue sur votre téléphone.'
      : 'Saisissez les informations de votre carte, puis validez le paiement.',
    'Votre accès s\'ouvre automatiquement, en quelques secondes.',
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Comment payer"
      // Toucher la fenêtre, c'est vouloir la lire : le départ automatique
      // s'annule, sinon on partirait au milieu d'un geste.
      onPointerDown={() => setArrete(true)}
    >
      {/* Le fond assombri. Un simple appui dessus referme. */}
      <button
        aria-label="Fermer"
        onClick={fermer}
        className="absolute inset-0 w-full h-full bg-black/70 backdrop-blur-[6px] animate-[apparition_200ms_ease-out]"
      />

      <div
        className="
          relative w-full sm:max-w-[440px]
          max-h-[92dvh] sm:max-h-[85dvh] overflow-y-auto
          rounded-t-[26px] sm:rounded-[26px]
          border border-[#2e4757] border-b-0 sm:border-b
          bg-gradient-to-b from-[#1d2f3a] to-[#16242e]
          shadow-[0_-8px_40px_rgba(0,0,0,0.5)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.6)]
          animate-[feuille_260ms_cubic-bezier(0.16,1,0.3,1)]
        "
      >
        {/* La poignée : sur téléphone, elle dit « ça se ferme en tirant ». */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <span className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <button
          onClick={fermer}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-2 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-5 pb-5 pt-3 sm:px-6 sm:pt-6">
          {/* ── Titre ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/12 border border-[#10b981]/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#10b981]">
              <ShieldCheck className="w-3 h-3" /> Paiement sécurisé
            </span>
          </div>

          <h2 className="text-[19px] sm:text-[21px] font-black text-white leading-tight mt-2.5">
            {fiche ? `Comment payer depuis ${fiche.nom}` : 'Comment payer'}
          </h2>
          <p className="text-[12.5px] text-white/50 mt-1 leading-relaxed">
            {libelleOffre}
          </p>

          {/* ── Les moyens réellement disponibles ───────────────────────── */}
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35 mb-2">
              {moyens.length > 1
                ? 'Moyens de paiement disponibles'
                : 'Moyen de paiement disponible'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {moyens.map((m) => (
                <span
                  key={m.cle}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 pl-1.5 pr-2.5 py-1"
                >
                  {/* Icônes servies depuis notre domaine : sur un téléphone en
                      3G, une image qui ne charge pas casse la confiance qu'on
                      cherche justement à créer ici. */}
                  <img
                    src={`/moyens/${m.cle}.svg`}
                    alt=""
                    width={18}
                    height={18}
                    loading="eager"
                    className="w-[18px] h-[18px] rounded-full object-cover bg-white/10 shrink-0"
                  />
                  <span className="text-[11.5px] font-bold text-white/85 whitespace-nowrap">
                    {m.nom}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* ── Les trois étapes ────────────────────────────────────────── */}
          <ol className="mt-4 space-y-2.5">
            {etapes.map((texte, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-[#10b981]/15 border border-[#10b981]/30 text-[11px] font-black text-[#10b981] flex items-center justify-center mt-[1px]">
                  {i + 1}
                </span>
                <span className="text-[12.5px] text-white/70 leading-relaxed">{texte}</span>
              </li>
            ))}
          </ol>

          {/* ── Corriger le pays ────────────────────────────────────────── */}
          <div className="mt-4">
            {!choisirPays ? (
              <button
                onClick={() => {
                  setArrete(true);
                  setChoisirPays(true);
                }}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-white/45 hover:text-white/75 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                {fiche ? 'Vous n\'êtes pas dans ce pays ?' : 'Choisir votre pays'}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            ) : (
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-white/35 mb-1.5">
                  Votre pays
                </span>
                <select
                  value={pays ?? ''}
                  onChange={(e) => { setCorrigeALaMain(true); setPays(e.target.value || null); }}
                  className="w-full rounded-[14px] bg-[#101c24] border border-[#2e4757] px-3 py-2.5 text-[13px] text-white outline-none focus:border-[#10b981]/60"
                >
                  <option value="">— Sélectionnez —</option>
                  {PAYS_SERVIS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* ── LE RAPPEL DU SOLDE ───────────────────────────────────────
              Mesuré du 6 au 24 août 2026 : 267 paiements échoués sur 1 974
              arrivées en caisse, soit 13,5 %. Ce ne sont pas des hésitants —
              ils ont saisi leur numéro et validé. Le motif le plus banal d'un
              refus mobile money est un solde insuffisant, et personne ne le
              vérifie avant de partir.

              La ligne ne s'affiche que pour le mobile money : servie à un
              acheteur qui paie par carte, elle décrirait une manipulation qui
              n'existe pas chez lui — et une consigne qui ne correspond pas à
              l'écran fait douter de tout le reste. */}
          {parMobile && Number.isFinite(montantXof) && (montantXof as number) > 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-2.5">
              <Wallet className="w-4 h-4 text-amber-400 shrink-0 mt-[1px]" />
              <p className="text-[12.5px] text-white/80 leading-relaxed">
                Assurez-vous d&apos;avoir{' '}
                <strong className="text-amber-300">
                  {(montantXof as number).toLocaleString('fr-FR')} FCFA
                </strong>{' '}
                sur votre compte mobile money avant de payer.
              </p>
            </div>
          )}


          {/* ── Le bouton ───────────────────────────────────────────────── */}
          <button
            onClick={() => partir('notice-continuer')}
            className="
              mt-5 w-full rounded-[16px] bg-[#10b981] hover:bg-[#059669] active:scale-[0.99]
              px-4 py-4 text-[14.5px] font-black text-[#06231a]
              flex items-center justify-center gap-2 transition-all
              shadow-[0_6px_20px_rgba(16,185,129,0.28)]
            "
          >
            Continuer vers le paiement
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* La barre de temps restant. Elle disparaît dès qu'on touche la
              fenêtre : afficher un compte à rebours arrêté serait un mensonge
              tranquille, et l'acheteur croirait devoir se dépêcher. */}
          {!arrete && (
            <div className="mt-3">
              <div className="h-[3px] w-full rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full bg-[#10b981]/70 rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(reste / SECONDES) * 100}%` }}
                />
              </div>
              <p className="text-[10.5px] text-white/35 text-center mt-1.5">
                Redirection automatique dans {reste} seconde{reste > 1 ? 's' : ''}
              </p>
            </div>
          )}

          <p className="text-[10.5px] text-white/30 text-center mt-3 leading-relaxed">
            Paiement traité par Chariow. Votre accès s&apos;ouvre automatiquement
            après confirmation.
          </p>
        </div>
      </div>

    </div>,
    document.body
  );
}
