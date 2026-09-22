import { Link } from "react-router-dom";
import { Package, Tag, Car, ArrowRight } from "lucide-react";
import { site } from "../config/site";

const options = [
  {
    icon: Package,
    title: "Sell New Products",
    desc: "List your inventory as a business seller and reach buyers across Pakistan.",
    cta: "Add a Product",
    to: "/sell/product",
  },
  {
    icon: Tag,
    title: "Post a Used Product",
    desc: "Sell items you no longer need directly to local buyers, free.",
    cta: "Post Listing",
    to: "/sell/used-item",
  },
  {
    icon: Car,
    title: "Sell Your Vehicle",
    desc: "List your car, bike or auto part in the Automobiles section.",
    cta: "List Vehicle",
    to: "/sell/vehicle",
  },
];

export default function Sell() {
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="max-w-2xl">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink">Sell on Bazaario</h1>
        <p className="text-ink-soft mt-2">
          Choose how you want to sell. New sellers can list products for free for the first{" "}
          {site.policies.sellerFreeListingMonths} months. After that, continued listing access
          requires a paid seller plan.
          {site.policies.sellerFeePromoDays !== null
            ? ` New seller onboarding also comes with 0% fees for your first ${site.policies.sellerFeePromoDays} days.`
            : ""}
        </p>
        <p className="text-xs text-ink-soft mt-2">
          Online payments are made to {site.name}. Pricing will be shown when renewal is due.
          See the <Link to="/terms" className="text-brand-600 font-medium">Seller Terms</Link>.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-8">
        {options.map((o) => (
          <div key={o.title} className="card-base p-5 flex flex-col">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
              <o.icon size={22} />
            </div>
            <h3 className="font-display font-bold text-ink mt-4">{o.title}</h3>
            <p className="text-sm text-ink-soft mt-1.5 flex-1">{o.desc}</p>
            <Link to={o.to} className="btn-primary w-full mt-4 text-sm">
              {o.cta} <ArrowRight size={15} />
            </Link>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-soft mt-6">
        Already selling?{" "}
        <Link to="/seller" className="text-brand-600 font-medium">Manage your listings</Link>{" "}
        from the Seller Dashboard.
      </p>
    </div>
  );
}
