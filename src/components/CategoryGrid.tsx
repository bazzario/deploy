import { Link } from "react-router-dom";
import {
  Smartphone,
  Shirt,
  Sofa,
  Sparkles,
  ShoppingBasket,
  Dumbbell,
  Baby,
  Phone,
  WashingMachine,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { categories } from "../data/products";

const iconMap: Record<string, LucideIcon> = {
  Smartphone,
  Shirt,
  Sofa,
  Sparkles,
  ShoppingBasket,
  Dumbbell,
  Baby,
  Phone,
  WashingMachine,
  BookOpen,
};

export default function CategoryGrid() {
  return (
    <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-3 sm:gap-4">
      {categories.map((cat) => {
        const Icon = iconMap[cat.icon] ?? Smartphone;
        return (
          <Link
            key={cat.id}
            to={`/products?category=${cat.id}`}
            className="flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-surface-border flex items-center justify-center text-brand-500 group-hover:border-brand-400 group-hover:bg-brand-50 transition-colors">
              <Icon size={24} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-ink leading-tight">
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
