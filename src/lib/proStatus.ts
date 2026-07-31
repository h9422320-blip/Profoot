// ============================================================================
// Statut Premium avec cache navigateur (sessionStorage, TTL 5 min)
// Évite de rappeler /api/payments/moneroo/status à CHAQUE navigation :
// la première page paie l'appel réseau, les suivantes lisent le cache local.
// ============================================================================

const CACHE_KEY = "profoot_pro_status_v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface ProStatus {
  isPro: boolean;
  plan?: string | null;
  expiresAt?: string | null;
  vip?: boolean;
}

export async function fetchProStatus(): Promise<ProStatus> {
  // 1. Lecture du cache local (instantané)
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data as ProStatus;
      }
    }
  } catch {}

  // 2. Appel réseau (une seule fois par période de 5 min)
  try {
    const res = await fetch("/api/payments/moneroo/status");
    const data = await res.json();
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
    return data as ProStatus;
  } catch {
    return { isPro: false };
  }
}

/** À appeler après un paiement ou une déconnexion pour forcer le rafraîchissement. */
export function invalidateProStatus() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}
