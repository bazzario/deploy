import { Link } from "react-router-dom";
import { Package, Tag, Car, Plus, Trash2, ShieldCheck, CalendarClock } from "lucide-react";
import RequireAuth from "../components/RequireAuth";
import SellerOrders from "../components/SellerOrders";
import { useListings } from "../store/ListingsStore";
import { useMyListings } from "../hooks/useMyListings";
import { useAuth } from "../store/AuthStore";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSellerPlan } from "../store/SellerPlanStore";
import { formatPlanDate, SELLER_FREE_MONTHS } from "../lib/sellerPlan";
import { formatPKR } from "../lib/format";
import { primaryImage } from "../lib/productImages";

export default function Seller() {
  return (
    <RequireAuth>
      <SellerDashboard />
    </RequireAuth>
  );
}

function SellerDashboard() {
  const { user } = useAuth();
  // Deleting goes through the shared catalog store; reading uses the seller's own
  // query (owner_id = me) so counts never depend on the public catalog loading.
  const { deleteProduct, deleteUsedItem, deleteAutomobile } = useListings();
  const {
    products: myProducts,
    usedItems: myUsedItems,
    automobiles: myAutomobiles,
    failed,
    loading,
    reload,
  } = useMyListings();

  const anyFailed = failed.products || failed.usedItems || failed.automobiles;
  const totalListings = myProducts.length + myUsedItems.length + myAutomobiles.length;

  // A table that couldn't be read shows "—", never a made-up 0.
  const count = (n: number, didFail: boolean) => (loading ? "…" : didFail ? "—" : String(n));

  const stats = [
    { icon: Package, label: "Products", value: count(myProducts.length, failed.products), to: "/sell/product" },
    { icon: Tag, label: "Used Products", value: count(myUsedItems.length, failed.usedItems), to: "/sell/used-item" },
    { icon: Car, label: "Vehicles", value: count(myAutomobiles.length, failed.automobiles), to: "/sell/vehicle" },
  ];

  const removeThen = (action: Promise<void>) =>
    action
      .then(reload)
      .catch((err: unknown) => alert(err instanceof Error ? err.message : "Could not delete this listing."));

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">Seller Dashboard</h1>
          <p className="text-ink-soft mt-1.5">
            {user?.name ? `Welcome, ${user.name.split(" ")[0]}. ` : ""}
            Only your own listings are shown and managed here.
          </p>
        </div>
        {user?.isAdmin && (
          <Link to="/admin" className="btn-secondary !py-2 !px-3 text-xs flex-shrink-0 self-start">
            <ShieldCheck size={14} /> Admin Panel
          </Link>
        )}
      </div>

      <SellerPlanCard />

      {!isSupabaseConfigured && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Development mode.</strong> The backend isn't connected, so listings are only
            saved in this browser and won't be visible to other visitors.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card-base p-4 hover:border-brand-400 transition-colors">
            <div className="flex items-center justify-between">
              <s.icon size={18} className="text-brand-500" />
              <Plus size={14} className="text-ink-soft" />
            </div>
            <p className="font-display font-bold text-2xl text-ink mt-2">{s.value}</p>
            <p className="text-xs text-ink-soft mt-0.5">{s.label} listed</p>
          </Link>
        ))}
      </div>

      {isSupabaseConfigured && anyFailed && !loading && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-3 mt-4 flex items-start justify-between gap-3">
          <p className="text-xs text-red-700 leading-relaxed">
            Couldn't load your{" "}
            {[
              failed.products && "products",
              failed.usedItems && "used products",
              failed.automobiles && "vehicles",
            ]
              .filter(Boolean)
              .join(", ")}
            . The counts above are unknown, not zero.
          </p>
          <button onClick={reload} className="text-xs font-medium text-red-700 underline flex-shrink-0">
            Try again
          </button>
        </div>
      )}

      <SellerOrders />

      {loading ? null : totalListings === 0 && !anyFailed ? (
        <div className="card-base p-6 sm:p-8 mt-6 text-center">
          <Package size={28} className="mx-auto text-brand-500" />
          <p className="text-sm font-semibold text-ink mt-3">You haven't listed anything yet</p>
          <p className="text-xs text-ink-soft mt-1">
            Choose what you'd like to sell to create your first listing.
          </p>
          <Link to="/sell" className="btn-primary mt-4 inline-flex">
            Start selling
          </Link>
        </div>
      ) : totalListings === 0 ? null : (
        <div className="flex flex-col gap-6 mt-8">
          {myProducts.length > 0 && (
            <ListingGroup title="Your Products">
              {myProducts.map((p) => (
                <ListingRow
                  key={p.id}
                  image={primaryImage(p)}
                  title={p.title}
                  subtitle={formatPKR(p.price)}
                  onDelete={() => {
                    if (confirm("Delete this product?")) void removeThen(deleteProduct(p.id));
                  }}
                />
              ))}
            </ListingGroup>
          )}

          {myUsedItems.length > 0 && (
            <ListingGroup title="Your Used Products">
              {myUsedItems.map((u) => (
                <ListingRow
                  key={u.id}
                  image={u.image}
                  title={u.title}
                  subtitle={formatPKR(u.price)}
                  onDelete={() => {
                    if (confirm("Delete this listing?")) void removeThen(deleteUsedItem(u.id));
                  }}
                />
              ))}
            </ListingGroup>
          )}

          {myAutomobiles.length > 0 && (
            <ListingGroup title="Your Vehicles">
              {myAutomobiles.map((a) => (
                <ListingRow
                  key={a.id}
                  image={a.image}
                  title={`${a.make} ${a.model} (${a.year})`}
                  subtitle={formatPKR(a.price)}
                  onDelete={() => {
                    if (confirm("Delete this vehicle?")) void removeThen(deleteAutomobile(a.id));
                  }}
                />
              ))}
            </ListingGroup>
          )}
        </div>
      )}
    </div>
  );
}

/** Free period / plan status — Seller Dashboard ke upar. */
function SellerPlanCard() {
  const { plan, loading, error } = useSellerPlan();

  if (loading || plan.status === "unknown") {
    return error ? (
      <div className="rounded-lg bg-surface-alt border border-surface-border p-3 mt-4">
        <p className="text-xs text-ink-soft">{error}</p>
      </div>
    ) : null;
  }

  const expired = !plan.canList;

  return (
    <div
      className={`card-base p-4 mt-6 ${expired ? "border-amber-200 bg-amber-50" : ""}`}
    >
      <div className="flex items-start gap-3">
        <CalendarClock
          size={18}
          className={expired ? "text-amber-600 flex-shrink-0 mt-0.5" : "text-brand-500 flex-shrink-0 mt-0.5"}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {plan.status === "paid"
              ? "Paid seller plan active"
              : expired
                ? "Free listing period ended"
                : `Free listing, ${SELLER_FREE_MONTHS} months`}
          </p>
          <p className="text-xs text-ink-soft mt-1 leading-relaxed">
            {plan.status === "paid" ? (
              <>
                Your plan is active until {formatPlanDate(plan.paidUntil)}.{" "}
                <Link to="/seller/renew" className="text-brand-600 font-medium">
                  Renew early
                </Link>
              </>
            ) : expired ? (
              <>
                Your free period ended on {formatPlanDate(plan.freeEnd)}. A paid seller plan is
                required to publish new listings. Online payments are made to Bazaario, and
                pricing will be shown when renewal is due. Your existing listings stay published.
              </>
            ) : (
              <>
                Free from {formatPlanDate(plan.freeStart)} to {formatPlanDate(plan.freeEnd)}
                {plan.daysLeft > 0 ? ` (${plan.daysLeft} days left)` : ""}. After that,
                continued listing access requires a paid seller plan.
              </>
            )}
          </p>
          {expired && (
            <Link to="/seller/renew" className="btn-primary !py-1.5 !px-3 text-xs mt-3 inline-flex">
              Renew seller plan
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ListingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="section-title !text-base mb-3">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ListingRow({
  image,
  title,
  subtitle,
  onDelete,
}: {
  image: string;
  title: string;
  subtitle: string;
  onDelete: () => void;
}) {
  return (
    <div className="card-base flex items-center gap-3 p-3">
      <img src={image} alt={title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{title}</p>
        <p className="text-xs text-ink-soft">{subtitle}</p>
      </div>
      <button onClick={onDelete} className="p-2 text-ink-soft hover:text-red-600" aria-label="Delete">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
