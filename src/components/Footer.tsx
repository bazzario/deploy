import { Link } from "react-router-dom";
import { site, hasAnySocial } from "../config/site";
import { LogoFull } from "./Logo";

export default function Footer() {
  const socials = [
    { href: site.social.facebook, label: "Facebook" },
    { href: site.social.instagram, label: "Instagram" },
    { href: site.social.youtube, label: "YouTube" },
  ].filter((s) => s.href);

  return (
    <footer className="bg-ink text-white mt-12 pb-16 lg:pb-0">
      <div className="container-page py-12 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8">
        <div className="col-span-2 lg:col-span-1">
          <LogoFull variant="light" className="h-20" />
          <p className="text-sm text-white/60 mt-3 max-w-xs">
            Pakistan's marketplace for everything. Shop new, buy used, and
            find your next automobile.
          </p>
          {hasAnySocial() && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {socials.map(({ href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/50 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/products" className="hover:text-white">All products</Link></li>
            <li><Link to="/products?category=electronics" className="hover:text-white">Electronics</Link></li>
            <li><Link to="/products?category=fashion" className="hover:text-white">Fashion</Link></li>
            <li><Link to="/used-items" className="hover:text-white">Used Products</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-3">Automobiles</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/automobiles" className="hover:text-white">Browse vehicles</Link></li>
            <li><Link to="/automobiles?type=Car" className="hover:text-white">Cars</Link></li>
            <li><Link to="/automobiles?type=Bike" className="hover:text-white">Bikes</Link></li>
            <li><Link to="/sell" className="hover:text-white">Sell your vehicle</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-3">Sell</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/sell" className="hover:text-white">Start selling</Link></li>
            <li><Link to="/terms" className="hover:text-white">Seller terms</Link></li>
            <li><Link to="/seller" className="hover:text-white">Seller dashboard</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-3">Help</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/orders" className="hover:text-white">Track order</Link></li>
            <li><Link to="/returns" className="hover:text-white">Returns &amp; refunds</Link></li>
            <li><Link to="/payments" className="hover:text-white">Payment methods</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact us</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-white/80">Privacy</Link>
            <Link to="/terms" className="hover:text-white/80">Terms</Link>
            <Link to="/cookies" className="hover:text-white/80">Cookies</Link>
            <Link to="/admin/login" className="hover:text-white/80">Admin Login</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="container-page py-3 text-center text-[11px] text-white/40">
          Project by A and R Developers
        </p>
      </div>
    </footer>
  );
}
