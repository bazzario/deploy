import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function Section({
  title,
  subtitle,
  viewAllTo,
  children,
}: {
  title: string;
  subtitle?: string;
  viewAllTo?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-8 sm:py-10">
      <div className="container-page">
        <div className="flex items-end justify-between mb-4 sm:mb-5">
          <div>
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="section-sub">{subtitle}</p>}
          </div>
          {viewAllTo && (
            <Link
              to={viewAllTo}
              className="flex items-center gap-0.5 text-sm font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0"
            >
              View all <ChevronRight size={16} />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
