import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Credenciais lidas de variáveis de ambiente (VITE_*). Isso permite rotação
// sem redeploy e não deixa chaves hardcoded no bundle. Se por algum motivo
// o build não injetar a env, caímos para os valores públicos (anon é
// publishable) para evitar quebra durante deploy transitório.
const SUPABASE_URL =
  (import.meta.env.VITE_CUSTOM_SUPABASE_URL as string | undefined) ??
  "https://tckhsajvekpnfqtsstlx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_CUSTOM_SUPABASE_ANON_KEY as string | undefined) ??
  "";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
