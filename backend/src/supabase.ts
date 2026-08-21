import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { config } from './config.js';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    if (!config.supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_KEY is not set');
    }
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/**
 * Verifies a client-provided Supabase JWT and returns the authenticated user,
 * or null if the token is missing/invalid.
 */
export async function getUserFromToken(authHeader: string | undefined): Promise<User | null> {
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return null;

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
