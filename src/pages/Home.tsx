import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Hero from "../components/Hero";
import ModeSwitcher from "../components/ModeSwitcher";
import CategoryGrid from "../components/CategoryGrid";
import Section from "../components/Section";
import ProductCard from "../components/ProductCard";
import UsedItemCard from "../components/UsedItemCard";
import AutomobileCard from "../components/AutomobileCard";
import TrustSection from "../components/TrustSection";
import { useListings } from "../store/ListingsStore";

export default function Home() {
  const { products, usedItems, automobiles } = useListings();
  const dealsProducts = products.filter((p) => p.originalPrice);

  return (
    <>
      <Hero />
      <ModeSwitcher />

      <Section title="Shop by Category">
        <CategoryGrid />
      </Section>

      <Section title="Trending Products" subtitle="Popular picks this week" viewAllTo="/products">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {products.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Section>

      <Section
        title="Today's Deals"
        subtitle="Limited-time discounts, while stock lasts"
        viewAllTo="/products?sort=deals"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {dealsProducts.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </Section>

      <Section
        title="Used Products"
        subtitle="Great condition, better price, from verified local sellers"
        viewAllTo="/used-items"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {usedItems.slice(0, 3).map((item) => (
            <UsedItemCard key={item.id} item={item} />
          ))}
        </div>
      </Section>

      <section className="py-8 sm:py-10 bg-white border-y border-surface-border">
        <div className="container-page">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="section-title">Automobiles</h2>
              <p className="section-sub">Cars, bikes, SUVs, trucks &amp; auto parts</p>
            </div>
            <Link
              to="/automobiles"
              className="flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0"
            >
              View all <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {automobiles.slice(0, 4).map((a) => (
              <AutomobileCard key={a.id} auto={a} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/automobiles" className="btn-primary text-sm">
              Search Cars
            </Link>
            <Link to="/sell" className="btn-secondary text-sm">
              Sell Your Vehicle
            </Link>
          </div>
        </div>
      </section>

      <TrustSection />
    </>
  );
}
