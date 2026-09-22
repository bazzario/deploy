import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Star, Heart, Zap, Minus, Plus, Truck, ShieldCheck, ChevronRight } from "lucide-react";
import { useListings } from "../store/ListingsStore";
import { formatPKR, discountPercent } from "../lib/format";
import { useAppStore } from "../store/AppStore";
import { isOutOfStock, maxOrderableQty } from "../lib/checkout";
import { site } from "../config/site";
import ProductCard from "../components/ProductCard";
import ProductGallery from "../components/ProductGallery";
import { getProductImages } from "../lib/productImages";

export default function ProductDetail() {
  const { id } = useParams();
  const { products } = useListings();
  const product = products.find((p) => p.id === id);
  const { toggleWishlist, isWishlisted } = useAppStore();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);

  if (!product) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-ink-soft">Product not found.</p>
        <Link to="/products" className="btn-primary mt-4 inline-flex">Back to Products</Link>
      </div>
    );
  }

  const discount = discountPercent(product.price, product.originalPrice);
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const outOfStock = isOutOfStock(product);
  const maxQty = Math.max(1, maxOrderableQty(product));

  function buyNow() {
    if (outOfStock || !product) return;
    navigate(`/checkout?productId=${encodeURIComponent(product.id)}&qty=${qty}`);
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="flex items-center gap-1 text-xs text-ink-soft mb-4 flex-wrap">
        <Link to="/products" className="hover:text-brand-600">Products</Link>
        <ChevronRight size={12} />
        <Link to={`/products?category=${product.category}`} className="hover:text-brand-600">{product.category}</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{product.title}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <ProductGallery key={product.id} images={getProductImages(product)} title={product.title} />

        <div>
          <p className="text-sm text-ink-soft font-medium">{product.brand}</p>
          <h1 className="font-display font-bold text-2xl text-ink mt-1">{product.title}</h1>

          <div className="flex items-center gap-1.5 mt-2">
            <Star size={15} className="fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-ink">{product.rating}</span>
            <span className="text-sm text-ink-soft">({product.reviews} reviews)</span>
          </div>

          <div className="flex items-baseline gap-3 mt-4">
            <span className="font-display font-bold text-3xl text-ink">{formatPKR(product.price)}</span>
            {product.originalPrice && (
              <span className="text-base text-ink-soft line-through">{formatPKR(product.originalPrice)}</span>
            )}
          </div>
          {discount && <span className="text-sm font-semibold text-green-700">{discount}% off, limited time</span>}

          {outOfStock ? (
            <p className="text-sm font-semibold text-red-600 mt-4">Out of stock</p>
          ) : (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-medium text-ink-soft mr-1">Quantity</span>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="w-8 h-8 rounded-full border border-surface-border flex items-center justify-center text-ink-soft hover:border-brand-400 hover:text-brand-600"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold text-ink">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                aria-label="Increase quantity"
                className="w-8 h-8 rounded-full border border-surface-border flex items-center justify-center text-ink-soft hover:border-brand-400 hover:text-brand-600"
              >
                <Plus size={14} />
              </button>
              {product.stock !== undefined && (
                <span className="text-xs text-ink-soft ml-1">{product.stock} in stock</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={buyNow}
              disabled={outOfStock}
              className="flex-1 sm:flex-none sm:px-8 inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-500"
            >
              <Zap size={16} /> {outOfStock ? "Out of Stock" : "Buy Now"}
            </button>
            <button
              onClick={() => toggleWishlist(product.id)}
              aria-label="Toggle wishlist"
              className="w-12 h-12 flex-shrink-0 rounded-full border border-surface-border flex items-center justify-center hover:border-brand-400"
            >
              <Heart size={18} className={isWishlisted(product.id) ? "fill-brand-500 text-brand-500" : "text-ink-soft"} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-surface-border bg-white">
              <Truck size={18} className="text-brand-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">{product.freeDelivery ? "Free Delivery" : "Standard Delivery"}</p>
                <p className="text-xs text-ink-soft">Arrives in 2 to 4 business days</p>
              </div>
            </div>
            {site.policies.returnDays !== null && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-surface-border bg-white">
                <ShieldCheck size={18} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {site.policies.returnDays}-Day Return
                  </p>
                  <Link to="/returns" className="text-xs text-ink-soft hover:text-brand-600">
                    See returns policy
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="section-title mb-4">Related Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
