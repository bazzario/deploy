import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthStore";
import { LogoIcon } from "../components/Logo";
import AdminNotifications from "./components/AdminNotifications";
import { useUrlParam } from "./useUrlParam";

import {
  LayoutDashboard,
  Users,
  Package,
  ListChecks,
  ShoppingCart,
  Truck,
  Flag,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
} from "lucide-react";

/**
 * Admin shell (sidebar + header). Access control is NOT done here — every
 * route that renders this layout is wrapped in <AdminGuard> (see App.tsx),
 * which requires a Supabase session with profiles.is_admin = true. This file
 * only reads the signed-in user for the avatar and provides the Logout button.
 */

const navItems = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Listings", to: "/admin/listings", icon: ListChecks },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Delivery", to: "/admin/delivery", icon: Truck },
  { label: "Reports", to: "/admin/reports", icon: Flag },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

/**
 * Pages whose table has its own search box. Quick search on these pages drives
 * that same box (through the `?q=` URL param). On every other page it jumps to
 * Orders — the most common lookup — and searches there.
 */
const SEARCH_TARGETS: Record<string, string> = {
  "/admin/users": "users",
  "/admin/products": "products",
  "/admin/listings": "listings",
  "/admin/orders": "orders",
  "/admin/delivery": "deliveries",
  "/admin/reports": "reports",
};

function QuickSearch() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const target = SEARCH_TARGETS[pathname];
  const [q, setQ] = useUrlParam("q");
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (target) return; // already filtering this page live
    const term = text.trim();
    if (!term) return;
    setText("");
    navigate(`/admin/orders?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="hidden sm:flex relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
      <input
        type="text"
        value={target ? q : text}
        onChange={(e) => (target ? setQ(e.target.value) : setText(e.target.value))}
        placeholder={target ? `Search ${target}...` : "Search orders..."}
        aria-label="Quick search"
        className="input-base !pl-9 !py-2 w-52"
      />
    </form>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Revokes the Supabase session server-side and clears the saved session.
      await signOut();
    } finally {
      onNavigate?.();
      navigate("/admin/login", { replace: true });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Link to="/admin/dashboard" className="flex items-center gap-2 px-5 h-16 border-b border-white/10 flex-shrink-0">
        <LogoIcon className="h-9" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50 border border-white/20 rounded px-1.5 py-0.5">
          Admin
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-500 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-white/10 flex-shrink-0">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-60"
        >
          <LogOut size={17} />
          {loggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-ink flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-ink flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-white/70 hover:text-white"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Top header */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 bg-white border-b border-surface-border h-16 flex items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-ink-soft hover:text-ink"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <h1 className="font-display font-bold text-lg text-ink truncate">{title}</h1>

          <div className="ml-auto flex items-center gap-3">
            <QuickSearch />
            <AdminNotifications />
            <div className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
