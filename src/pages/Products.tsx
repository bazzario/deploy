import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { categories } from "../data/products";
import { useListings } from "../store/ListingsStore";

export default function Products() {
  const { products } = useListings();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeCategory = params.get("category") ?? "";
  const query = params.get("q") ?? "";
  const sort = params.get("sort") ?? "";

  const filtered = useMemo(() => {
    let list = [...products];
    if (activeCategory) list = list.filter((p) => p.category === activeCategory);
    if (query)
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.brand.toLowerCase().includes(query.toLowerCase())
      );
    if (sort === "deals") list = list.filter((p) => p.originalPrice);
    if (sort === "price-low") list.sort((a, b) => a.price - b.price);
    if (sort === "price-high") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [activeCategory, query, sort, products]);

  function setCategory(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("category", id);
    else next.delete("category");
    setParams(next);
    setFiltersOpen(false);
  }

  function setSort(val: string) {
    const next = new URLSearchParams(params);
    if (val) next.set("sort", val);
    else next.delete("sort");
    setParams(next);
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">
          {query ? `Results for "${query}"` : activeCategory
            ? categories.find((c) => c.id === activeCategory)?.name
            : "New Products"}
        </h1>
        <button
          onClick={() => setFiltersOpen(true)}
          className="lg:hidden btn-secondary !py-2 !px-3 text-xs flex-shrink-0"
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>
      <p className="text-sm text-ink-soft mb-6">{filtered.length} products found</p>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Desktop sidebar filters */}
        <aside className="hidden lg:block">
          <FilterPanel activeCategory={activeCategory} onSelect={setCategory} />
        </aside>

        <div>
          <div className="flex items-center justify-end mb-4">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-sm border border-surface-border rounded-lg px-3 py-2 bg-white text-ink outline-none focus:border-brand-400"
            >
              <option value="">Sort: Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="deals">Deals Only</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-ink-soft text-sm">
              No products match your search. Try a different keyword or category.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Filters</h3>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X size={20} />
              </button>
            </div>
            <FilterPanel activeCategory={activeCategory} onSelect={setCategory} />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  activeCategory,
  onSelect,
}: {
  activeCategory: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-ink mb-3">Category</h3>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => onSelect("")}
          className={`text-left text-sm px-3 py-2 rounded-lg ${
            !activeCategory ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-soft hover:bg-surface-alt"
          }`}
        >
          All Categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`text-left text-sm px-3 py-2 rounded-lg ${
              activeCategory === c.id
                ? "bg-brand-50 text-brand-700 font-semibold"
                : "text-ink-soft hover:bg-surface-alt"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
