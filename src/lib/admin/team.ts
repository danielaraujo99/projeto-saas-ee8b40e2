import { supabase } from "@/lib/custom-supabase";
import type { AdminRole } from "./session";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb = supabase as any;

export type TeamMember = {
  user_id: string;
  role: AdminRole;
  name: string | null;
  email: string | null;
  created_at: string;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: AdminRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

/**
 * Lista membros reais do restaurante.
 * Usa a função `list_restaurant_members` (security definer) — não depende de
 * inferência de foreign key entre restaurant_members e profiles, e contorna
 * o RLS de profiles (que só permite o próprio usuário ler a própria linha).
 */
export async function listTeamMembers(restaurantId: string): Promise<TeamMember[]> {
  const { data, error } = await sb.rpc("list_restaurant_members", {
    _restaurant_id: restaurantId,
  });
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export async function listInvites(restaurantId: string): Promise<TeamInvite[]> {
  const { data, error } = await sb
    .from("restaurant_invites")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeamInvite[];
}

export async function createInvite(input: {
  restaurantId: string;
  email: string;
  role: AdminRole;
}): Promise<{ id: string; token: string; expires_at: string }> {
  const { data, error } = await sb.rpc("create_restaurant_invite", {
    _restaurant_id: input.restaurantId,
    _email: input.email,
    _role: input.role,
  });
  if (error) throw new Error(inviteErrorText(error.message));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Não foi possível criar o convite.");
  return row as { id: string; token: string; expires_at: string };
}

export async function revokeInvite(inviteId: string) {
  const { error } = await sb.rpc("revoke_restaurant_invite", { _invite_id: inviteId });
  if (error) throw new Error(inviteErrorText(error.message));
}

export async function updateMemberRole(input: {
  restaurantId: string;
  userId: string;
  role: AdminRole;
}) {
  const { error } = await sb
    .from("restaurant_members")
    .update({ role: input.role })
    .eq("restaurant_id", input.restaurantId)
    .eq("user_id", input.userId);
  if (error) throw error;
}

export async function removeMember(input: { restaurantId: string; userId: string }) {
  const { error } = await sb
    .from("restaurant_members")
    .delete()
    .eq("restaurant_id", input.restaurantId)
    .eq("user_id", input.userId);
  if (error) throw error;
}

export function inviteLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/convite/${token}`;
}

export function inviteStatus(inv: TeamInvite): "pending" | "accepted" | "revoked" | "expired" {
  if (inv.revoked_at) return "revoked";
  if (inv.accepted_at) return "accepted";
  if (new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

export function inviteErrorText(raw: string): string {
  if (/forbidden/i.test(raw)) return "Somente administradores podem convidar membros.";
  if (/invalid_email/i.test(raw)) return "E-mail inválido.";
  if (/invite_not_found/i.test(raw)) return "Convite não encontrado.";
  if (/invite_revoked/i.test(raw)) return "Este convite foi cancelado.";
  if (/invite_already_used/i.test(raw)) return "Este convite já foi utilizado.";
  if (/invite_expired/i.test(raw)) return "Este convite expirou.";
  if (/invite_email_mismatch/i.test(raw))
    return "Este convite é para outro e-mail. Entre com o e-mail convidado.";
  if (/not_authenticated/i.test(raw)) return "Entre na sua conta para continuar.";
  if (/does not exist|schema cache/i.test(raw))
    return "Estrutura de convites ausente no banco. Execute o SQL equipe-pdv.sql.";
  return raw || "Não foi possível concluir a operação.";
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  admin: "Admin",
  caixa: "Caixa",
  cozinha: "Cozinha",
};
