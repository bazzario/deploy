import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useListings } from "../store/ListingsStore";
import ProductCard from "../components/ProductCard";
import AutomobileCard from "../components/AutomobileCard";
import { useAppStore } from "../store/AppStore";

export default function Wishlist() {
  const { wishlistIds } = useAppStore();
  const { products, automobiles } = useListings();
  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));
  const savedAutos = automobiles.filter((a) => wishlistIds.includes(a.id));

  if (savedProducts.length === 0 && savedAutos.length === 0) {
    return (
      <div className="container-page py-16 sm:py-24 text-center">
        <Heart size={40} className="mx-auto text-ink-soft" />
        <h1 className="font-display font-bold text-xl text-ink mt-4">Your wishlist is empty</h1>
        <p className="text-sm text-ink-soft mt-1.5">Tap the heart icon on any item to save it here.</p>
        <Link to="/products" className="btn-primary mt-6 inline-flex">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-ink mb-6">
        Your Wishlist ({savedProducts.length + savedAutos.length})
      </h1>

      {savedProducts.length > 0 && (
        <div className="mb-8">
          <h2 className="section-title mb-4">Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {savedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {savedAutos.length > 0 && (
        <div>
          <h2 className="section-title mb-4">Automobiles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {savedAutos.map((a) => (
              <AutomobileCard key={a.id} auto={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
