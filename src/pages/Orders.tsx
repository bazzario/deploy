import { Link } from "react-router-dom";
import { PackageSearch, ChevronRight } from "lucide-react";
import { useOrders } from "../store/OrdersStore";
import { formatPKR } from "../lib/format";

export default function Orders() {
  const { orders } = useOrders();

  if (orders.length === 0) {
    return (
      <div className="container-page py-16 sm:py-24 text-center">
        <PackageSearch size={40} className="mx-auto text-ink-soft" />
        <h1 className="font-display font-bold text-xl text-ink mt-4">No orders yet</h1>
        <p className="text-sm text-ink-soft mt-1.5">
          Orders you place will appear here.
        </p>
        <Link to="/products" className="btn-primary mt-6 inline-flex">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-ink mb-6">Your Orders</h1>
      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="card-base p-4 flex items-center gap-3 hover:border-brand-400"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-ink">{order.id}</span>
                <span className="chip">{order.status}</span>
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {new Date(order.createdAt).toLocaleDateString()} &middot;{" "}
                {order.items.length} item{order.items.length > 1 ? "s" : ""} &middot;{" "}
                {formatPKR(order.total)}
              </p>
            </div>
            <ChevronRight size={18} className="text-ink-soft flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
