"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Target,
  Zap,
  Shield,
  PlayCircle,
  CheckCircle2,
  Star,
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
} from "lucide-react";
import Image from "next/image";

// ============================================================================
// PROFOOT — LANDING PAGE PREMIUM v3.0
// Inspired by Visifoot — Dark + Emerald + Stadium aesthetic
// ============================================================================

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
    a: "ProFoot utilise un moteur de prédiction mathématique connecté en temps réel à API-Football. L'algorithme analyse la forme récente, les confrontations directes, les statistiques avancées (xG, possession, tirs cadrés) et génère un score prédictif avec un indice de confiance.",
  },
  {
    q: "Les prédictions sont-elles fiables ?",
    a: "Nos prédictions sont basées sur des données réelles et des modèles statistiques. Aucune IA n'est infaillible, mais ProFoot vous donne un avantage analytique majeur en traitant des centaines de variables que le cerveau humain ne peut pas traiter simultanément.",
  },
  {
    q: "Quelles compétitions sont couvertes ?",
    a: "ProFoot couvre plus de 15 compétitions majeures : Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, CAN, Coupe du Monde, et bien d'autres.",
  },
  {
    q: "Est-ce que ProFoot est gratuit ?",
    a: "Oui ! Vous pouvez commencer à utiliser ProFoot gratuitement avec des analyses de base. Des plans premium sont disponibles pour des analyses illimitées et des fonctionnalités avancées.",
  },
];

// Testimonials data
const testimonials = [
  { name: "Karim B.", role: "Analyste Football", text: "ProFoot a complètement changé ma façon d'analyser les matchs. Les prédictions sont incroyablement précises.", rating: 5 },
  { name: "Lucas M.", role: "Passionné de foot", text: "L'interface est magnifique et les analyses IA sont bluffantes. Je ne regarde plus un match sans consulter ProFoot.", rating: 5 },
  { name: "Sofiane A.", role: "Parieur sportif", text: "Les statistiques avancées (xG, forme récente) m'ont permis de mieux comprendre chaque rencontre. Indispensable !", rating: 5 },
  { name: "Thomas R.", role: "Coach amateur", text: "J'utilise ProFoot pour préparer mes analyses tactiques avant chaque match. Le moteur IA est impressionnant.", rating: 4 },
  { name: "Moussa D.", role: "Journaliste sportif", text: "Une plateforme qui rivalise avec les outils pros. Les scénarios tactiques sont un vrai plus pour mes articles.", rating: 5 },
  { name: "Antoine L.", role: "Data Analyst", text: "En tant que data analyst, je suis impressionné par la profondeur des données. ProFoot est un bijou technologique.", rating: 5 },
  { name: "Youssef K.", role: "Fan de Premier League", text: "Enfin une plateforme qui couvre toutes mes compétitions préférées avec des données fiables et en temps réel.", rating: 5 },
  { name: "Claire P.", role: "Étudiante en sport", text: "ProFoot m'aide énormément dans mes études. Les analyses sont claires, précises et très bien présentées.", rating: 4 },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="landing-root relative">
      <div className="ambient-lighting">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
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
            <a href="#features">Fonctionnalités</a>
            <a href="#competitions">Compétitions</a>
            <a href="#how-it-works">Comment ça marche</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="nav-actions">
            {user ? (
              <Link href="/dashboard" className="nav-login">
                Mon compte
              </Link>
            ) : (
              <Link href="/login" className="nav-login">
                Se connecter
              </Link>
            )}
            <Link href="/analyze" className="nav-cta">
              <Zap className="w-4 h-4" /> Analyser
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <span className={`hamburger-line ${mobileMenuOpen ? "open-1" : ""}`} />
            <span className={`hamburger-line ${mobileMenuOpen ? "open-2" : ""}`} />
            <span className={`hamburger-line ${mobileMenuOpen ? "open-3" : ""}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="nav-mobile-menu">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Fonctionnalités</a>
            <a href="#competitions" onClick={() => setMobileMenuOpen(false)}>Compétitions</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>Comment ça marche</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <Link href="/analyze" className="mobile-cta" onClick={() => setMobileMenuOpen(false)}>
              <Zap className="w-4 h-4" /> Commencer l'analyse
            </Link>
          </div>
        )}
      </nav>

      <main>
        {/* ================================================================ */}
        {/* HERO SECTION */}
        {/* ================================================================ */}
        <section className="hero-section">
          <div className="hero-bg">
            <img
              src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2070&auto=format&fit=crop"
              alt=""
              className="hero-bg-img"
            />
            <div className="hero-overlay" />
            <div className="hero-glow" />
          </div>

          <div className="hero-content">
            <div className="live-badge-wrapper">
              <div className="live-badge">
                <div className="live-badge-dot" />
                ProFoot 3.0 is Live ➔
              </div>
            </div>

            <h1 className="hero-title">
              PRÉDIT CHAQUE MATCH<br />
              AVANT QU'IL <span className="text-emerald-gradient">NE COMMENCE.</span>
            </h1>

            <p className="hero-subtitle">
              L'intelligence artificielle au service du football. Des millions de données analysées en temps réel pour anticiper chaque résultat avec une précision mathématique.
            </p>

            <div className="flex flex-col md:flex-row gap-4 mb-8 w-full md:w-auto px-4 md:px-0">
              <Link href="/analyze" className="hero-cta-primary w-full md:w-auto justify-center">
                Démarrer l'analyse <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Hero App Mockup (ULTRA PREMIUM) */}
            <div className="hero-app-mockup">
              <div className="hero-app-mockup-glow" />
              
              {/* Floating Logos (from screenshot) */}
              <div className="floating-logo psg-logo">
                <img src="https://media.api-sports.io/football/teams/85.png" alt="PSG" />
              </div>
              <div className="floating-logo real-logo">
                <img src="https://media.api-sports.io/football/teams/541.png" alt="Real Madrid" />
              </div>
              <div className="floating-logo barca-logo">
                <img src="https://media.api-sports.io/football/teams/529.png" alt="Barcelona" />
              </div>
              <div className="floating-logo chelsea-logo">
                <img src="https://media.api-sports.io/football/teams/49.png" alt="Chelsea" />
              </div>

              <div className="hero-app-mockup-inner">
                {/* Notch */}
                <div className="mockup-notch" />
                
                {/* App Content */}
                <div className="mockup-screen">
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
              src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2070&auto=format&fit=crop"
              alt=""
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
          <StatsContent />
        </section>

        {/* ================================================================ */}
        {/* ANALYSIS IA SECTION — App preview */}
        {/* ================================================================ */}
        <section className="analysis-section">
          <AnalysisContent />
        </section>

        {/* ================================================================ */}
        {/* TESTIMONIALS SECTION */}
        {/* ================================================================ */}
        <section className="testimonials-section">
          <TestimonialsSection />
        </section>

        {/* ================================================================ */}
        {/* FAQ SECTION */}
        {/* ================================================================ */}
        <section id="faq" className="faq-section">
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
                  {openFaq === i && (
                    <div className="faq-answer">{item.a}</div>
                  )}
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
              src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=2070&auto=format&fit=crop"
              alt=""
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
            <Link href="/analyze" className="final-cta-btn w-full md:w-auto">
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
              La plateforme d'analyse IA football la plus avancée. Prédictions, statistiques et scénarios tactiques en temps réel.
            </p>
          </div>
          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Produit</h4>
              <Link href="/analyze">Analyse IA</Link>
              <Link href="/matches">Matchs du jour</Link>
              <Link href="/standings">Classements</Link>
            </div>
            <div className="footer-col">
              <h4>Compétitions</h4>
              <span>Premier League</span>
              <span>La Liga</span>
              <span>Champions League</span>
            </div>
            <div className="footer-col">
              <h4>Légal</h4>
              <a href="#">Mentions légales</a>
              <a href="#">Confidentialité</a>
              <a href="#">CGU</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ProFoot. Tous droits réservés.</span>
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
              <img src={c.logo} alt={c.name} className="competition-logo" />
              <span className="marquee-name">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestimonialsSection() {
  const { ref, visible } = useFadeIn();
  const doubledTestimonials = [...testimonials, ...testimonials];
  return (
    <div ref={ref} className={`testimonials-inner ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <div className="section-header">
        <h2 className="section-title">CE QUE PENSENT NOS<br /><span className="text-emerald-gradient">UTILISATEURS</span></h2>
        <p className="section-subtitle">Des milliers de passionnés utilisent ProFoot pour analyser les matchs avec précision.</p>
      </div>
      <div className="testimonials-marquee-container">
        <div className="testimonials-marquee-track">
          {doubledTestimonials.map((t, i) => (
            <div key={`${t.name}-${i}`} className="testimonial-card">
              <div className="testimonial-stars">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-[#10b981] text-[#10b981]" />
                ))}
              </div>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShowcaseContent() {
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} className={`showcase-inner relative z-10 ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <div className="showcase-match-label">Le cœur du moteur ProFoot</div>
      <h2 className="showcase-title">
        UNE ARCHITECTURE IA<br/><span className="text-gradient">SANS PRÉCÉDENT</span>
      </h2>
      <p className="showcase-desc">
        Nous ne nous contentons pas de lire les cotes. Notre moteur ingère la forme récente, les xG, les compositions probables et l'historique H2H pour générer un modèle mathématique complet.
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

      <Link href="/analyze" className="showcase-cta">
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
    { icon: Target, title: "Scénarios tactiques", desc: "L'IA simule le déroulement probable du match et vous donne le pourcentage de chance de chaque scénario." },
    { icon: TrendingUp, title: "Prédictions précises", desc: "Score exact, Over/Under, BTTS avec un indice de confiance calculé mathématiquement à partir de données réelles." },
    { icon: Globe, title: "+15 compétitions", desc: "Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, CAN et bien d'autres couvertes." },
    { icon: Cpu, title: "Moteur temps réel", desc: "Données actualisées en permanence via API-Football. Pas de cache périmé, pas de données inventées." },
  ];

  return (
    <div ref={ref} className={`features-inner relative z-10 ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <h2 className="section-title" style={{ fontWeight: 600, fontSize: '28px', textTransform: 'none', letterSpacing: 'normal' }}>
        Anticiper chaque match <span className="text-emerald-gradient">avec l'IA.</span>
      </h2>
      <p className="section-subtitle">Probabilités, statistiques avancées et scénarios tactiques pour anticiper le déroulement d'un match avant même le coup d'envoi.</p>
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
    { num: "03", title: "Consultez la prédiction", desc: "Obtenez un rapport détaillé et les scénarios probables du match.", icon: Target },
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

function StatsContent() {
  const s1 = useCounter(220, 2500);
  const s2 = useCounter(15, 1500);
  const s3 = useCounter(500, 2000);
  const s4 = useCounter(98, 2200);

  return (
    <div className="stats-inner">
      <h2 className="section-title">NOUS ANALYSONS<br /><span className="text-[#10b981]">+220 SOURCES</span></h2>
      <p className="section-subtitle">
        Des millions de données football compilées à partir de plus de 220 sources pour fournir les meilleures prédictions possibles.
      </p>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value" ref={s1.ref}>+{s1.count}</span>
          <span className="stat-label">Sources de données</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" ref={s2.ref}>{s2.count}+</span>
          <span className="stat-label">Compétitions couvertes</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" ref={s3.ref}>{s3.count}K+</span>
          <span className="stat-label">Matchs analysés</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" ref={s4.ref}>{s4.count}%</span>
          <span className="stat-label">Données en temps réel</span>
        </div>
      </div>
    </div>
  );
}

function AnalysisContent() {
  const { ref, visible } = useFadeIn();
  return (
    <div ref={ref} className={`analysis-inner relative z-10 ${visible ? "fade-in-up" : "fade-hidden"}`}>
      <div className="analysis-text text-center flex flex-col items-center mt-12 md:mt-0">
        <h2 className="section-title text-center" style={{ fontWeight: 600, fontSize: '32px' }}>
          VOS MATCHS, ANTICIPÉS<br /><span className="text-gradient">PAR L'IA.</span>
        </h2>
        <p className="analysis-desc text-center">
          Plus de devinettes. Notre moteur analyse des millions de données pour prédire l'issue de chaque rencontre.
        </p>
        <Link href="/analyze" className="analysis-cta w-full md:w-auto justify-center">
          <Zap className="w-4 h-4" /> Accéder à la plateforme
        </Link>
      </div>
      <div className="analysis-phone">
        <div className="phone-frame">
          <div className="phone-notch" />
          <div className="phone-screen">
            <AppMockupContent />
            
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable App Mockup Content
function AppMockupContent() {
  return (
    <div className="flex-1 bg-[#050505] p-5 pt-8 flex flex-col font-sans relative overflow-hidden">
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
        <p className="text-[8px] text-white/40 mt-1">Notre IA est connectée à l'actualité foot et croise des millions de données pour chaque pronostic.</p>
      </div>

      {/* Match Search Card */}
      <div className="bg-[#0f171e] border border-white/5 hover:border-white/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] rounded-2xl p-4 mb-6 transition-all duration-300 transform hover:-translate-y-1">
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span> Match à analyser</p>
        
        {/* Team 1 */}
        <div className="flex flex-col items-center mb-2">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-[#10b981] blur-md opacity-0 group-hover:opacity-40 transition-opacity"></div>
            <img src="https://media.api-sports.io/football/teams/85.png" alt="PSG" className="relative w-12 h-12 mb-3 transform group-hover:scale-110 transition-transform" />
          </div>
          <div className="w-full bg-[#050505] border border-[#10b981] rounded-lg p-2.5 text-center text-white text-sm font-semibold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            Paris Saint Germain
          </div>
        </div>
        
        <div className="text-center text-white/30 text-xs font-bold my-2">VS</div>
        
        {/* Team 2 */}
        <div className="w-full bg-[#050505] border border-white/10 hover:border-white/20 rounded-lg p-2.5 text-center text-white/50 text-sm mb-4 cursor-text transition-colors">
          Cherche une équipe (ex: Real Madrid, Bayern...)
        </div>
        
        {/* Analyze Button */}
        <div className="w-full bg-gradient-to-r from-[#10b981] to-[#059669] text-[#070e13] text-center font-bold text-sm rounded-lg p-3 cursor-pointer hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" /> Analyser le match avec l'IA
        </div>
      </div>

      {/* Upcoming Matches */}
      <div className="bg-[#0f171e] border border-white/5 rounded-2xl p-4 flex-1 transition-all duration-300 hover:border-white/10">
        <p className="text-[12px] text-white/60 mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse"></span> Prochains matchs</p>
        
        <div className="space-y-3">
          {/* Match Row */}
          <div className="flex items-center justify-between bg-[#050505] hover:bg-[#0a0a0a] border border-white/5 hover:border-white/10 rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] group">
            <div className="text-[9px] text-white/40 leading-tight group-hover:text-white/60 transition-colors">03/04<br/>20:45</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-[#10b981]">Paris Saint G...</span>
              <img src="https://media.api-sports.io/football/teams/85.png" className="w-3 h-3 group-hover:scale-110 transition-transform" />
              <span className="text-white/30 text-[8px]">VS</span>
              <img src="https://media.api-sports.io/football/teams/96.png" className="w-3 h-3 group-hover:scale-110 transition-transform" />
              <span className="text-white">Toulouse</span>
            </div>
          </div>
          {/* Match Row */}
          <div className="flex items-center justify-between bg-[#050505] hover:bg-[#0a0a0a] border border-white/5 hover:border-white/10 rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] group">
            <div className="text-[9px] text-white/40 leading-tight group-hover:text-white/60 transition-colors">08/04<br/>21:00</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className="text-[#10b981]">Paris Saint G...</span>
              <img src="https://media.api-sports.io/football/teams/85.png" className="w-3 h-3 group-hover:scale-110 transition-transform" />
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
