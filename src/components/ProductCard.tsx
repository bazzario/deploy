import { Link, useNavigate } from "react-router-dom";
import { Star, Heart, Zap } from "lucide-react";
import type { Product } from "../data/types";
import { formatPKR, discountPercent } from "../lib/format";
import { useAppStore } from "../store/AppStore";
import { isOutOfStock } from "../lib/checkout";
import { primaryImage } from "../lib/productImages";

export default function ProductCard({ product }: { product: Product }) {
  const { toggleWishlist, isWishlisted } = useAppStore();
  const navigate = useNavigate();
  const discount = discountPercent(product.price, product.originalPrice);
  const wishlisted = isWishlisted(product.id);
  const outOfStock = isOutOfStock(product);

  function buyNow(e: React.MouseEvent) {
    e.preventDefault();
    if (outOfStock) return;
    navigate(`/checkout?productId=${encodeURIComponent(product.id)}&qty=1`);
  }

  return (
    <div className="card-base relative flex flex-col overflow-hidden group h-full">
      <button
        onClick={() => toggleWishlist(product.id)}
        aria-label="Toggle wishlist"
        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-card"
      >
        <Heart
          size={16}
          className={wishlisted ? "fill-brand-500 text-brand-500" : "text-ink-soft"}
        />
      </button>

      {product.badge && (
        <span className="absolute top-2 left-2 z-10 chip bg-ink text-white border-none">
          {product.badge}
        </span>
      )}

      <Link to={`/products/${product.id}`} className="block aspect-square overflow-hidden bg-surface-alt">
        <img
          src={primaryImage(product)}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </Link>

      <div className="flex flex-col flex-1 p-3">
        <p className="text-[11px] text-ink-soft font-medium">{product.brand}</p>
        <Link to={`/products/${product.id}`}>
          <h3 className="text-sm font-medium text-ink line-clamp-2 mt-0.5 min-h-[2.5rem]">
            {product.title}
          </h3>
        </Link>

        <div className="flex items-center gap-1 mt-1.5">
          <Star size={13} className="fill-amber-400 text-amber-400" />
          <span className="text-xs font-semibold text-ink">{product.rating}</span>
          <span className="text-xs text-ink-soft">({product.reviews})</span>
        </div>

        <div className="flex items-baseline gap-2 mt-2">
          <span className="font-display font-bold text-ink text-base">
            {formatPKR(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-ink-soft line-through">
              {formatPKR(product.originalPrice)}
            </span>
          )}
        </div>
        {discount && (
          <span className="text-xs font-semibold text-green-700 mt-0.5">
            {discount}% off
          </span>
        )}
        {product.freeDelivery && (
          <span className="text-[11px] text-ink-soft mt-0.5">Free delivery</span>
        )}
        {outOfStock && (
          <span className="text-[11px] font-semibold text-red-600 mt-0.5">Out of stock</span>
        )}

        <button
          onClick={buyNow}
          disabled={outOfStock}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-500"
        >
          <Zap size={14} /> {outOfStock ? "Out of Stock" : "Buy Now"}
        </button>
      </div>
    </div>
  );
}
