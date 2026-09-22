import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import UsedItemCard from "../components/UsedItemCard";
import { usedItemCategories } from "../data/usedItems";
import { useListings } from "../store/ListingsStore";

export default function UsedItems() {
  const { usedItems } = useListings();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeCategory = params.get("category") ?? "";

  const filtered = useMemo(() => {
    if (!activeCategory) return usedItems;
    return usedItems.filter((item) => item.category === activeCategory);
  }, [activeCategory, usedItems]);

  function setCategory(cat: string) {
    const next = new URLSearchParams(params);
    if (cat) next.set("category", cat);
    else next.delete("category");
    setParams(next);
    setFiltersOpen(false);
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">Used Products Marketplace</h1>
          <p className="text-sm text-ink-soft mt-1">Buy and sell used products directly with people near you</p>
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="lg:hidden btn-secondary !py-2 !px-3 text-xs flex-shrink-0"
        >
          <SlidersHorizontal size={14} /> Filter
        </button>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6 mt-6">
        <aside className="hidden lg:block">
          <CategoryFilter active={activeCategory} onSelect={setCategory} />
        </aside>

        <div>
          <p className="text-sm text-ink-soft mb-4">{filtered.length} items found</p>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-ink-soft text-sm">No items in this category yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map((item) => (
                <UsedItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Category</h3>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <CategoryFilter active={activeCategory} onSelect={setCategory} />
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryFilter({ active, onSelect }: { active: string; onSelect: (c: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => onSelect("")}
        className={`text-left text-sm px-3 py-2 rounded-lg ${!active ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-soft hover:bg-surface-alt"}`}
      >
        All Categories
      </button>
      {usedItemCategories.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={`text-left text-sm px-3 py-2 rounded-lg ${active === c ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-soft hover:bg-surface-alt"}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
