import { Link } from "react-router-dom";
import { Sparkles, Tag } from "lucide-react";

export default function ModeSwitcher() {
  return (
    <section className="py-6 sm:py-8">
      <div className="container-page">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Link
            to="/products"
            className="group relative rounded-xl2 border border-surface-border bg-white p-4 sm:p-6 overflow-hidden hover:border-brand-400 transition-colors"
          >
            <Sparkles size={20} className="text-brand-500" />
            <p className="font-display font-bold text-ink text-base sm:text-lg mt-2">
              New Products
            </p>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Brand new, with warranty &amp; fast delivery
            </p>
          </Link>
          <Link
            to="/used-items"
            className="group relative rounded-xl2 border border-surface-border bg-white p-4 sm:p-6 overflow-hidden hover:border-brand-400 transition-colors"
          >
            <Tag size={20} className="text-brand-500" />
            <p className="font-display font-bold text-ink text-base sm:text-lg mt-2">
              Used Products
            </p>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Great deals from verified local sellers
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}
