import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Star, ArrowRight } from "lucide-react";
import type { UsedItem } from "../data/types";
import { formatPKR } from "../lib/format";
import { toWhatsAppNumber } from "./SellerActions";

const conditionColor: Record<UsedItem["condition"], string> = {
  New: "bg-green-50 text-green-700 border-green-200",
  "Like New": "bg-blue-50 text-blue-700 border-blue-200",
  "Used - Good": "bg-amber-50 text-amber-700 border-amber-200",
  "Used - Fair": "bg-slate-100 text-slate-600 border-slate-200",
};

export default function UsedItemCard({ item }: { item: UsedItem }) {
  const waNumber = item.phone ? toWhatsAppNumber(item.phone) : "";
  const waMessage = `Assalam o Alaikum, Bazaario par aapki listing "${item.title}" (${formatPKR(
    item.price
  )}) ke baare mein poochhna tha.`;

  return (
    <div className="card-base flex flex-col overflow-hidden h-full">
      <Link to={`/used-items/${item.id}`} className="relative block aspect-[4/3] overflow-hidden bg-surface-alt">
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {item.negotiable && (
          <span className="absolute top-2 left-2 chip bg-white/95 border-none font-semibold text-brand-600">
            Negotiable
          </span>
        )}
        <span
          className={`absolute top-2 right-2 chip border ${conditionColor[item.condition]}`}
        >
          {item.condition}
        </span>
      </Link>

      <div className="flex flex-col flex-1 p-3">
        <Link to={`/used-items/${item.id}`}>
          <h3 className="text-sm font-semibold text-ink line-clamp-2 min-h-[2.5rem]">
            {item.title}
          </h3>
        </Link>

        <span className="font-display font-bold text-lg text-ink mt-1.5">
          {formatPKR(item.price)}
        </span>

        <div className="flex items-center gap-1 text-xs text-ink-soft mt-1.5">
          <MapPin size={13} className="flex-shrink-0" />
          <span className="truncate">{item.location}</span>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-border">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs font-medium text-ink truncate">{item.seller}</span>
            <Star size={11} className="fill-amber-400 text-amber-400 flex-shrink-0" />
            <span className="text-[11px] text-ink-soft flex-shrink-0">{item.sellerRating}</span>
          </div>
          <span className="text-[11px] text-ink-soft flex-shrink-0">{item.postedAgo}</span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Link to={`/used-items/${item.id}`} className="btn-primary flex-1 !py-2 text-xs">
            View details <ArrowRight size={13} />
          </Link>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Message ${item.seller}`}
              className="btn-secondary !px-3 !py-2 text-xs flex-shrink-0"
            >
              <MessageCircle size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
