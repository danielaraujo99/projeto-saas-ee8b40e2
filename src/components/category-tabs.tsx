import * as React from "react";
import { useMenu } from "@/components/menu-context";
import { cn } from "@/lib/utils";

type Props = {
  activeId: string;
  onSelect: (id: string) => void;
};

export function CategoryTabs({ activeId, onSelect }: Props) {
  const { categories } = useMenu();
  const scroller = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [activeId]);

  return (
    <div
      ref={scroller}
      className="scrollbar-none relative flex gap-1 overflow-x-auto px-4 py-1 sm:px-6"
      style={{ scrollbarWidth: "none" }}
    >
      {categories.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            data-cat={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary-soft text-primary"
                : "text-foreground/55 hover:bg-surface hover:text-foreground",
            )}
          >
            <span className="relative z-10">{c.name}</span>
            {active ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
