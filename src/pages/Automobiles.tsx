import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import AutomobileCard from "../components/AutomobileCard";
import { autoMakes, autoTypes } from "../data/automobiles";
import { useListings } from "../store/ListingsStore";

const locations = ["Karachi", "Lahore", "Islamabad", "Rawalpindi"];

export default function Automobiles() {
  const { automobiles } = useListings();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeType = params.get("type") ?? "";
  const [make, setMake] = useState(params.get("make") ?? "");
  const [model, setModel] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("");

  const filtered = useMemo(() => {
    let list = [...automobiles];
    if (activeType) list = list.filter((a) => a.type === activeType);
    if (make) list = list.filter((a) => a.make === make);
    if (model) list = list.filter((a) => a.model.toLowerCase().includes(model.toLowerCase()));
    if (maxPrice) list = list.filter((a) => a.price <= Number(maxPrice));
    if (location) list = list.filter((a) => a.location.toLowerCase().includes(location.toLowerCase()));
    return list;
  }, [activeType, make, model, maxPrice, location, automobiles]);

  function setType(type: string) {
    const next = new URLSearchParams(params);
    if (type) next.set("type", type);
    else next.delete("type");
    setParams(next);
    setFiltersOpen(false);
  }

  return (
    <div>
      {/* Search hero */}
      <div className="bg-ink text-white">
        <div className="container-page py-8 sm:py-10">
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Find Your Next Automobile</h1>
          <p className="text-white/70 text-sm mt-1.5">Cars, bikes, SUVs, trucks, vans &amp; auto parts across Pakistan</p>

          <div className="bg-white rounded-xl2 p-3 sm:p-4 mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <select
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="text-sm border border-surface-border rounded-lg px-3 py-2.5 text-ink outline-none focus:border-brand-400"
            >
              <option value="">Make</option>
              {autoMakes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model"
              className="text-sm border border-surface-border rounded-lg px-3 py-2.5 text-ink outline-none focus:border-brand-400 placeholder:text-ink-soft"
            />
            <select
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="text-sm border border-surface-border rounded-lg px-3 py-2.5 text-ink outline-none focus:border-brand-400"
            >
              <option value="">Max Price</option>
              <option value="500000">Under Rs. 5 Lac</option>
              <option value="2000000">Under Rs. 20 Lac</option>
              <option value="6000000">Under Rs. 60 Lac</option>
              <option value="13000000">Under Rs. 1.3 Crore</option>
            </select>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-sm border border-surface-border rounded-lg px-3 py-2.5 text-ink outline-none focus:border-brand-400"
            >
              <option value="">Location</option>
              {locations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button className="btn-primary text-sm">
              <Search size={15} /> Search Cars
            </button>
            <Link to="/sell" className="btn-secondary !bg-transparent !text-white !border-white/30 hover:!border-white text-sm">
              Sell Your Vehicle
            </Link>
          </div>
        </div>
      </div>

      <div className="container-page py-6 sm:py-8">
        {/* Type tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-2 lg:hidden">
          <button
            onClick={() => setType("")}
            className={`flex-shrink-0 chip ${!activeType ? "bg-brand-500 text-white border-none" : ""}`}
          >
            All
          </button>
          {autoTypes.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-shrink-0 chip ${activeType === t ? "bg-brand-500 text-white border-none" : ""}`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex-shrink-0 chip"
          >
            <SlidersHorizontal size={12} className="mr-1" /> More
          </button>
        </div>

        <div className="grid lg:grid-cols-[200px_1fr] gap-6 mt-4">
          <aside className="hidden lg:block">
            <h3 className="font-semibold text-sm text-ink mb-3">Vehicle Type</h3>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setType("")}
                className={`text-left text-sm px-3 py-2 rounded-lg ${!activeType ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-soft hover:bg-surface-alt"}`}
              >
                All Types
              </button>
              {autoTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`text-left text-sm px-3 py-2 rounded-lg ${activeType === t ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-soft hover:bg-surface-alt"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </aside>

          <div>
            <p className="text-sm text-ink-soft mb-4">{filtered.length} vehicles found</p>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-ink-soft text-sm">No vehicles match your search.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {filtered.map((a) => (
                  <AutomobileCard key={a.id} auto={a} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Vehicle Type</h3>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setType("")} className="text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-alt">All Types</button>
              {autoTypes.map((t) => (
                <button key={t} onClick={() => setType(t)} className="text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-alt">{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
