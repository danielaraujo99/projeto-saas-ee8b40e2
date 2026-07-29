import { Star, Clock, Bike, MapPin } from "lucide-react";
import { useRestaurant } from "@/components/menu-context";
import { brl } from "@/lib/format";

export function RestaurantHeader() {
  const r = useRestaurant();
  if (!r) return null;
  const hasRating = r.rating > 0;
  const hasFee = r.deliveryFee > 0;
  const [minMin, maxMin] = r.deliveryMinutes;
  const hasEta = maxMin > 0;
  const hasDistance = r.distanceKm > 0;

  return (
    <header className="relative pb-2">
      <div className="relative h-36 w-full overflow-hidden bg-muted sm:h-56 lg:h-64">
        {r.cover ? (
          <img src={r.cover} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/10 to-background" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative -mt-5 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:-mt-10 sm:p-6">
          <div className="flex items-center gap-3.5 sm:gap-5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-card)] sm:h-20 sm:w-20 sm:rounded-2xl">
              {r.logo ? (
                <img src={r.logo} alt={r.name} className="h-full w-full object-cover" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex min-w-0 items-start justify-between gap-2.5">
                <h1 className="min-w-0 truncate text-xl font-bold leading-tight text-foreground sm:text-2xl">
                  {r.name}
                </h1>
                <StatusPill open={r.isOpen} />
              </div>
              {r.categoriesLabel ? (
                <p className="mt-1.5 truncate text-sm font-medium text-muted-foreground">
                  {r.categoriesLabel}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3.5 rounded-2xl border border-border bg-surface px-4 py-3.5 sm:mt-5">
            <StatCell
              icon={<Star className="h-4 w-4 fill-warning text-warning" strokeWidth={2} />}
              value={hasRating ? r.rating.toFixed(1) : "—"}
              label={hasRating ? "avaliação" : "sem avaliações"}
            />
            <StatCell
              icon={<Clock className="h-4 w-4 text-foreground/55" strokeWidth={2} />}
              value={hasEta ? `${minMin}–${maxMin}` : "—"}
              label="minutos"
            />
            <StatCell
              icon={<Bike className="h-4 w-4 text-foreground/55" strokeWidth={2} />}
              value={hasFee ? brl(r.deliveryFee) : "Grátis"}
              label="entrega"
            />
            <StatCell
              icon={<MapPin className="h-4 w-4 text-foreground/55" strokeWidth={2} />}
              value={hasDistance ? `${r.distanceKm.toFixed(1)} km` : "—"}
              label="distância"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function StatusPill({ open }: { open: boolean }) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none " +
        (open ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")
      }
    >
      <span className={(open ? "bg-success" : "bg-muted-foreground") + " h-1.5 w-1.5 rounded-full"} />
      {open ? "Aberto" : "Fechado"}
    </span>
  );
}

function StatCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0">{icon}</span>
      <span className="whitespace-nowrap text-[15px] font-bold tabular-nums leading-none text-foreground">
        {value}
      </span>
      <span className="truncate text-xs font-medium leading-none text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
