import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/custom-supabase";
import type { User } from "@supabase/supabase-js";

export type AdminRole = "admin" | "caixa" | "cozinha";

export type AdminSession = {
  user: User;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: AdminRole;
  profileName: string;
};

const VALID_ROLES: readonly AdminRole[] = ["admin", "caixa", "cozinha"];

function parseRole(value: unknown): AdminRole | null {
  return typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value)
    ? (value as AdminRole)
    : null;
}

type MemberRow = {
  role: unknown;
  restaurants: { id: string; name: string; slug: string } | null;
};

async function fetchAdminSession(): Promise<AdminSession | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return null;
  const { data: member } = await supabase
    .from("restaurant_members")
    .select("role, restaurant_id, restaurants!inner(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MemberRow>();
  if (!member) return null;
  const role = parseRole(member.role);
  if (!role) return null;
  const rest = member.restaurants;
  if (!rest) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    user,
    role,
    restaurantId: rest.id,
    restaurantName: rest.name,
    restaurantSlug: rest.slug,
    profileName: profile?.name || user.email || "",
  };
}

export function useAdminSession() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-session"],
    queryFn: fetchAdminSession,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        qc.invalidateQueries({ queryKey: ["admin-session"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return query;
}
