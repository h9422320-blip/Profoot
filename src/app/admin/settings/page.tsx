import { lireReglages } from "@/lib/app-settings";
import { getAdminMetrics, resoudrePeriode } from "@/lib/admin-metrics";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  const [reglages, m] = await Promise.all([
    lireReglages(),
    getAdminMetrics(resoudrePeriode({ periode: "30j" })),
  ]);

  // État réel des services dont dépend l'application. Chaque ligne est déduite
  // de la présence effective d'une configuration ou de données, jamais d'une
  // valeur écrite en dur.
  const services = [
    {
      nom: "Base de données Supabase",
      actif: true,
      detail: `${m.utilisateurs.total} comptes, ${m.analyses.total} analyses`,
    },
    {
      nom: "Paiements Chariow",
      actif: !!process.env.CHARIOW_API_KEY,
      detail: process.env.CHARIOW_API_KEY
        ? `${m.paiements.length} événements reçus`
        : "Clé API absente",
    },
    {
      nom: "Produits Chariow (3 offres)",
      actif: !!(
        process.env.CHARIOW_PRODUCT_ID_ESSENTIAL &&
        (process.env.CHARIOW_PRODUCT_ID_PRO || process.env.CHARIOW_PRODUCT_ID_MONTHLY) &&
        (process.env.CHARIOW_PRODUCT_ID_VIP || process.env.CHARIOW_PRODUCT_ID_YEARLY)
      ),
      detail: "Essentiel, Pro et VIP Annuel",
    },
    {
      nom: "Signature des webhooks",
      actif: !!process.env.CHARIOW_WEBHOOK_SECRET,
      detail: process.env.CHARIOW_WEBHOOK_SECRET
        ? "Les notifications de paiement sont vérifiées"
        : "Secret absent : les notifications ne sont pas vérifiées",
    },
    {
      nom: "Intelligence artificielle Gemini",
      actif: !!process.env.GEMINI_API_KEY,
      detail: process.env.GEMINI_API_KEY ? "Clé configurée" : "Clé absente",
    },
    {
      nom: "Données football (API-Football)",
      actif: !!process.env.API_FOOTBALL_KEY,
      detail: process.env.API_FOOTBALL_KEY ? "Clé configurée" : "Clé absente",
    },
    {
      nom: "Lien d'accès personnel à l'administration",
      actif: !!process.env.ADMIN_ACCESS_KEY,
      detail: process.env.ADMIN_ACCESS_KEY
        ? "Double verrou actif"
        : "Non configuré : seul le contrôle par e-mail s'applique",
    },
  ];

  return <SettingsClient reglages={reglages} services={services} />;
}
