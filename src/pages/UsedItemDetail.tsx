import { Link, useParams } from "react-router-dom";
import { MapPin, Star, ChevronRight, ShieldAlert } from "lucide-react";
import { useListings } from "../store/ListingsStore";
import { formatPKR } from "../lib/format";
import SellerActions from "../components/SellerActions";

export default function UsedItemDetail() {
  const { id } = useParams();
  const { usedItems } = useListings();
  const listing = usedItems.find((l) => l.id === id);

  if (!listing) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-ink-soft">Listing not found. It may have been sold.</p>
        <Link to="/used-items" className="btn-primary mt-4 inline-flex">Back to Used Products</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="flex items-center gap-1 text-xs text-ink-soft mb-4 flex-wrap">
        <Link to="/used-items" className="hover:text-brand-600">Used Products</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{listing.title}</span>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
        <div className="rounded-xl2 overflow-hidden border border-surface-border bg-white aspect-[4/3]">
          <img src={listing.image} alt={listing.title} className="w-full h-full object-cover" />
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="chip bg-brand-50 text-brand-700 border-brand-100">{listing.condition}</span>
            {listing.negotiable && <span className="chip bg-green-50 text-green-700 border-green-200">Negotiable</span>}
            <span className="text-xs text-ink-soft">{listing.postedAgo}</span>
          </div>

          <h1 className="font-display font-bold text-2xl text-ink mt-3">{listing.title}</h1>
          <span className="font-display font-bold text-3xl text-ink block mt-3">{formatPKR(listing.price)}</span>

          <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-3">
            <MapPin size={15} /> {listing.location}
          </div>

          <div className="card-base p-4 mt-5">
            <p className="text-sm font-semibold text-ink mb-2">Description</p>
            <p className="text-sm text-ink-soft leading-relaxed">{listing.description}</p>
          </div>

          <div className="card-base p-4 mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{listing.seller}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span className="text-xs text-ink-soft">{listing.sellerRating} seller rating</span>
              </div>
            </div>
            {listing.verified && (
              <span className="chip bg-green-50 text-green-700 border-green-200">Verified Seller</span>
            )}
          </div>

          <SellerActions
            sellerName={listing.seller}
            phone={listing.phone}
            itemTitle={listing.title}
            price={listing.price}
            allowOffers={listing.negotiable}
          />

          <div className="flex items-start gap-2 text-xs text-ink-soft mt-4 p-3 rounded-xl bg-surface-alt">
            <ShieldAlert size={15} className="flex-shrink-0 mt-0.5" />
            <p>Meet in a public place, inspect the item before paying, and avoid advance payments to strangers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
