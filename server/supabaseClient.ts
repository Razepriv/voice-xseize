import { createClient, type User, type Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || serviceRoleKey;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL must be set");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set");
}

// Admin client with full privileges for user management
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Auth client with restricted permissions for authentication
export const supabaseAuthClient = createClient(supabaseUrl, anonKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    flowType: 'pkce', // Use PKCE flow for enhanced security
  },
});

export type SupabaseUser = User;
export type SupabaseSession = Session;




