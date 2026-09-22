import { NavLink } from "react-router-dom";
import { Home, LayoutGrid, Tag, Car, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/products", label: "Shop", icon: LayoutGrid, end: false },
  { to: "/used-items", label: "Used", icon: Tag, end: false },
  { to: "/automobiles", label: "Autos", icon: Car, end: false },
  { to: "/auth?mode=login", label: "Account", icon: User, end: false },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-surface-border pb-safe">
      <div className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? "text-brand-600" : "text-ink-soft"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
