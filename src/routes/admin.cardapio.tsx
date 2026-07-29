import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Tag, UtensilsCrossed, Pencil, Trash2, Search, GripVertical, ArrowUp, ArrowDown, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAdminSession } from "@/lib/admin/session";
import {
  listCategories, listProducts, createCategory, updateCategory, deleteCategory,
  createProduct, updateProduct, deleteProduct, type Category, type Product,
  listOptionGroupsForProduct, saveProductOptionGroups, uploadProductImage,
  type OptionGroupDraft,
} from "@/lib/admin/menu";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAdminRole } from "@/lib/admin/role-guard";

export const Route = createFileRoute("/admin/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio — MenuAltas" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => requireAdminRole(["admin"]),
  component: CardapioPage,
});

function CardapioPage() {
  const { data: session } = useAdminSession();
  const rid = session?.restaurantId;
  const qc = useQueryClient();

  const catsQ = useQuery({
    queryKey: ["menu-categories", rid],
    queryFn: () => listCategories(rid!),
    enabled: !!rid,
  });
  const prodsQ = useQuery({
    queryKey: ["menu-products", rid],
    queryFn: () => listProducts(rid!),
    enabled: !!rid,
  });

  const [openCat, setOpenCat] = React.useState<Category | "new" | null>(null);
  const [openProd, setOpenProd] = React.useState<Product | "new" | null>(null);
  const [filterCat, setFilterCat] = React.useState<string>("all");
  const [q, setQ] = React.useState("");

  const cats = catsQ.data ?? [];
  const prods = (prodsQ.data ?? []).filter((p) => {
    if (filterCat !== "all" && p.category_id !== filterCat) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AdminShell title="Cardápio">
      <div className="px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cardápio</h2>
            <p className="text-sm text-slate-500">Gerencie categorias e produtos.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenCat("new")}>
              <Tag className="h-4 w-4" /> Nova categoria
            </Button>
            <Button onClick={() => setOpenProd("new")}>
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          </div>
        </div>

        {/* Categorias */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Categorias</div>
            <div className="text-xs text-slate-500">{cats.length} cadastradas</div>
          </div>
          {cats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Nenhuma categoria. Crie uma para começar.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenCat(c)}
                    className={cn(
                      "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      c.active
                        ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        : "border-slate-200 bg-slate-100 text-slate-400",
                    )}
                  >
                    <Tag className="h-3 w-3" />
                    {c.name}
                    <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Filtros de produto */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar produto…"
              className="pl-8"
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Produtos */}
        <section className="mt-4">
          {prodsQ.isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              Carregando…
            </div>
          ) : prods.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-800">Nenhum produto cadastrado</div>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Adicione produtos para começar a receber pedidos.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {prods.map((p) => {
                const cat = cats.find((c) => c.id === p.category_id);
                return (
                  <li
                    key={p.id}
                    className="group flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="h-24 w-24 shrink-0 bg-slate-100">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-slate-300">
                          <UtensilsCrossed className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setOpenProd(p)}
                      className="flex min-w-0 flex-1 flex-col p-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                          {cat && (
                            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              {cat.name}
                            </div>
                          )}
                        </div>
                        {!p.active && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            Inativo
                          </span>
                        )}
                      </div>
                      <div className="mt-auto flex items-end justify-between pt-2">
                        <span className="text-base font-bold tabular-nums text-blue-600">{brl(p.price)}</span>
                        <Pencil className="h-4 w-4 text-slate-300 transition group-hover:text-blue-500" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <CategorySheet
        open={openCat !== null}
        value={openCat}
        onClose={() => setOpenCat(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["menu-categories", rid] })}
        restaurantId={rid ?? ""}
      />
      <ProductSheet
        open={openProd !== null}
        value={openProd}
        categories={cats}
        onClose={() => setOpenProd(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["menu-products", rid] })}
        restaurantId={rid ?? ""}
      />
    </AdminShell>
  );
}

/* ------------------- Category Sheet ------------------- */
function CategorySheet({
  open, value, onClose, onSaved, restaurantId,
}: {
  open: boolean;
  value: Category | "new" | null;
  onClose: () => void;
  onSaved: () => void;
  restaurantId: string;
}) {
  const isNew = value === "new";
  const initial = isNew ? null : (value as Category | null);
  const [name, setName] = React.useState("");
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setActive(initial?.active ?? true);
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome");
      if (isNew) {
        await createCategory({ restaurant_id: restaurantId, name: name.trim() });
      } else if (initial) {
        await updateCategory(initial.id, { name: name.trim(), active });
      }
    },
    onSuccess: () => { onSaved(); toast.success("Categoria salva"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => { if (initial) await deleteCategory(initial.id); },
    onSuccess: () => { onSaved(); toast.success("Categoria removida"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isNew ? "Nova categoria" : "Editar categoria"}</SheetTitle>
          <SheetDescription>Organize seus produtos por grupos.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>Nome</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Hamburguers" />
          </label>
          {!isNew && (
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-800">Categoria ativa</div>
                <div className="text-[11px] text-slate-500">Se desligar, ela some do cardápio.</div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-between gap-2">
          {!isNew ? (
            <Button variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 text-red-500" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------- Product Sheet ------------------- */
function ProductSheet({
  open, value, categories, onClose, onSaved, restaurantId,
}: {
  open: boolean;
  value: Product | "new" | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  restaurantId: string;
}) {
  const isNew = value === "new";
  const initial = isNew ? null : (value as Product | null);

  const [tab, setTab] = React.useState<"basic" | "options">("basic");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState<number>(0);
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [featured, setFeatured] = React.useState(false);
  const [groups, setGroups] = React.useState<OptionGroupDraft[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setTab("basic");
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setPrice(initial?.price ?? 0);
    setCategoryId(initial?.category_id ?? "");
    setImageUrl(initial?.image_url ?? "");
    setActive(initial?.active ?? true);
    setFeatured(initial?.featured ?? false);
    setUploadError(null);
    setGroups([]);
    if (initial?.id) {
      listOptionGroupsForProduct(initial.id)
        .then((gs) =>
          setGroups(
            gs.map((g, i) => ({
              id: g.id,
              name: g.name,
              min_select: g.min_select,
              max_select: g.max_select,
              required: g.required,
              sort_order: i,
              options: g.options.map((o, j) => ({
                id: o.id,
                name: o.name,
                price_delta: Number(o.price_delta) || 0,
                sort_order: j,
              })),
            })),
          ),
        )
        .catch((e) => toast.error(e.message ?? "Erro ao carregar opções"));
    }
  }, [open, initial]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(restaurantId, file);
      setImageUrl(url);
      toast.success("Imagem enviada");
    } catch (e: any) {
      const msg = e?.message ?? "Falha no upload da imagem";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome");
      if (price < 0) throw new Error("Preço inválido");
      if (!categoryId) {
        throw new Error(
          categories.length === 0
            ? "Crie uma categoria antes de cadastrar produtos."
            : "Selecione uma categoria para o produto.",
        );
      }
      // valida grupos
      for (const g of groups) {
        if (!g.name.trim()) throw new Error("Todo grupo precisa de nome");
        if (g.min_select > g.max_select) throw new Error(`Grupo "${g.name}": mínimo maior que o máximo`);
        if (g.max_select < 1) throw new Error(`Grupo "${g.name}": máximo deve ser ≥ 1`);
        if (g.options.length === 0) throw new Error(`Grupo "${g.name}": adicione ao menos uma opção`);
        for (const o of g.options) {
          if (!o.name.trim()) throw new Error(`Grupo "${g.name}": todas as opções precisam de nome`);
          if (o.price_delta < 0) throw new Error(`Grupo "${g.name}": preço adicional inválido`);
        }
      }
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price,
        category_id: categoryId,
        image_url: imageUrl.trim() || null,
        active,
        featured,
      };
      let productId = initial?.id;
      if (isNew) {
        productId = await createProduct({ restaurant_id: restaurantId, ...payload });
      } else if (initial) {
        await updateProduct(initial.id, payload);
      }
      if (productId) {
        const normalized = groups.map((g, i) => ({
          ...g,
          sort_order: i,
          options: g.options.map((o, j) => ({ ...o, sort_order: j })),
        }));
        await saveProductOptionGroups(restaurantId, productId, normalized);
      }
    },
    onSuccess: () => { onSaved(); toast.success("Produto salvo"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => { if (initial) await deleteProduct(initial.id); },
    onSuccess: () => { onSaved(); toast.success("Produto removido"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Helpers de manipulação dos grupos/opções
  const addGroup = () =>
    setGroups((g) => [
      ...g,
      {
        name: "",
        min_select: 0,
        max_select: 1,
        required: false,
        sort_order: g.length,
        options: [],
      },
    ]);
  const updateGroup = (i: number, patch: Partial<OptionGroupDraft>) =>
    setGroups((g) => g.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeGroup = (i: number) => setGroups((g) => g.filter((_, idx) => idx !== i));
  const moveGroup = (i: number, dir: -1 | 1) =>
    setGroups((g) => {
      const j = i + dir;
      if (j < 0 || j >= g.length) return g;
      const c = [...g];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const addOption = (gi: number) =>
    updateGroup(gi, {
      options: [
        ...groups[gi].options,
        { name: "", price_delta: 0, sort_order: groups[gi].options.length },
      ],
    });
  const updateOption = (
    gi: number,
    oi: number,
    patch: Partial<OptionGroupDraft["options"][number]>,
  ) =>
    updateGroup(gi, {
      options: groups[gi].options.map((o, k) => (k === oi ? { ...o, ...patch } : o)),
    });
  const removeOption = (gi: number, oi: number) =>
    updateGroup(gi, { options: groups[gi].options.filter((_, k) => k !== oi) });
  const moveOption = (gi: number, oi: number, dir: -1 | 1) => {
    const j = oi + dir;
    const opts = groups[gi].options;
    if (j < 0 || j >= opts.length) return;
    const c = [...opts];
    [c[oi], c[j]] = [c[j], c[oi]];
    updateGroup(gi, { options: c });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b border-slate-200 px-6 pb-3 pt-6">
          <SheetHeader>
            <SheetTitle>{isNew ? "Novo produto" : "Editar produto"}</SheetTitle>
            <SheetDescription>Preencha os dados exibidos no cardápio.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("basic")}
              className={cn(
                "rounded-md px-3 py-1.5 transition",
                tab === "basic" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
              )}
            >
              Dados básicos
            </button>
            <button
              type="button"
              onClick={() => setTab("options")}
              className={cn(
                "rounded-md px-3 py-1.5 transition",
                tab === "options" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
              )}
            >
              Opções e Adicionais
              {groups.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 text-[10px] text-blue-700">
                  {groups.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "basic" ? (
            <div className="space-y-3">
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                <span>Nome</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: X-Burger" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                <span>Descrição</span>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  <span>Preço (R$)</span>
                  <Input type="number" step="0.10" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  <span>Categoria</span>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              {/* Upload de imagem */}
              <div className="grid gap-2 text-xs font-medium text-slate-600">
                <span>Imagem do produto</span>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="Prévia" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-slate-300">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…</>
                        ) : (
                          <><Upload className="h-3.5 w-3.5" /> {imageUrl ? "Trocar imagem" : "Enviar imagem"}</>
                        )}
                      </Button>
                      {imageUrl && !uploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setImageUrl("")}
                        >
                          <X className="h-3.5 w-3.5" /> Remover
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      JPG, PNG ou WEBP • até 5 MB
                    </p>
                    {uploadError && (
                      <p className="mt-1 text-[11px] font-medium text-red-600">
                        {uploadError}{" "}
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="underline"
                        >
                          Tentar novamente
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">Ativo</div>
                  <Switch checked={active} onCheckedChange={setActive} />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">Destaque</div>
                  <Switch checked={featured} onCheckedChange={setFeatured} />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50/60 p-3 text-xs text-blue-800">
                Configure grupos como "Ponto da carne" ou "Adicionais". Cada grupo tem opções
                e regras de quantas o cliente pode escolher.
              </div>

              {groups.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Nenhum grupo. Adicione o primeiro para permitir personalização.
                </div>
              )}

              {groups.map((g, gi) => {
                const isSingle = g.max_select === 1;
                return (
                  <div key={gi} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-2 h-4 w-4 shrink-0 text-slate-300" />
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            className="h-9 flex-1 min-w-40"
                            placeholder="Nome do grupo (ex.: Adicionais)"
                            value={g.name}
                            onChange={(e) => updateGroup(gi, { name: e.target.value })}
                          />
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => moveGroup(gi, -1)} disabled={gi === 0}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => moveGroup(gi, 1)} disabled={gi === groups.length - 1}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(gi)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="grid gap-1 text-[11px] font-medium text-slate-500">
                            <span>Tipo</span>
                            <Select
                              value={isSingle ? "single" : "multi"}
                              onValueChange={(v) =>
                                updateGroup(gi, v === "single"
                                  ? { max_select: 1, min_select: g.required ? 1 : 0 }
                                  : { max_select: Math.max(2, g.max_select) })
                              }
                            >
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single">Única</SelectItem>
                                <SelectItem value="multi">Múltipla</SelectItem>
                              </SelectContent>
                            </Select>
                          </label>
                          <label className="grid gap-1 text-[11px] font-medium text-slate-500">
                            <span>Obrigatório</span>
                            <div className="flex h-8 items-center">
                              <Switch
                                checked={g.required}
                                onCheckedChange={(v) =>
                                  updateGroup(gi, { required: v, min_select: v ? Math.max(1, g.min_select) : 0 })
                                }
                              />
                            </div>
                          </label>
                          {!isSingle && (
                            <>
                              <label className="grid gap-1 text-[11px] font-medium text-slate-500">
                                <span>Mínimo</span>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-8"
                                  value={g.min_select}
                                  onChange={(e) => updateGroup(gi, { min_select: Math.max(0, Number(e.target.value) || 0) })}
                                />
                              </label>
                              <label className="grid gap-1 text-[11px] font-medium text-slate-500">
                                <span>Máximo</span>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-8"
                                  value={g.max_select}
                                  onChange={(e) => updateGroup(gi, { max_select: Math.max(1, Number(e.target.value) || 1) })}
                                />
                              </label>
                            </>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {g.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <Input
                                className="h-8 flex-1"
                                placeholder="Nome da opção"
                                value={opt.name}
                                onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-slate-400">+R$</span>
                                <Input
                                  type="number"
                                  step="0.10"
                                  min={0}
                                  className="h-8 w-20"
                                  value={opt.price_delta}
                                  onChange={(e) => updateOption(gi, oi, { price_delta: Math.max(0, Number(e.target.value) || 0) })}
                                />
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => moveOption(gi, oi, -1)} disabled={oi === 0}>
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => moveOption(gi, oi, 1)} disabled={oi === g.options.length - 1}>
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(gi, oi)}>
                                <X className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={() => addOption(gi)}>
                            <Plus className="h-3.5 w-3.5" /> Adicionar opção
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="outline" onClick={addGroup} className="w-full">
                <Plus className="h-4 w-4" /> Adicionar grupo
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
          {!isNew ? (
            <Button variant="ghost" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 className="h-4 w-4 text-red-500" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || uploading}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : "Salvar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
