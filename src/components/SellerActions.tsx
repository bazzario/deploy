import { useState } from "react";
import { Phone, MessageCircle, HandCoins, X, Copy, Check } from "lucide-react";
import { formatPKR } from "../lib/format";

/** "0300 1234567" ya "+92 300 1234567" ko wa.me format (923001234567) mein badalta hai. */
export function toWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}

interface Props {
  sellerName: string;
  phone?: string;
  itemTitle: string;
  price: number;
  /** Used items par Make Offer dikhana hai ya nahi. */
  allowOffers?: boolean;
  /** Listing ka public URL text mein bhejne ke liye. */
  listingUrl?: string;
}

export default function SellerActions({
  sellerName,
  phone,
  itemTitle,
  price,
  allowOffers = false,
  listingUrl,
}: Props) {
  const [offerOpen, setOfferOpen] = useState(false);
  const hasPhone = Boolean(phone && toWhatsAppNumber(phone));
  const waNumber = phone ? toWhatsAppNumber(phone) : "";
  const url = listingUrl ?? (typeof window !== "undefined" ? window.location.href : "");

  const defaultMessage = `Hi, I'm interested in your listing "${itemTitle}" (${formatPKR(
    price
  )}) on Bazaario. Is it still available?${url ? `\n${url}` : ""}`;

  if (!hasPhone) {
    return (
      <div className="mt-5">
        <div className="card-base p-4 text-center">
          <p className="text-sm text-ink font-medium">Contact details not available</p>
          <p className="text-xs text-ink-soft mt-1">
            {sellerName} hasn't added a phone number for this listing yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <a href={`tel:${phone}`} className="btn-secondary flex-1 min-w-[140px] !py-3 text-sm">
          <Phone size={16} /> Call Seller
        </a>
        <a
          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(defaultMessage)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 min-w-[140px] !py-3 text-sm"
        >
          <MessageCircle size={16} /> Message
        </a>
        {allowOffers && (
          <button
            onClick={() => setOfferOpen(true)}
            className="btn-secondary flex-1 min-w-[140px] !py-3 text-sm"
          >
            <HandCoins size={16} /> Make Offer
          </button>
        )}
      </div>

      {offerOpen && (
        <OfferModal
          sellerName={sellerName}
          itemTitle={itemTitle}
          price={price}
          waNumber={waNumber}
          url={url}
          onClose={() => setOfferOpen(false)}
        />
      )}
    </>
  );
}

function OfferModal({
  sellerName,
  itemTitle,
  price,
  waNumber,
  url,
  onClose,
}: {
  sellerName: string;
  itemTitle: string;
  price: number;
  waNumber: string;
  url: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(Math.round(price * 0.9));
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const message = `Hi ${sellerName}, my offer for "${itemTitle}" is ${formatPKR(
    amount
  )}.${note.trim() ? `\n${note.trim()}` : ""}${url ? `\n${url}` : ""}`;

  const valid = amount > 0;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-ink">Make an Offer</h3>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <p className="text-xs text-ink-soft">
          Asking price: <span className="font-semibold text-ink">{formatPKR(price)}</span>
        </p>

        <label className="block mt-4">
          <span className="text-xs font-medium text-ink-soft mb-1 block">Your offer (Rs.)</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input-base"
          />
        </label>

        <label className="block mt-3">
          <span className="text-xs font-medium text-ink-soft mb-1 block">Message (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="When can you pick it up, any questions…"
            className="input-base resize-none"
          />
        </label>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={copyMessage} className="btn-secondary flex-1">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={valid ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className={`btn-primary flex-1 ${valid ? "" : "pointer-events-none opacity-50"}`}
          >
            Send offer
          </a>
        </div>

        <p className="text-[11px] text-ink-soft mt-3 text-center">
          Your offer will be sent to the seller via WhatsApp.
        </p>
      </div>
    </div>
  );
}
