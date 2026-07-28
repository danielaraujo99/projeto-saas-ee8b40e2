import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Credenciais lidas exclusivamente de variáveis de ambiente (VITE_*). Sem
// fallback hardcoded — qualquer rotação de chave passa a ser efetiva sem
// redeploy de código e nenhuma URL/key fica no bundle.
const SUPABASE_URL = import.meta.env.VITE_CUSTOM_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_CUSTOM_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[custom-supabase] VITE_CUSTOM_SUPABASE_URL/ANON_KEY ausentes.");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
