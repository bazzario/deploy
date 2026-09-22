import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="bg-white border-b border-surface-border">
      <div className="container-page py-10 sm:py-14 lg:py-16 grid lg:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-ink leading-tight">
            Pakistan's Marketplace for Everything
          </h1>
          <p className="text-ink-soft text-base sm:text-lg mt-4 max-w-lg">
            Shop new products, discover great used deals, and find your
            next automobile, all in one place.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-7">
            <Link to="/products" className="btn-primary !px-6 !py-3 text-sm">
              Start Shopping <ArrowRight size={16} />
            </Link>
            <Link to="/used-items" className="btn-secondary !px-6 !py-3 text-sm">
              Browse Used Products
            </Link>
          </div>
        </div>
        <div className="hidden lg:grid grid-cols-2 gap-4">
          <div className="rounded-xl2 overflow-hidden shadow-pop col-span-2 aspect-[16/8]">
            <img
              src="https://picsum.photos/seed/bazaario-hero-1/900/450"
              alt="Shop products on Bazaario"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="rounded-xl2 overflow-hidden shadow-card aspect-square">
            <img
              src="https://picsum.photos/seed/bazaario-hero-2/450/450"
              alt="Used product deals"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="rounded-xl2 overflow-hidden shadow-card aspect-square">
            <img
              src="https://picsum.photos/seed/bazaario-hero-3/450/450"
              alt="Automobiles on Bazaario"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
