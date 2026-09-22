import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Search,
  User,
  Heart,
  Menu,
  X,
  ChevronDown,
  Car,
  Store,
  Settings,
} from "lucide-react";
import { useAppStore } from "../store/AppStore";
import { useAuth } from "../store/AuthStore";
import { site } from "../config/site";
import { LogoText } from "./Logo";

const navLinks = [
  { label: "Categories", to: "/products" },
  { label: "New Products", to: "/products" },
  { label: "Used Products", to: "/used-items" },
  { label: "Deals", to: "/products?sort=deals" },
  { label: "Automobiles", to: "/automobiles" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { wishlistIds } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-surface-border">
        {/* Top utility row - desktop only */}
        <div className="hidden lg:block bg-ink text-white text-xs">
          <div className="container-page flex items-center justify-between h-8">
            <p>
              {site.policies.freeDeliveryOver !== null &&
                `Free delivery on orders over Rs. ${site.policies.freeDeliveryOver.toLocaleString("en-PK")}`}
              {site.policies.freeDeliveryOver !== null && site.policies.paymentMethods.length > 0 && " · "}
              {site.policies.paymentMethods.length > 0 &&
                `${site.policies.paymentMethods.join(", ")} accepted`}
            </p>
            <div className="flex items-center gap-4">
              <Link to="/orders" className="hover:text-brand-100">Track Order</Link>
              <Link to="/sell" className="hover:text-brand-100">Sell on Bazaario</Link>
            </div>
          </div>
        </div>

        {/* Main row */}
        <div className="container-page flex items-center gap-3 h-16">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 -ml-2 rounded-md text-ink hover:bg-surface-alt"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          <Link to="/" className="flex-shrink-0 flex items-center" aria-label="Bazaario home">
            <LogoText />
          </Link>

          {/* Search - desktop */}
          <form
            onSubmit={submitSearch}
            className="hidden md:flex flex-1 max-w-2xl mx-2"
          >
            <div className="flex w-full items-center rounded-full border border-surface-border bg-surface-alt focus-within:border-brand-400 focus-within:bg-white transition-colors pl-4 pr-1.5 py-1.5">
              <Search size={18} className="text-ink-soft flex-shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search products, brands, cars & more"
                className="flex-1 bg-transparent outline-none text-sm px-3 text-ink placeholder:text-ink-soft"
              />
              <button
                type="submit"
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Search
              </button>
            </div>
          </form>

          {/* Right icons - desktop */}
          <div className="hidden md:flex items-center gap-1 ml-auto flex-shrink-0">
            <Link
              to="/auth?mode=login"
              className="flex flex-col items-center px-3 py-1 rounded-lg hover:bg-surface-alt text-ink"
            >
              <User size={20} />
              <span className="text-[11px] font-medium mt-0.5 max-w-[80px] truncate">
                {user ? user.name.split(" ")[0] : "Account"}
              </span>
            </Link>
            <Link
              to="/wishlist"
              className="relative flex flex-col items-center px-3 py-1 rounded-lg hover:bg-surface-alt text-ink"
            >
              <Heart size={20} />
              {wishlistIds.length > 0 && (
                <span className="absolute top-0 right-1.5 bg-brand-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {wishlistIds.length}
                </span>
              )}
              <span className="text-[11px] font-medium mt-0.5">Wishlist</span>
            </Link>
          </div>

          {/* Mobile right icons */}
          <div className="flex md:hidden items-center gap-1 ml-auto">
            <Link to="/wishlist" className="relative p-2 text-ink" aria-label="Wishlist">
              <Heart size={22} />
              {wishlistIds.length > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-brand-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {wishlistIds.length}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile search row */}
        <form onSubmit={submitSearch} className="md:hidden container-page pb-3">
          <div className="flex w-full items-center rounded-full border border-surface-border bg-surface-alt pl-4 pr-1.5 py-2">
            <Search size={18} className="text-ink-soft flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Search products, brands, cars & more"
              className="flex-1 bg-transparent outline-none text-sm px-2.5 text-ink placeholder:text-ink-soft min-w-0"
            />
            <button type="submit" className="btn-primary !py-1.5 !px-3.5 text-xs flex-shrink-0">
              Search
            </button>
          </div>
        </form>

        {/* Category nav - desktop */}
        <nav className="hidden lg:block border-t border-surface-border">
          <div className="container-page flex items-center gap-1 h-11 text-sm font-medium">
            <NavLink
              to="/products"
              className={({ isActive }) =>
                `flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-surface-alt ${isActive ? "text-brand-600" : "text-ink"}`
              }
            >
              <ChevronDown size={15} /> Categories
            </NavLink>
            <NavLink
              to="/products"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md hover:bg-surface-alt ${isActive ? "text-brand-600" : "text-ink"}`
              }
            >
              New Products
            </NavLink>
            <NavLink
              to="/used-items"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md hover:bg-surface-alt ${isActive ? "text-brand-600" : "text-ink"}`
              }
            >
              Used Products
            </NavLink>
            <NavLink
              to="/products?sort=deals"
              className="px-3 py-1.5 rounded-md hover:bg-surface-alt text-ink"
            >
              Deals
            </NavLink>
            <NavLink
              to="/automobiles"
              className={({ isActive }) =>
                `flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-surface-alt ${isActive ? "text-brand-600" : "text-ink"}`
              }
            >
              <Car size={15} /> Automobiles
            </NavLink>
            {user?.isAdmin && (
              <Link
                to="/admin"
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-ink-soft hover:bg-surface-alt"
                title="Manage your listings"
              >
                <Settings size={15} /> Admin
              </Link>
            )}
            <Link
              to="/sell"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-brand-600 font-semibold hover:bg-brand-50 ${
                user?.isAdmin ? "" : "ml-auto"
              }`}
            >
              <Store size={15} /> Sell on Bazaario
            </Link>
          </div>
        </nav>
      </header>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-0 left-0 h-full w-[82%] max-w-xs bg-white shadow-pop flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-surface-border">
              <LogoText className="text-xl" />
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-1">
                <X size={22} />
              </button>
            </div>
            <Link
              to="/auth?mode=login"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 p-4 border-b border-surface-border"
            >
              <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
                <User size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {user ? `Salaam, ${user.name.split(" ")[0]}` : "Hello, sign in"}
                </p>
                <p className="text-xs text-ink-soft">Account &amp; orders</p>
              </div>
            </Link>
            <div className="flex flex-col py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-ink hover:bg-surface-alt border-b border-surface-border/60"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/sell"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                Sell on Bazaario
              </Link>
              {user?.isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-ink-soft hover:bg-surface-alt border-t border-surface-border/60"
                >
                  Admin: Manage Listings
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
