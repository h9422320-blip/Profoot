import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase "service role" — réservé aux routes serveur sans session
 * utilisateur (webhooks, réconciliation). Contourne la RLS : ne JAMAIS
 * l'importer depuis du code client.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Configuration Supabase admin manquante (URL ou SERVICE_ROLE_KEY).');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
