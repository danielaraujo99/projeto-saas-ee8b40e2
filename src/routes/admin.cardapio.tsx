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
import { Plus, Tag, UtensilsCrossed, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAdminSession } from "@/lib/admin/session";
import {
  listCategories, listProducts, createCategory, updateCategory, deleteCategory,
  createProduct, updateProduct, deleteProduct, type Category, type Product,
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

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState<number>(0);
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [featured, setFeatured] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setPrice(initial?.price ?? 0);
    setCategoryId(initial?.category_id ?? "");
    setImageUrl(initial?.image_url ?? "");
    setActive(initial?.active ?? true);
    setFeatured(initial?.featured ?? false);
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome");
      if (price < 0) throw new Error("Preço inválido");
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price,
        category_id: categoryId || null,
        image_url: imageUrl.trim() || null,
        active,
        featured,
      };
      if (isNew) {
        await createProduct({ restaurant_id: restaurantId, ...payload });
      } else if (initial) {
        await updateProduct(initial.id, payload);
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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isNew ? "Novo produto" : "Editar produto"}</SheetTitle>
          <SheetDescription>Preencha os dados exibidos no cardápio.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
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
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            <span>URL da imagem</span>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </label>
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
