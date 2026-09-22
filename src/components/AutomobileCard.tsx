import { Link } from "react-router-dom";
import { Heart, MapPin, Gauge, Fuel, Settings2 } from "lucide-react";
import type { Automobile } from "../data/types";
import { formatPKR, formatKm } from "../lib/format";
import { useAppStore } from "../store/AppStore";

export default function AutomobileCard({ auto }: { auto: Automobile }) {
  const { toggleWishlist, isWishlisted } = useAppStore();
  const wishlisted = isWishlisted(auto.id);

  return (
    <div className="card-base flex flex-col overflow-hidden h-full">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
        <Link to={`/automobiles/${auto.id}`}>
          <img
            src={auto.image}
            alt={`${auto.make} ${auto.model}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </Link>
        <span
          className={`absolute top-2 left-2 chip border-none font-semibold ${
            auto.condition === "New"
              ? "bg-green-600 text-white"
              : "bg-ink text-white"
          }`}
        >
          {auto.condition}
        </span>
        <button
          onClick={() => toggleWishlist(auto.id)}
          aria-label="Save vehicle"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-card"
        >
          <Heart size={16} className={wishlisted ? "fill-brand-500 text-brand-500" : "text-ink-soft"} />
        </button>
      </div>

      <div className="flex flex-col flex-1 p-3">
        <Link to={`/automobiles/${auto.id}`}>
          <h3 className="text-sm font-semibold text-ink">
            {auto.make} {auto.model}
          </h3>
        </Link>
        <p className="text-xs text-ink-soft mt-0.5">{auto.year}</p>

        <span className="font-display font-bold text-lg text-ink mt-1.5">
          {formatPKR(auto.price)}
        </span>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2.5 text-xs text-ink-soft">
          <span className="flex items-center gap-1"><Gauge size={13} /> {formatKm(auto.mileageKm)}</span>
          <span className="flex items-center gap-1"><Fuel size={13} /> {auto.fuel}</span>
          <span className="flex items-center gap-1 col-span-2"><Settings2 size={13} /> {auto.transmission}</span>
        </div>

        <div className="flex items-center gap-1 text-xs text-ink-soft mt-2 pt-2 border-t border-surface-border">
          <MapPin size={13} className="flex-shrink-0" />
          <span className="truncate">{auto.location}</span>
        </div>

        <Link
          to={`/automobiles/${auto.id}`}
          className="btn-primary w-full mt-3 !py-2 text-xs"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
