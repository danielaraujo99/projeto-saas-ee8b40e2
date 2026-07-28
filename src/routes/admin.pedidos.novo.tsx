import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { NewOrderForm } from "@/components/admin/new-order-form";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/pedidos/novo")({
  head: () => ({
    meta: [
      { title: "Adicionar pedido — Painel" },
      { name: "description", content: "Registrar pedido manual." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin", "caixa"]),
  component: NewOrderPage,
});

function NewOrderPage() {
  const nav = useNavigate();
  return (
    <AdminShell title="Adicionar pedido">
      <div className="px-4 py-6 sm:px-8">
        <NewOrderForm onDone={() => nav({ to: "/admin/pedidos" })} />
      </div>
    </AdminShell>
  );
}
