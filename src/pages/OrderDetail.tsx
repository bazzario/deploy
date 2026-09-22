import { Link, useParams } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useOrders } from "../store/OrdersStore";
import { formatPKR } from "../lib/format";

export default function OrderDetail() {
  const { id } = useParams();
  const { findOrder, cancelOrder } = useOrders();
  const order = id ? findOrder(id) : undefined;

  if (!order) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-ink-soft">This order could not be found.</p>
        <Link to="/orders" className="btn-primary mt-4 inline-flex">Back to Orders</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-8 max-w-2xl">
      <div className="flex items-center gap-1 text-xs text-ink-soft mb-4">
        <Link to="/orders" className="hover:text-brand-600">Orders</Link>
        <ChevronRight size={12} />
        <span className="text-ink">{order.id}</span>
      </div>

      <div className="card-base p-5 text-center">
        <CheckCircle2 size={36} className="mx-auto text-green-600" />
        <h1 className="font-display font-bold text-xl text-ink mt-3">Order {order.status}</h1>
        <p className="text-sm text-ink-soft mt-1">
          Order number <span className="font-semibold text-ink">{order.id}</span>
        </p>
        <p className="text-xs text-ink-soft mt-2">
          {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="card-base p-4 mt-4">
        <h2 className="font-semibold text-ink mb-3">Items</h2>
        <div className="flex flex-col gap-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <img
                src={item.image}
                alt={item.title}
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-surface-alt"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink line-clamp-2">{item.title}</p>
                <p className="text-xs text-ink-soft mt-0.5">Qty: {item.qty}</p>
              </div>
              <span className="text-sm font-medium text-ink flex-shrink-0">
                {formatPKR(item.price * item.qty)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-surface-border mt-4 pt-3">
          <SummaryRow label="Subtotal" value={formatPKR(order.subtotal)} />
          <SummaryRow
            label="Delivery"
            value={order.delivery === 0 ? "Free" : formatPKR(order.delivery)}
          />
          <div className="flex items-center justify-between font-display font-bold text-ink pt-2">
            <span>Total</span>
            <span>{formatPKR(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="card-base p-4 mt-4">
        <h2 className="font-semibold text-ink mb-2">Delivery details</h2>
        <p className="text-sm text-ink">{order.customer.name}</p>
        <p className="text-sm text-ink-soft">{order.customer.phone}</p>
        {order.customer.email && <p className="text-sm text-ink-soft">{order.customer.email}</p>}
        <p className="text-sm text-ink-soft mt-1">
          {order.customer.address}, {order.customer.city}
        </p>
        {order.customer.notes && (
          <p className="text-xs text-ink-soft mt-2">Note: {order.customer.notes}</p>
        )}
        <p className="text-sm text-ink-soft mt-3">
          Payment: <span className="text-ink font-medium">{order.paymentMethod}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <Link to="/products" className="btn-primary flex-1">Continue shopping</Link>
        {order.status !== "Cancelled" && order.status !== "Delivered" && (
          <button
            onClick={() => {
              if (confirm("Cancel this order?")) void cancelOrder(order.id);
            }}
            className="btn-secondary flex-1"
          >
            Cancel order
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-ink-soft py-1">
      <span>{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
