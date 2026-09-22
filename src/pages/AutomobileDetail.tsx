import { Link, useParams } from "react-router-dom";
import { MapPin, Gauge, Fuel, Settings2, Heart, ChevronRight, Calendar } from "lucide-react";
import { useListings } from "../store/ListingsStore";
import { formatPKR, formatKm } from "../lib/format";
import { useAppStore } from "../store/AppStore";
import SellerActions from "../components/SellerActions";

export default function AutomobileDetail() {
  const { id } = useParams();
  const { automobiles } = useListings();
  const auto = automobiles.find((a) => a.id === id);
  const { toggleWishlist, isWishlisted } = useAppStore();

  if (!auto) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-ink-soft">Vehicle not found. It may have been sold.</p>
        <Link to="/automobiles" className="btn-primary mt-4 inline-flex">Back to Automobiles</Link>
      </div>
    );
  }

  const specs = [
    { icon: Calendar, label: "Year", value: String(auto.year) },
    { icon: Gauge, label: "Mileage", value: formatKm(auto.mileageKm) },
    { icon: Fuel, label: "Fuel Type", value: auto.fuel },
    { icon: Settings2, label: "Transmission", value: auto.transmission },
  ];

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="flex items-center gap-1 text-xs text-ink-soft mb-4 flex-wrap">
        <Link to="/automobiles" className="hover:text-brand-600">Automobiles</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{auto.make} {auto.model}</span>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
        <div className="relative rounded-xl2 overflow-hidden border border-surface-border bg-white aspect-[4/3]">
          <img src={auto.image} alt={`${auto.make} ${auto.model}`} className="w-full h-full object-cover" />
          <span className={`absolute top-3 left-3 chip border-none font-semibold ${auto.condition === "New" ? "bg-green-600 text-white" : "bg-ink text-white"}`}>
            {auto.condition}
          </span>
        </div>

        <div>
          <h1 className="font-display font-bold text-2xl text-ink">{auto.make} {auto.model}</h1>
          <p className="text-sm text-ink-soft mt-1">{auto.year} &middot; {auto.type}</p>

          <span className="font-display font-bold text-3xl text-ink block mt-4">{formatPKR(auto.price)}</span>

          <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-3">
            <MapPin size={15} /> {auto.location}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            {specs.map((s) => (
              <div key={s.label} className="card-base p-3 flex items-center gap-2.5">
                <s.icon size={18} className="text-brand-500 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-ink-soft">{s.label}</p>
                  <p className="text-sm font-semibold text-ink">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card-base p-4 mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{auto.seller}</p>
              <p className="text-xs text-ink-soft mt-0.5">Posted {auto.postedAgo}</p>
            </div>
            {auto.verified && (
              <span className="chip bg-green-50 text-green-700 border-green-200">Verified Dealer</span>
            )}
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <SellerActions
                sellerName={auto.seller}
                phone={auto.phone}
                itemTitle={`${auto.make} ${auto.model} ${auto.year}`}
                price={auto.price}
              />
            </div>
            <button
              onClick={() => toggleWishlist(auto.id)}
              aria-label="Save vehicle"
              className="w-12 h-12 mt-5 flex-shrink-0 rounded-full border border-surface-border flex items-center justify-center hover:border-brand-400"
            >
              <Heart size={18} className={isWishlisted(auto.id) ? "fill-brand-500 text-brand-500" : "text-ink-soft"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
