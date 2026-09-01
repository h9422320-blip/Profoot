"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { sessionPresumee } from "@/lib/session-legere";
import type { ChiffresPublics } from "@/lib/chiffres-publics";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Target,
  Zap,
  Shield,
  PlayCircle,
  CheckCircle2,
  ChevronDown,
  TrendingUp,
  Activity,
  Globe,
  Trophy,
  Users,
  Cpu,
  Eye,
  Database,
  Quote,
  MessageCircle,
  Wifi,
} from "lucide-react";
import Image from "next/image";

// ============================================================================
// PROFOOT — LANDING PAGE PREMIUM v3.0
// Inspired by Visifoot — Dark + Emerald + Stadium aesthetic
// ============================================================================

/**
 * LES DATES DE LA MAQUETTE, RELATIVES A AUJOURD'HUI.
 *
 * Elles etaient ecrites en dur : « 03/04 » et « 08/04 ». Le 30 aout 2026, un
 * visiteur lisait donc « Prochains matchs : 3 avril » — cinq mois en arriere —
 * juste a cote d'un badge « Temps Reel » et d'une promesse de donnees
 * actualisees en permanence. La maquette contredisait l'argument de vente
 * qu'elle est censee illustrer.
 *
 * Le calcul se fait APRES l'affichage, dans le navigateur, et jamais pendant le
 * rendu du serveur : cette page est mise en cache et servie identique a tout le
 * monde, une date calculee au rendu serait donc figee au jour de sa
 * fabrication — le defaut qu'on repare. Le repli reste une chaine vide plutot
 * qu'une fausse date : mieux vaut un blanc d'une seconde qu'un mensonge.
 */
function useDateProche(joursApres: number): string {
  const [texte, setTexte] = useState('');
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + joursApres);
    const jj = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    setTexte(`${jj}/${mm}`);
  }, [joursApres]);
  return texte;
}

// Animated counter hook
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return { count, ref };
}

// Fade-in on scroll hook
/**
 * Destination du bouton d'appel à l'action.
 * Un visiteur qui n'a pas encore de compte doit arriver sur l'INSCRIPTION —
 * l'envoyer vers la connexion lui demandait des identifiants qu'il n'a pas.
 * Ceux qui ont déjà un compte entrent directement dans l'application.
 */
function useStartHref() {
  const [href, setHref] = useState('/signup');
  // ── LA DESTINATION SE DÉCIDE SANS CHARGER SUPABASE ──────────────────────
  //
  // Ces lignes appelaient `supabase.auth.getUser()`, ce qui imposait au
  // navigateur de télécharger le client Supabase entier — 226 Ko de code — sur
  // la page que voient TOUS les nouveaux visiteurs, pour une seule décision :
  // ce bouton mène-t-il vers `/analyze` ou vers `/signup` ?
  //
  // La présence du cookie de session suffit à répondre. Elle ne PROUVE rien —
  // le cookie peut être périmé — mais elle n'ouvre aucun accès : les droits
  // restent vérifiés par le serveur à chaque requête. Au pire, la personne
  // arrive sur `/analyze` et se voit renvoyée vers la connexion, exactement
  // comme avant quand sa session avait expiré entre deux visites.
  useEffect(() => {
    if (sessionPresumee()) setHref('/analyze');
  }, []);
  return href;
}

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// Competition logos data
const competitions = [
  { name: "Premier League", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { name: "La Liga", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { name: "Serie A", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { name: "Bundesliga", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { name: "Ligue 1", logo: "https://media.api-sports.io/football/leagues/61.png" },
  { name: "Champions League", logo: "https://media.api-sports.io/football/leagues/2.png" },
  { name: "Europa League", logo: "https://media.api-sports.io/football/leagues/3.png" },
  { name: "CAN", logo: "https://media.api-sports.io/football/leagues/6.png" },
];

// FAQ data
const faqItems = [
  {
    q: "Comment fonctionne l'analyse IA de ProFoot ?",
    a: "ProFoot utilise un moteur d'analyse mathématique connecté en temps réel à API-Football. L'algorithme analyse la forme récente, les confrontations directes, les statistiques avancées (xG, possession, tirs cadrés) et génère une estimation avec un indice de confiance.",
  },
  {
    q: "Les analyses sont-elles fiables ?",
    a: "Nos analyses sont basées sur des données réelles et des modèles statistiques. Aucune IA n'est infaillible, mais ProFoot vous donne un avantage analytique majeur en traitant des centaines de variables que le cerveau humain ne peut pas traiter simultanément.",
  },
  {
    q: "Quelles compétitions sont couvertes ?",
    a: "ProFoot couvre plus de 15 compétitions majeures : Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, CAN, et bien d'autres.",
  },
  {
    q: "Est-ce que ProFoot est gratuit ?",
    a: "Oui ! Vous pouvez commencer à utiliser ProFoot gratuitement avec des analyses de base. Des plans premium sont disponibles pour des analyses illimitées et des fonctionnalités avancées.",
  },
];

// ── LES TÉMOIGNAGES ONT ÉTÉ RETIRÉS, ET C'EST DÉLIBÉRÉ ────────────────────
//
// Huit citations vivaient ici : « Karim B., Analyste Football », « Antoine L.,
// Data Analyst », « Claire P., Étudiante en sport ». Aucune de ces personnes
// n'existe. Des noms inventés, majoritairement européens, cinq étoiles partout,
// sur un produit vendu à Abidjan, Bamako et Ouagadougou.
//
// Ils ont été remplacés par le mur des preuves — des rencontres réelles, avec
// leur date, le pronostic annoncé avant le coup d'envoi et le score final. Le
// mur existait déjà, il était public, et rien sur cette page n'y menait.
//
// Ne pas les remettre. Un témoignage à cinq étoiles ne se vérifie pas, donc ne
// convainc pas celui qui doute — et celui qui doute est précisément le visiteur
// qu'il faut retourner. Une carte du mur se vérifie en trente secondes sur
// n'importe quel site de football.

export default function LandingPage({
  ambassadeurs,
  preuves,
  chiffres,
}: {
  ambassadeurs?: React.ReactNode;
  preuves?: React.ReactNode;
  chiffres?: ChiffresPublics;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // `user` ne servait qu'à répondre « connecté ou non » : les cinq endroits
  // qui l'utilisaient choisissent une adresse de lien ou un libellé de bouton.
  // Aucun n'affiche le nom, l'adresse ou quoi que ce soit du compte. Charger
  // tout le client Supabase — et rester à l'écoute des changements de session —
  // pour un booléen coûtait 226 Ko sur la page d'entrée du site.
  const [user, setUser] = useState(false);

  useEffect(() => {
    setUser(sessionPresumee());

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="landing-root relative">
      <div className="ambient-lighting">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
      </div>
      <div className="premium-grid-bg" />
      {/* ================================================================ */}
      {/* NAVIGATION */}
      {/* ================================================================ */}
      <nav className={`landing-nav ${scrolled ? "nav-scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
              <Image src="/logo.png" alt="ProFoot" width={32} height={32} className="w-full h-full object-cover scale-[1.35]" />
            </div>
            <span className="nav-brand-text">ProFoot</span>
          </Link>

          <div className="nav-links-desktop">
            {/* ── « PREUVES » VIENT EN PREMIER, ET C'EST UN VRAI LIEN ───────
                La page `/preuves` était publique depuis le début et AUCUN lien
                du site n'y menait : on ne pouvait y arriver que par Google ou
                en tapant l'adresse. Le seul argument vérifiable du produit
                était injoignable depuis sa propre page d'accueil.
                Il passe devant « Fonctionnalités » parce que c'est la question
                que se pose d'abord quelqu'un qui découvre le site : est-ce que
                ça marche vraiment ? */}
            <Link href="/preuves">Preuves</Link>
            <a href="#features">Fonctionnalités</a>
            <a href="#competitions">Compétitions</a>
            <a href="#how-it-works">Comment ça marche</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Link href="/analyze" className="nav-login">
                  Mon compte
                </Link>
              ) : (
                <Link href="/login" className="nav-login">
                  Se connecter
                </Link>
              )}
            </div>
            <Link href={user ? "/analyze" : "/signup"} className="nav-cta !flex">
              <Zap className="w-4 h-4" /> Analyser
            </Link>
          </div>

        </div>

      </nav>

      <main>
        {/* ================================================================ */}
        {/* HERO SECTION */}
        {/* ================================================================ */}
        <section className="hero-section">
          {/* L'IMAGE DE FOND A ÉTÉ RETIRÉE.
              C'était une photo hébergée chez un site tiers (Unsplash) qui
              renvoie aujourd'hui une erreur 404 : le navigateur affichait donc
              une vignette d'image cassée dans le coin supérieur gauche, juste
              à côté du logo. Sur la page d'accueil, c'est la première chose que
              voit un visiteur.
              Le dégradé et le halo suffisent — ils étaient déjà là, dessous. */}
          <div className="hero-bg">
            <div className="hero-overlay" />
            <div className="hero-glow" />
          </div>

          <div className="hero-content">
            {/* « ProFoot 3.0 is Live ➔ » ne voulait rien dire pour un
                visiteur : un numéro de version en anglais, sur un site
                francophone, avec un anneau lumineux qui tourne — la signature
                exacte des pages fabriquées à la chaîne. Personne n'a jamais
                acheté parce qu'un logiciel était en « version 3.0 ».
                À la place, un fait vérifiable, en français, que le mur de
                preuves plus bas confirme. */}
            <div className="live-badge-wrapper">
              <div className="live-badge">
                <div className="live-badge-dot" />
                Analyses vérifiées après chaque match
              </div>
            </div>

            {/* LE NOM DE LA MARQUE EST DANS LE TITRE PRINCIPAL.
                Il n'y était pas : le titre disait « PRÉDIT CHAQUE MATCH AVANT
                QU'IL NE COMMENCE » sans jamais nommer le produit. Or le titre
                principal est l'un des signaux les plus forts pour associer un
                nom à un site, et l'objectif est précisément de sortir premier
                quand quelqu'un tape « ProFoot AI ».
                La promesse reste en tête et en gros ; le nom vient dessous,
                dans le même titre. */}
            <h1 className="hero-title">
              ANALYSE CHAQUE MATCH<br />
              AVANT QU'IL <span className="text-emerald-gradient">NE COMMENCE.</span>
              <span className="block mt-3 text-[15px] sm:text-lg font-bold tracking-normal text-white/55">
                ProFoot AI — l&apos;analyse de match par intelligence artificielle
              </span>
            </h1>

            <p className="hero-subtitle">
              L'intelligence artificielle au service du football. Des millions de données analysées en temps réel pour anticiper chaque résultat avec une précision mathématique.
            </p>

            {/* `items-center` manquait.
                Le conteneur occupe toute la largeur sur téléphone, et le bouton
                est plafonné à 300 pixels par la feuille de style. Sans
                alignement explicite, un enfant dont la largeur est bridée se
                pose au DÉBUT de l'axe — c'est-à-dire à gauche. Le bouton
                paraissait donc décalé, sur téléphone comme sur ordinateur.
                Il est désormais centré à toutes les tailles d'écran. */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 w-full md:w-auto px-4 md:px-0">
              <Link href={user ? "/analyze" : "/signup"} className="hero-cta-primary w-full md:w-auto justify-center">
                Démarrer l'analyse <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Hero App Mockup (ULTRA PREMIUM) */}
            <div className="hero-app-mockup">
              <div className="hero-app-mockup-glow" />
              
              {/* Floating Logos (from screenshot) */}
              <div className="floating-logo psg-logo">
                <img src="https://media.api-sports.io/football/teams/85.png" alt="PSG" fetchPriority="high" decoding="async" width={48} height={48} />
              </div>
              <div className="floating-logo real-logo">
                <img src="https://media.api-sports.io/football/teams/541.png" alt="Real Madrid" fetchPriority="high" decoding="async" width={48} height={48} />
              </div>
              <div className="floating-logo barca-logo">
                <img src="https://media.api-sports.io/football/teams/529.png" alt="Barcelona" fetchPriority="high" decoding="async" width={48} height={48} />
              </div>
              <div className="floating-logo chelsea-logo">
                <img src="https://media.api-sports.io/football/teams/49.png" alt="Chelsea" fetchPriority="high" decoding="async" width={48} height={48} />
              </div>

              <div className="hero-app-mockup-inner">
                <BoutonsLateraux />

                {/* App Content */}
                <div className="mockup-screen">
                  {/* Encoche découpée dans l'écran, pas posée sur le cadre */}
                  <div className="mockup-notch" />
                  <BarreEtat />
                  <AppMockupContent />
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute top-20 -left-12 bg-[#111c24] border border-[#10b981]/30 px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.2)] flex items-center gap-2 animate-[float_4s_ease-in-out_infinite] hover:scale-110 transition-transform cursor-default z-30">
                <Database className="w-4 h-4 text-[#10b981] animate-pulse" />
                <span className="text-white/90 text-xs font-bold">+200 Ligues</span>
              </div>
              <div className="absolute bottom-32 -right-14 bg-[#111c24] border border-[#06b6d4]/30 px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(6,182,212,0.2)] flex items-center gap-2 animate-[float_5s_ease-in-out_infinite_reverse] hover:scale-110 transition-transform cursor-default z-30">
                <Cpu className="w-4 h-4 text-[#06b6d4] animate-pulse" />
                <span className="text-white/90 text-xs font-bold">Temps Réel</span>
              </div>
            </div>
          </div>
        </section>

        {/* Les ambassadeurs viennent APRÈS la promesse produit : le visiteur
            doit d'abord comprendre ce qu'on lui propose. */}
        {ambassadeurs}

        {/* ================================================================ */}
        {/* COMPETITIONS BAND */}
        {/* ================================================================ */}
        <section id="competitions" className="competitions-section">
          <CompetitionsFadeIn />
        </section>

        {/* ================================================================ */}
        {/* SHOWCASE SECTION — Data Engine showcase */}
        {/* ================================================================ */}
        <section className="showcase-section">
          <div className="showcase-bg">
            <img
              src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=45&w=640&auto=format&fit=crop"
              alt="" loading="lazy" decoding="async"
              className="showcase-bg-img"
            />
            <div className="showcase-overlay" />
          </div>
          <ShowcaseContent />
        </section>

        {/* ================================================================ */}
        {/* FEATURES SECTION */}
        {/* ================================================================ */}
        <section id="features" className="features-section">
          <FeaturesContent />
        </section>

        {/* ================================================================ */}
        {/* HOW IT WORKS */}
        {/* ================================================================ */}
        <section id="how-it-works" className="hiw-section relative">
          <div className="premium-grid-bg opacity-30" />
          <HowItWorksContent />
        </section>

        {/* ================================================================ */}
        {/* STATS COUNTERS */}
        {/* ================================================================ */}
        <section className="stats-section">
          <StatsContent chiffres={chiffres} />
        </section>

        {/* ================================================================ */}
        {/* ANALYSIS IA SECTION — App preview */}
        {/* ================================================================ */}
        <section className="analysis-section">
          <AnalysisContent />
        </section>

        {/* ================================================================ */}
        {/* LE MUR DES PREUVES — à la place des huit témoignages inventés    */}
        {/* ================================================================ */}
        {/*
          Il garde la classe `testimonials-section` : c'est elle qui porte le
          rythme vertical de la page et le filet lumineux qui sépare les
          sections. Renommer la classe aurait demandé de dupliquer trente
          lignes de CSS pour un résultat identique à l'œil.
        */}
        <section className="testimonials-section">{preuves}</section>

        {/* ================================================================ */}
        {/* FAQ SECTION */}
        {/* ================================================================ */}
        <section id="faq" className="faq-section">
          {/*
            Données structurées de la FAQ. Elles permettent à Google d'afficher
            les questions directement sous le lien, ce qui prend plus de place
            dans les résultats et répond à la recherche avant même le clic.

            Elles sont construites À PARTIR de `faqItems`, jamais recopiées :
            une question modifiée à l'écran mais oubliée ici produirait une
            incohérence que Google sanctionne.
          */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: faqItems.map((item) => ({
                  "@type": "Question",
                  name: item.q,
                  acceptedAnswer: { "@type": "Answer", text: item.a },
                })),
              }),
            }}
          />
          <div className="faq-inner">
            <h2 className="section-title">QUESTIONS FRÉQUENTES</h2>
            <p className="section-subtitle">Une réponse claire à toutes vos questions sur ProFoot.</p>
            <div className="faq-list">
              {faqItems.map((item, i) => (
                <div key={i} className={`faq-item ${openFaq === i ? "faq-open" : ""}`}>
                  <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{`${i + 1}. ${item.q}`}</span>
                    <ChevronDown className={`faq-chevron ${openFaq === i ? "faq-chevron-open" : ""}`} />
                  </button>
                  {/*
                    La réponse est TOUJOURS présente dans la page ; seul son
                    affichage est replié. Auparavant elle n'était insérée qu'au
                    clic : Google n'en voyait donc aucune, et c'est justement ce
                    texte-là qui répond aux questions que les gens tapent dans
                    le moteur de recherche.
                  */}
                  <div className="faq-answer" hidden={openFaq !== i}>
                    {item.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FINAL CTA */}
        {/* ================================================================ */}
        <section className="final-cta-section">
          <div className="final-cta-bg">
            <img
              src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=45&w=640&auto=format&fit=crop"
              alt="" loading="lazy" decoding="async"
              className="final-cta-bg-img"
            />
            <div className="final-cta-overlay" />
          </div>
          <div className="final-cta-content">
            <h2 className="final-cta-title">
              PRÊT À ANALYSER VOS MATCHS<br />
              <span className="text-emerald-gradient">AUTREMENT ?</span>
            </h2>
            <p className="final-cta-sub">
              Explorez vos scénarios et anticipez les résultats dès maintenant.
            </p>
            <Link href={user ? "/analyze" : "/signup"} className="final-cta-btn w-full md:w-auto">
              <Zap className="w-5 h-5" /> Accéder aux analyses
            </Link>
          </div>
        </section>
      </main>

      {/* ================================================================ */}
      {/* FOOTER */}
      {/* ================================================================ */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="nav-brand">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"><Image src="/logo.png" alt="ProFoot" width={32} height={32} className="w-full h-full object-cover scale-[1.35]" /></div>
              <span className="nav-brand-text">ProFoot</span>
            </div>
            <p className="footer-desc">
              La plateforme d'analyse IA football la plus avancée. Analyses, statistiques et scénarios tactiques en temps réel.
            </p>
          </div>
          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Produit</h4>
              <Link href={user ? "/analyze" : "/signup"}>Analyse IA</Link>
              {/* Second chemin vers les preuves : le menu du haut disparaît sur
                  téléphone, et c'est là que sont presque tous les visiteurs. */}
              <Link href="/preuves">Analyses vérifiées</Link>
              <Link href="/matches">Matchs du jour</Link>
              <Link href="/standings">Classements</Link>
              <Link href="/support">Support</Link>
            </div>
            <div className="footer-col">
              <h4>Compétitions</h4>
              <span>Premier League</span>
              <span>La Liga</span>
              <span>Champions League</span>
            </div>
            <div className="footer-col">
              <h4>Légal</h4>
              <Link href="/mentions-legales">Mentions légales</Link>
              <Link href="/confidentialite">Confidentialité</Link>
              <Link href="/cgv">CGU / CGV</Link>
            </div>
          </div>
        </div>
        {/* ── CE QUE NOUS SOMMES, ÉCRIT NOIR SUR BLANC ────────────────────
            Un lecteur pressé — ou un contrôleur de plateforme de paiement —
            juge un site de football sur son vocabulaire. Le nôtre est celui
            de l'analyse, mais l'absence de mots de pari ne se remarque pas :
            seule une phrase qui dit ce que l'outil EST se remarque. Elle vit
            au pied de chaque page, là où on cherche l'identité d'un site. */}
        <div className="footer-bottom" style={{ flexDirection: "column", gap: "10px", textAlign: "center" }}>
          <span style={{ opacity: 0.55, fontSize: "11.5px", lineHeight: 1.6, maxWidth: "620px" }}>
            ProFoot AI est un outil d&apos;analyse statistique et de modélisation du football.
            Nous ne sommes ni un opérateur de jeux, ni un intermédiaire de paris, et nous
            n&apos;acceptons aucun enjeu. Les analyses publiées sont fournies à titre informatif
            et ne constituent pas un conseil financier.
          </span>
          <span>© 2026 ProFoot AI. Tous droits réservés.</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS (with scroll animations)
// ============================================================================

function CompetitionsFadeIn() {
  const { ref, visible } = useFadeIn();
  // Double the array for infinite marquee effect
  const doubledComps = [...competitions, ...competitions];
  return (
    <div ref={ref} className={`competitions-inner ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <div className="competitions-label">
        <Trophy className="w-5 h-5 text-[#10b981]" />
        <span>PLUS DE <strong>15 COMPÉTITIONS</strong> COUVERTES</span>
      </div>
      <div className="marquee-container">
        <div className="marquee-track">
          {doubledComps.map((c, i) => (
            <div key={`${c.name}-${i}`} className="marquee-item" title={c.name}>
              <img src={c.logo} alt={c.name} className="competition-logo" loading="lazy" decoding="async" />
              <span className="marquee-name">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShowcaseContent() {
  const startHref = useStartHref();
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} className={`showcase-inner relative z-10 ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <div className="showcase-match-label">Le cœur du moteur ProFoot</div>
      <h2 className="showcase-title">
        UNE ARCHITECTURE IA<br/><span className="text-gradient">SANS PRÉCÉDENT</span>
      </h2>
      <p className="showcase-desc">
        Nous ne nous contentons pas des données de surface. Notre moteur ingère la forme récente, les xG, les compositions attendues et l'historique H2H pour générer un modèle mathématique complet.
      </p>
      
      <div className="flex flex-wrap justify-center gap-4 mt-8 mb-10">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col items-center w-[160px]">
          <BarChart3 className="w-8 h-8 text-[#10b981] mb-3" />
          <span className="text-white font-bold text-lg">Expected Goals</span>
          <span className="text-white/40 text-xs text-center mt-1">Analyse des zones de danger</span>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col items-center w-[160px]">
          <Activity className="w-8 h-8 text-[#10b981] mb-3" />
          <span className="text-white font-bold text-lg">Forme Dynamique</span>
          <span className="text-white/40 text-xs text-center mt-1">Séries de victoires pondérées</span>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex flex-col items-center w-[160px]">
          <Target className="w-8 h-8 text-[#10b981] mb-3" />
          <span className="text-white font-bold text-lg">H2H Historique</span>
          <span className="text-white/40 text-xs text-center mt-1">Bêtes noires et rivalités</span>
        </div>
      </div>

      <Link href={startHref} className="showcase-cta">
        <Cpu className="w-4 h-4" /> Explorer la technologie
      </Link>
    </div>
  );
}

function FeaturesContent() {
  const { ref, visible } = useFadeIn();
  const features = [
    { icon: Brain, title: "Analyse IA avant match", desc: "Notre algorithme génère un rapport complet analysant dynamique, forces et faiblesses des deux équipes en temps réel." },
    { icon: BarChart3, title: "Statistiques avancées (xG)", desc: "Expected Goals, possession, tirs cadrés, zones de danger — toutes les métriques avancées pour comprendre le vrai niveau." },
    { icon: Target, title: "Scénarios tactiques", desc: "L'IA simule le déroulement attendu du match et mesure le poids de chaque scénario." },
    { icon: TrendingUp, title: "Analyses précises", desc: "Score exact, nombre de buts attendus, tendance offensive des deux équipes, avec un indice de confiance calculé mathématiquement à partir de données réelles." },
    { icon: Globe, title: "+15 compétitions", desc: "Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, CAN et bien d'autres couvertes." },
    { icon: Cpu, title: "Moteur temps réel", desc: "Données actualisées en permanence via API-Football. Pas de cache périmé, pas de données inventées." },
  ];

  return (
    <div ref={ref} className={`features-inner relative z-10 ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <h2 className="section-title" style={{ fontWeight: 600, fontSize: '28px', textTransform: 'none', letterSpacing: 'normal' }}>
        Anticiper chaque match <span className="text-emerald-gradient">avec l'IA.</span>
      </h2>
      <p className="section-subtitle">Tendances, statistiques avancées et scénarios tactiques pour anticiper le déroulement d'un match avant même le coup d'envoi.</p>
      <div className="features-grid">
        {features.map((f, i) => (
          <div key={i} className="feature-card">
            <div className="feature-icon">
              <f.icon className="w-6 h-6" />
            </div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorksContent() {
  const { ref, visible } = useFadeIn();
  const steps = [
    { num: "01", title: "Choisissez un match", desc: "Sélectionnez l'une des centaines de rencontres parmi les grands championnats.", icon: Eye },
    { num: "02", title: "L'IA analyse les données", desc: "L'IA croise la forme, l'historique et les xG en temps réel.", icon: Cpu },
    { num: "03", title: "Consultez l’analyse", desc: "Obtenez un rapport détaillé et les scénarios attendus du match.", icon: Target },
  ];

  return (
    <div ref={ref} className={`hiw-inner ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <h2 className="section-title">COMMENT ÇA MARCHE ?</h2>
      <p className="section-subtitle">Un processus simple, rapide et efficace en 3 étapes.</p>
      <div className="hiw-grid">
        {steps.map((s, i) => (
          <div key={i} className="hiw-card">
            <div className="hiw-num">{s.num}</div>
            <div className="hiw-icon"><s.icon className="w-7 h-7" /></div>
            <h3 className="hiw-card-title">{s.title}</h3>
            <p className="hiw-card-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * LE BANDEAU DE CHIFFRES — CHACUN VÉRIFIABLE.
 *
 * ── CE QU'IL ANNONÇAIT ────────────────────────────────────────────────────
 *
 *     500K+   MATCHS ANALYSÉS      la base en contenait 21 140
 *      98%    DONNÉES EN TEMPS RÉEL  un pourcentage de rien du tout
 *
 * Le premier était faux d'un facteur vingt-quatre. Le second ne mesurait rien :
 * « 98 % de données en temps réel » ne veut dire rien de vérifiable, et
 * personne n'aurait su dire ce qu'auraient été les 2 % restants.
 *
 * ── CE QU'ILS DISENT MAINTENANT ───────────────────────────────────────────
 *
 * Des rencontres comptées une par une, doublons retirés, et le taux de réussite
 * réel — celui qu'on peut recompter sur `/preuves`. 56 % d'issues correctes là
 * où le hasard en donne 33 : c'est plus modeste que « 500K+ » et infiniment
 * plus convaincant, parce que c'est contrôlable.
 *
 * Les valeurs de repli ne sont pas des chiffres ronds inventés : c'est le
 * relevé réel du 1er septembre 2026, servi si le serveur n'a rien pu calculer.
 */
function StatsContent({ chiffres }: { chiffres?: ChiffresPublics }) {
  const c = chiffres ?? {
    matchsAnalyses: 21140,
    matchsVerifies: 1995,
    tauxIssue: 56,
    tauxScoreExact: 14,
    competitions: 15,
  };

  const s1 = useCounter(c.matchsAnalyses, 2500);
  const s2 = useCounter(c.matchsVerifies, 1500);
  const s3 = useCounter(c.tauxIssue, 2000);
  const s4 = useCounter(c.competitions, 2200);

  return (
    <div className="stats-inner">
      <h2 className="section-title">
        CE QUE NOUS AVONS
        <br />
        <span className="text-[#10b981]">RÉELLEMENT FAIT</span>
      </h2>
      <p className="section-subtitle">
        Chaque analyse est publiée avant le coup d&apos;envoi, puis confrontée au résultat réel.
        Ces chiffres se recomptent un par un sur la page des preuves.
      </p>
      <div className="stats-grid">
        <div className="stat-card">
          {/* Les milliers sont séparés : « 21140 » se lit mal en gros, et un
              visiteur pressé y voit 2 114 ou 211 400. */}
          <span className="stat-value" ref={s1.ref}>
            {s1.count.toLocaleString("fr-FR")}
          </span>
          <span className="stat-label">Matchs analysés</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" ref={s2.ref}>
            {s2.count.toLocaleString("fr-FR")}
          </span>
          <span className="stat-label">Vérifiés après le match</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" ref={s3.ref}>{s3.count}%</span>
          <span className="stat-label">Vainqueur bien annoncé</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" ref={s4.ref}>{s4.count}</span>
          <span className="stat-label">Compétitions couvertes</span>
        </div>
      </div>
    </div>
  );
}

function AnalysisContent() {
  const startHref = useStartHref();
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} className={`analysis-inner relative z-10 ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <div className="analysis-text text-center flex flex-col items-center mt-12 md:mt-0">
        <h2 className="section-title text-center" style={{ fontWeight: 600, fontSize: '32px' }}>
          VOS MATCHS, ANTICIPÉS<br /><span className="text-gradient">PAR L'IA.</span>
        </h2>
        <p className="analysis-desc text-center">
          Plus de devinettes. Notre moteur analyse des millions de données pour anticiper l'issue de chaque rencontre.
        </p>
        <Link href={startHref} className="analysis-cta w-full md:w-auto justify-center">
          <Zap className="w-4 h-4" /> Accéder à la plateforme
        </Link>
      </div>
      <div className="analysis-phone">
        <div className="phone-frame">
          <BoutonsLateraux />
          <div className="phone-screen">
            <div className="phone-notch" />
            <BarreEtat />
            <AppMockupContent />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Barre d'état du téléphone de démonstration.
 *
 * L'heure et le niveau de batterie sont FIXES : une horloge qui avance
 * attirerait l'œil sur le décor plutôt que sur le produit, et une valeur
 * calculée à l'affichage ferait diverger le rendu du serveur et celui du
 * navigateur.
 */
function BarreEtat() {
  return (
    <div className="mockup-statusbar">
      <span className="statusbar-heure">10:30</span>

      <div className="statusbar-droite">
        {/* Réseau : quatre barres croissantes, comme sur un vrai appareil */}
        <span className="statusbar-reseau">
          <i /><i /><i /><i />
        </span>

        <Wifi className="w-[14px] h-[14px]" strokeWidth={2.6} />

        <span className="statusbar-pourcent">84</span>

        <span className="statusbar-batterie">
          <span className="statusbar-batterie-niveau" />
        </span>
      </div>
    </div>
  );
}

/** Boutons physiques sur les tranches : volume et silencieux à gauche, veille à droite. */
function BoutonsLateraux() {
  return (
    <>
      <span className="phone-btn phone-btn-silent" />
      <span className="phone-btn phone-btn-vol-up" />
      <span className="phone-btn phone-btn-vol-down" />
      <span className="phone-btn phone-btn-power" />
    </>
  );
}

// Reusable App Mockup Content
function AppMockupContent() {
  const dateProche = useDateProche(1);
  const datePlusLoin = useDateProche(6);
  return (
    <div className="flex-1 bg-[#16242e] p-5 pt-8 flex flex-col font-sans relative overflow-hidden">
      {/* Phone Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
            <Image src="/logo.png" alt="ProFoot" width={24} height={24} className="w-full h-full object-cover scale-[1.35]" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">ProFoot</span>
        </div>
        <div className="w-6 h-0.5 bg-white/20 rounded-full">
          <div className="w-6 h-0.5 bg-white/20 rounded-full mt-1.5"></div>
          <div className="w-6 h-0.5 bg-white/20 rounded-full mt-1.5"></div>
        </div>
      </div>
      
      {/* Title */}
      <div className="text-center mb-6">
        <h3 className="text-white text-xl font-bold mb-1">Analyse de match</h3>
        <p className="text-[10px] text-white/60">Entre les équipes que tu veux analyser</p>
        <p className="text-[8px] text-white/40 mt-1">Notre IA est connectée à l'actualité foot et croise des millions de données pour chaque analyse.</p>
      </div>

      {/* Match Search Card */}
      <div className="bg-[#1d2f3a] border border-white/5 hover:border-white/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] rounded-2xl p-4 mb-6 transition-all duration-300 transform hover:-translate-y-1">
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span> Match à analyser</p>
        
        {/* Team 1 */}
        <div className="flex flex-col items-center mb-2">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-[#10b981] blur-md opacity-0 group-hover:opacity-40 transition-opacity"></div>
            <img src="https://media.api-sports.io/football/teams/85.png" alt="PSG" loading="lazy" decoding="async" width={48} height={48} className="relative w-12 h-12 mb-3 transform group-hover:scale-110 transition-transform" />
          </div>
          <div className="w-full bg-[#16242e] border border-[#10b981] rounded-lg p-2.5 text-center text-white text-sm font-semibold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            Paris Saint Germain
          </div>
        </div>
        
        <div className="text-center text-white/30 text-xs font-bold my-2">VS</div>
        
        {/* Team 2 */}
        <div className="w-full bg-[#16242e] border border-white/10 hover:border-white/20 rounded-lg p-2.5 text-center text-white/50 text-sm mb-4 cursor-text transition-colors">
          Cherche une équipe (ex: Real Madrid, Bayern...)
        </div>
        
        {/* Analyze Button */}
        <div className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] text-[#101c24] text-center font-bold text-sm rounded-lg p-3 cursor-pointer hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" /> Analyser le match avec l'IA
        </div>
      </div>

      {/* Upcoming Matches */}
      <div className="bg-[#1d2f3a] border border-white/5 rounded-2xl p-4 flex-1 transition-all duration-300 hover:border-white/10">
        <p className="text-[12px] text-white/60 mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse"></span> Prochains matchs</p>
        
        <div className="space-y-3">
          {/* Match Row */}
          <div className="flex items-center justify-between bg-[#16242e] hover:bg-[#16242e] border border-white/5 hover:border-white/10 rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] group">
            <div className="text-[9px] text-white/40 leading-tight group-hover:text-white/60 transition-colors" suppressHydrationWarning>{dateProche}<br/>20:45</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-[#10b981]">Paris Saint G...</span>
              <img src="https://media.api-sports.io/football/teams/85.png" alt="" loading="lazy" decoding="async" width={12} height={12} className="w-3 h-3 group-hover:scale-110 transition-transform" />
              <span className="text-white/30 text-[8px]">VS</span>
              <img src="https://media.api-sports.io/football/teams/96.png" className="w-3 h-3 group-hover:scale-110 transition-transform" />
              <span className="text-white">Toulouse</span>
            </div>
          </div>
          {/* Match Row */}
          <div className="flex items-center justify-between bg-[#16242e] hover:bg-[#16242e] border border-white/5 hover:border-white/10 rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] group">
            <div className="text-[9px] text-white/40 leading-tight group-hover:text-white/60 transition-colors" suppressHydrationWarning>{datePlusLoin}<br/>21:00</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-[#10b981]">Paris Saint G...</span>
              <img src="https://media.api-sports.io/football/teams/85.png" alt="" loading="lazy" decoding="async" width={12} height={12} className="w-3 h-3 group-hover:scale-110 transition-transform" />
              <span className="text-white/30 text-[8px]">VS</span>
              <img src="https://media.api-sports.io/football/teams/40.png" className="w-3 h-3 group-hover:scale-110 transition-transform" />
              <span className="text-white">Liverpool</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
