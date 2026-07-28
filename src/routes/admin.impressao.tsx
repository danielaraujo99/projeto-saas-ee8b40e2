import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAdminSession } from "@/lib/admin/session";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Printer, Zap, FileText, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRINT,
  buildReceiptHtml,
  loadPrintSettings,
  savePrintSettings,
  printHtml,
  type PrintSettings,
} from "@/lib/admin/printing";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/impressao")({
  head: () => ({
    meta: [
      { title: "Impressão — Painel" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: ImpressaoPage,
});

const SAMPLE_ORDER = {
  short_id: "PED123456",
  items: [
    {
      name: "X-Burger Duplo Especial",
      qty: 2,
      price: 32,
      addOns: [
        { name: "Bacon extra", price: 4 },
        { name: "Queijo cheddar", price: 3 },
      ],
      notes: "Sem cebola, ponto da carne bem passado",
    },
    { name: "Batata frita grande", qty: 1, price: 18 },
    { name: "Coca-Cola 350ml", qty: 2, price: 8 },
    {
      name: "Milkshake de morango",
      qty: 1,
      price: 15,
      addOns: [{ name: "Chantilly", price: 2 }],
    },
  ],
  subtotal: 96,
  delivery_fee: 8,
  total: 104,
  payment: "PIX",
  customer_name: "Maria Silva",
  customer_phone: "(11) 98765-4321",
  address: {
    street: "Rua das Flores",
    number: "123",
    district: "Centro",
    complement: "Ap 42, Bloco B",
    recipient: "Maria Silva",
  },
  pickup: false,
};

function ImpressaoPage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const [cfg, setCfg] = React.useState<PrintSettings>(DEFAULT_PRINT);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!rid) return;
    loadPrintSettings(rid)
      .then((s) => setCfg(s))
      .finally(() => setLoaded(true));
  }, [rid]);

  async function save() {
    if (!rid) return;
    setSaving(true);
    try {
      await savePrintSettings(rid, cfg);
      toast.success("Preferências de impressão salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function testPrint(variant: "kitchen" | "delivery") {
    printHtml(buildReceiptHtml({ order: SAMPLE_ORDER, variant, settings: cfg }));
  }

  return (
    <AdminShell title="Impressão">
      <div className="px-4 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Impressão</h2>
            <p className="text-sm text-slate-500">
              Configure as impressoras térmicas, as vias de cada pedido e o layout do cupom.
            </p>
          </div>
          <Button onClick={save} disabled={saving || !loaded}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar preferências
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Coluna esquerda */}
          <div className="space-y-4">
            <Card
              icon={<Zap className="h-4 w-4 text-primary" />}
              title="Impressão automática"
              description="Sai direto na estação da cozinha (KDS) e/ou balcão, sem intervenção."
            >
              <ToggleRow
                label="Ativar impressão automática ao receber pedidos"
                sub="Quando ligado, cada novo pedido dispara as vias marcadas abaixo."
                checked={cfg.enabled}
                onChange={(v) => setCfg({ ...cfg, enabled: v })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleRow
                  compact
                  label="Via Cozinha"
                  sub="Preparo (itens, adicionais e observações)"
                  checked={cfg.kitchen}
                  onChange={(v) => setCfg({ ...cfg, kitchen: v })}
                />
                <ToggleRow
                  compact
                  label="Via Entrega / Cliente"
                  sub="Endereço, total e QR de acompanhamento"
                  checked={cfg.delivery}
                  onChange={(v) => setCfg({ ...cfg, delivery: v })}
                />
              </div>
            </Card>

            <Card
              icon={<FileText className="h-4 w-4 text-primary" />}
              title="Layout do cupom"
              description="O que aparece na via impressa."
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <ToggleRow
                  compact
                  label="Logo do restaurante"
                  checked={cfg.show_logo}
                  onChange={(v) => setCfg({ ...cfg, show_logo: v })}
                />
                <ToggleRow
                  compact
                  label="QR Code do cliente"
                  checked={cfg.show_qr}
                  onChange={(v) => setCfg({ ...cfg, show_qr: v })}
                />
                <ToggleRow
                  compact
                  label="Valores na via da cozinha"
                  checked={cfg.show_prices_kitchen}
                  onChange={(v) => setCfg({ ...cfg, show_prices_kitchen: v })}
                />
              </div>
            </Card>

            <Card
              icon={<Settings2 className="h-4 w-4 text-primary" />}
              title="Papel e tipografia"
              description="Ajuste conforme a impressora térmica instalada."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Segment
                  label="Largura do papel"
                  value={cfg.paper}
                  options={[
                    { v: "58mm", label: "58 mm" },
                    { v: "80mm", label: "80 mm" },
                  ]}
                  onChange={(v) => setCfg({ ...cfg, paper: v as PrintSettings["paper"] })}
                />
                <Segment
                  label="Tamanho da fonte"
                  value={cfg.font}
                  options={[
                    { v: "small", label: "Pequena" },
                    { v: "medium", label: "Média" },
                    { v: "large", label: "Grande" },
                  ]}
                  onChange={(v) => setCfg({ ...cfg, font: v as PrintSettings["font"] })}
                />
              </div>
            </Card>

          </div>

          {/* Coluna direita: preview */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Pré-visualização</div>
                  <div className="text-[11px] text-slate-500">
                    Cupom em tempo real ({cfg.paper})
                  </div>
                </div>
                <Printer className="h-4 w-4 text-slate-400" />
              </div>
              <Tabs
                variants={[
                  { id: "kitchen", label: "Cozinha" },
                  { id: "delivery", label: "Entrega" },
                ]}
                cfg={cfg}
                onTest={testPrint}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Tabs({
  variants,
  cfg,
  onTest,
}: {
  variants: { id: "kitchen" | "delivery"; label: string }[];
  cfg: PrintSettings;
  onTest: (v: "kitchen" | "delivery") => void;
}) {
  const [v, setV] = React.useState<"kitchen" | "delivery">("kitchen");
  const html = React.useMemo(
    () => buildReceiptHtml({ order: SAMPLE_ORDER, variant: v, settings: cfg }),
    [v, cfg],
  );
  const width = cfg.paper === "58mm" ? 240 : 320;
  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
        {variants.map((t) => (
          <button
            key={t.id}
            onClick={() => setV(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition",
              v === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <div
          className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-lg"
          style={{ width }}
        >
          <iframe
            key={v + cfg.paper + cfg.font}
            title={v}
            srcDoc={html}
            style={{ width: "100%", height: 520, border: 0, background: "white" }}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <Button size="sm" variant="outline" onClick={() => onTest(v)}>
          <Printer className="h-4 w-4" /> Imprimir teste
        </Button>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */
function Card({
  icon,
  title,
  description,
  tone = "default",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  tone?: "default" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        tone === "info" ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white",
      )}
    >
      <div className="mb-3 flex items-start gap-2">
        <div
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
            tone === "info" ? "bg-blue-100" : "bg-primary/10",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {description ? <div className="text-xs text-slate-500">{description}</div> : null}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
  compact,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white",
        compact ? "px-3 py-2" : "px-3 py-2.5",
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Segment({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-slate-600">{label}</div>
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              value === o.v ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
