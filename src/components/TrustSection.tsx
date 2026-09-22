import { Truck, ShieldCheck, Wallet, Headset } from "lucide-react";
import { site } from "../config/site";

/**
 * Yeh section sirf wahi claims dikhata hai jo `src/config/site.ts` mein set hain.
 * Jo policy actually exist nahi karti, usay config mein khaali/null rakhein —
 * card apne aap hide ho jayega.
 */
export default function TrustSection() {
  const { deliveryPromise, paymentMethods, supportPromise, returnDays } = site.policies;

  const points = [
    deliveryPromise && {
      icon: Truck,
      title: "Delivery",
      desc: deliveryPromise,
    },
    paymentMethods.length > 0 && {
      icon: Wallet,
      title: "Payment options",
      desc: `${paymentMethods.join(", ")} accepted.`,
    },
    returnDays !== null && {
      icon: ShieldCheck,
      title: `${returnDays}-day returns`,
      desc: "Naye products par returns, terms ke mutabiq.",
    },
    supportPromise && {
      icon: Headset,
      title: "Support",
      desc: supportPromise,
    },
  ].filter(Boolean) as { icon: typeof Truck; title: string; desc: string }[];

  if (points.length === 0) return null;

  return (
    <section className="bg-white border-y border-surface-border py-10 sm:py-12">
      <div className="container-page">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {points.map((p) => (
            <div key={p.title} className="flex flex-col sm:items-start">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3">
                <p.icon size={20} />
              </div>
              <h3 className="font-semibold text-sm text-ink">{p.title}</h3>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
