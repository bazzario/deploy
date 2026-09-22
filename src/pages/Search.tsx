import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SearchX } from "lucide-react";
import ProductCard from "../components/ProductCard";
import UsedItemCard from "../components/UsedItemCard";
import AutomobileCard from "../components/AutomobileCard";
import { useListings } from "../store/ListingsStore";

type Tab = "all" | "products" | "used" | "automobiles";

function matches(haystack: Array<string | number | undefined>, terms: string[]) {
  const text = haystack
    .filter((v) => v !== undefined && v !== null)
    .join(" ")
    .toLowerCase();
  return terms.every((term) => text.includes(term));
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const tab = (params.get("tab") as Tab) || "all";
  const { products, usedItems, automobiles } = useListings();

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const results = useMemo(() => {
    if (terms.length === 0) {
      return { products: [], usedItems: [], automobiles: [] };
    }
    return {
      products: products.filter((p) =>
        matches([p.title, p.brand, p.category, p.badge], terms)
      ),
      usedItems: usedItems.filter((u) =>
        matches([u.title, u.category, u.location, u.condition, u.description, u.seller], terms)
      ),
      automobiles: automobiles.filter((a) =>
        matches(
          [a.make, a.model, a.year, a.type, a.fuel, a.transmission, a.location, a.condition, a.seller],
          terms
        )
      ),
    };
  }, [terms, products, usedItems, automobiles]);

  const total =
    results.products.length + results.usedItems.length + results.automobiles.length;

  function setTab(next: Tab) {
    const params2 = new URLSearchParams(params);
    if (next === "all") params2.delete("tab");
    else params2.set("tab", next);
    setParams(params2);
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    { id: "products", label: "Products", count: results.products.length },
    { id: "used", label: "Used Products", count: results.usedItems.length },
    { id: "automobiles", label: "Automobiles", count: results.automobiles.length },
  ];

  if (!query) {
    return (
      <div className="container-page py-16 text-center">
        <SearchX size={40} className="mx-auto text-ink-soft" />
        <h1 className="font-display font-bold text-xl text-ink mt-4">What are you looking for?</h1>
        <p className="text-sm text-ink-soft mt-1.5">
          Use the search bar above to find a product, brand, car, or used product by name.
        </p>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-ink">
        Results for "{query}"
      </h1>
      <p className="text-sm text-ink-soft mt-1">
        {total} result{total === 1 ? "" : "s"} across products, used products and automobiles.
      </p>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-5 mb-6 border-b border-surface-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 flex-shrink-0 whitespace-nowrap ${
              tab === t.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {total === 0 && (
        <div className="py-12 text-center">
          <SearchX size={36} className="mx-auto text-ink-soft" />
          <p className="text-sm text-ink-soft mt-3">
            No results found for this search. Please try a different term.
          </p>
          <Link to="/products" className="btn-primary mt-5 inline-flex">Browse all products</Link>
        </div>
      )}

      {(tab === "all" || tab === "products") && results.products.length > 0 && (
        <section className="mb-9">
          <h2 className="section-title mb-4">Products ({results.products.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {results.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {(tab === "all" || tab === "used") && results.usedItems.length > 0 && (
        <section className="mb-9">
          <h2 className="section-title mb-4">Used Products ({results.usedItems.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {results.usedItems.map((u) => (
              <UsedItemCard key={u.id} item={u} />
            ))}
          </div>
        </section>
      )}

      {(tab === "all" || tab === "automobiles") && results.automobiles.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Automobiles ({results.automobiles.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {results.automobiles.map((a) => (
              <AutomobileCard key={a.id} auto={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
