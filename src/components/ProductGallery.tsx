import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

/**
 * Product detail images: one large main image plus a thumbnail row.
 * Works with any mix of Supabase Storage and external URLs. `images[0]` is the
 * primary image and is what shows first. Give it `key={product.id}` so the
 * selection resets when the shown product changes.
 */
export default function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const list = images.length > 0 ? images : [""];
  const index = Math.min(active, list.length - 1);
  const current = list[index];
  const multiple = list.length > 1;

  const markBroken = (url: string) => setBroken((b) => (b[url] ? b : { ...b, [url]: true }));
  const go = (delta: number) => setActive((index + delta + list.length) % list.length);

  return (
    <div>
      <div className="relative rounded-xl2 overflow-hidden border border-surface-border bg-white aspect-square">
        {current && !broken[current] ? (
          <img
            src={current}
            alt={multiple ? `${title} (image ${index + 1} of ${list.length})` : title}
            onError={() => markBroken(current)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-ink-soft bg-surface-alt">
            <ImageOff size={28} />
            <span className="text-xs">Image unavailable</span>
          </div>
        )}

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-card flex items-center justify-center text-ink hover:text-brand-600"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-card flex items-center justify-center text-ink hover:text-brand-600"
            >
              <ChevronRight size={18} />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 text-white text-[11px] font-medium px-2.5 py-1 tabular-nums">
              {index + 1} / {list.length}
            </span>
          </>
        )}
      </div>

      {multiple && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Product images">
          {list.map((url, i) => (
            <button
              key={`${i}-${url}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setActive(i)}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 bg-surface-alt transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                i === index ? "border-brand-500" : "border-transparent hover:border-brand-400/60"
              }`}
            >
              {broken[url] ? (
                <span className="w-full h-full flex items-center justify-center text-ink-soft">
                  <ImageOff size={16} />
                </span>
              ) : (
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  onError={() => markBroken(url)}
                  className={`w-full h-full object-cover ${i === index ? "" : "opacity-80 hover:opacity-100"}`}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
