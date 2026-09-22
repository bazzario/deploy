import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  GripVertical,
  ImageOff,
  ImagePlus,
  Link2,
  Loader2,
  RotateCcw,
  Star,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../store/AuthStore";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  describeUploadError,
  normalizeImageUrl,
  removeProductImageFiles,
  uploadProductImage,
  urlKey,
  validateImageFile,
  verifyImageLoads,
} from "../lib/productImages";

/** One slot in the gallery. Order in the list = display order; the first ready image is the primary one. */
type Tile =
  | { id: string; kind: "ready"; url: string; source: "upload" | "url"; broken?: boolean }
  | { id: string; kind: "uploading"; name: string; preview: string; progress: number; file: File }
  | { id: string; kind: "failed"; name: string; preview: string; error: string; file: File };

type UrlState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; url: string }
  | { status: "invalid"; error: string };

type Notice = { tone: "error" | "warn"; lines: string[] };

const MAX_PARALLEL_UPLOADS = 3;
const maxMb = MAX_IMAGE_BYTES / (1024 * 1024);

let tileCounter = 0;
const nextTileId = () => `img-${Date.now().toString(36)}-${(tileCounter += 1)}`;

interface Props {
  /** Id the product will be saved with — uploads go to products/<productId>/. */
  productId: string;
  /** Called with the finished image URLs, in display order (first = primary). */
  onChange: (urls: string[]) => void;
  /** True while any upload is still running, so the form can hold back "Publish". */
  onBusyChange?: (busy: boolean) => void;
  /** Called when the first file of a draft starts uploading (the form uses it to clean up if abandoned). */
  onUploadStart?: () => void;
}

export default function ProductImageManager({ productId, onChange, onBusyChange, onUploadStart }: Props) {
  const { user, ensureSession } = useAuth();
  // Whether the login is still valid is checked against the Auth server at upload time
  // (ensureSession), not guessed from local state — so the buttons only need a user.
  const canUpload = isSupabaseConfigured && Boolean(user);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const tilesRef = useRef<Tile[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [fileDropActive, setFileDropActive] = useState(false);

  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlState, setUrlState] = useState<UrlState>({ status: "idle" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const abortersRef = useRef(new Map<string, AbortController>());
  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(0);

  // Latest values for use inside async callbacks without re-creating them.
  const ensureSessionRef = useRef(ensureSession);
  ensureSessionRef.current = ensureSession;
  const productIdRef = useRef(productId);
  productIdRef.current = productId;
  const cbRef = useRef({ onChange, onBusyChange, onUploadStart });
  cbRef.current = { onChange, onBusyChange, onUploadStart };

  /** Every change goes through here so async code always builds on the newest list. */
  const commit = useCallback((fn: (prev: Tile[]) => Tile[]) => {
    const next = fn(tilesRef.current);
    tilesRef.current = next;
    setTiles(next);
  }, []);

  const readyUrls = useMemo(
    () => tiles.flatMap((t) => (t.kind === "ready" ? [t.url] : [])),
    [tiles]
  );
  const readyKey = readyUrls.join("\n");
  const uploadingCount = tiles.filter((t) => t.kind === "uploading").length;
  const slotsUsed = tiles.filter((t) => t.kind !== "failed").length;
  const atLimit = slotsUsed >= MAX_PRODUCT_IMAGES;
  const primaryId = tiles.find((t) => t.kind === "ready")?.id;

  // Tell the form what the gallery contains — only when the finished list really changed.
  useEffect(() => {
    cbRef.current.onChange(readyUrls);
  }, [readyKey]); // eslint-disable-line

  useEffect(() => {
    cbRef.current.onBusyChange?.(uploadingCount > 0);
  }, [uploadingCount]);

  // Leaving the page: stop running uploads and free the local preview URLs.
  useEffect(() => {
    const aborters = abortersRef.current;
    return () => {
      queueRef.current = []; // nothing new may start once the form is gone
      aborters.forEach((a) => a.abort());
      aborters.clear();
      tilesRef.current.forEach((t) => {
        if (t.kind !== "ready") URL.revokeObjectURL(t.preview);
      });
    };
  }, []);

  /* ------------------------------ uploading ------------------------------ */

  const pump = useCallback(() => {
    while (runningRef.current < MAX_PARALLEL_UPLOADS && queueRef.current.length > 0) {
      const id = queueRef.current.shift() as string;
      const tile = tilesRef.current.find((t) => t.id === id);
      if (!tile || tile.kind !== "uploading") continue;
      runningRef.current += 1;
      void runUpload(tile);
    }
  }, []); // eslint-disable-line

  /** Deletes one of our own uploaded files, using a session the server has just confirmed. */
  async function removeUploaded(url: string): Promise<number> {
    const session = await ensureSessionRef.current();
    return removeProductImageFiles(productIdRef.current, session.userId, [url], session.accessToken);
  }

  async function runUpload(tile: Extract<Tile, { kind: "uploading" }>) {
    const controller = new AbortController();
    abortersRef.current.set(tile.id, controller);
    let lastPercent = -1;
    try {
      // uploadProductImage confirms the session with Supabase first and refreshes it if
      // it expired; a missing/expired login surfaces as its own message.
      const { url } = await uploadProductImage(productIdRef.current, tile.file, {
        getSession: (options) => ensureSessionRef.current(options),
        signal: controller.signal,
        onProgress: (fraction) => {
          const percent = Math.round(fraction * 100);
          if (percent === lastPercent) return;
          lastPercent = percent;
          commit((prev) =>
            prev.map((t) => (t.id === tile.id && t.kind === "uploading" ? { ...t, progress: percent } : t))
          );
        },
      });

      if (!tilesRef.current.some((t) => t.id === tile.id)) {
        // Removed while the last bytes were in flight: don't leave the file behind.
        void removeUploaded(url).catch(() => {});
        return;
      }
      URL.revokeObjectURL(tile.preview);
      commit((prev) =>
        prev.map((t) => (t.id === tile.id ? { id: t.id, kind: "ready", url, source: "upload" } : t))
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const reason = describeUploadError(err);
      commit((prev) =>
        prev.map((t) =>
          t.id === tile.id
            ? { id: t.id, kind: "failed", name: tile.name, preview: tile.preview, error: reason, file: tile.file }
            : t
        )
      );
      // The tile only has room for a few words; show the full reason above the grid.
      setNotice({ tone: "error", lines: [`${tile.name}: ${reason}`] });
    } finally {
      abortersRef.current.delete(tile.id);
      runningRef.current -= 1;
      pump();
    }
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    if (!canUpload) {
      setNotice({ tone: "warn", lines: ["Uploading needs a connected Supabase project. You can still add images by URL."] });
      return;
    }

    const checked = await Promise.all(files.map(async (file) => ({ file, problem: await validateImageFile(file) })));
    const problems = checked.flatMap((c) => (c.problem ? [c.problem] : []));
    const valid = checked.flatMap((c) => (c.problem ? [] : [c.file]));

    // Read the slot count only now — the list may have changed while files were being checked.
    const room = Math.max(0, MAX_PRODUCT_IMAGES - tilesRef.current.filter((t) => t.kind !== "failed").length);
    const accepted = valid.slice(0, room);
    const lines = [...problems];
    if (valid.length > accepted.length) {
      lines.push(
        room === 0
          ? `You already have ${MAX_PRODUCT_IMAGES} images. Remove one to add another.`
          : `Only ${room} more image${room === 1 ? "" : "s"} fit (max ${MAX_PRODUCT_IMAGES}). ${valid.length - accepted.length} file${valid.length - accepted.length === 1 ? " was" : "s were"} skipped.`
      );
    }
    setNotice(lines.length ? { tone: problems.length ? "error" : "warn", lines } : null);
    if (accepted.length === 0) return;

    cbRef.current.onUploadStart?.();
    const created: Tile[] = accepted.map((file) => ({
      id: nextTileId(),
      kind: "uploading",
      name: file.name,
      preview: URL.createObjectURL(file),
      progress: 0,
      file,
    }));
    commit((prev) => [...prev, ...created]);
    queueRef.current.push(...created.map((t) => t.id));
    pump();
  }

  function retry(tile: Extract<Tile, { kind: "failed" }>) {
    if (tilesRef.current.filter((t) => t.kind !== "failed").length >= MAX_PRODUCT_IMAGES) {
      setNotice({ tone: "warn", lines: [`You already have ${MAX_PRODUCT_IMAGES} images. Remove one to retry this upload.`] });
      return;
    }
    setNotice(null);
    commit((prev) =>
      prev.map((t) =>
        t.id === tile.id ? { id: t.id, kind: "uploading", name: tile.name, preview: tile.preview, progress: 0, file: tile.file } : t
      )
    );
    queueRef.current.push(tile.id);
    pump();
  }

  /* ------------------------------ tile actions ------------------------------ */

  function removeTile(tile: Tile) {
    if (tile.kind === "uploading") abortersRef.current.get(tile.id)?.abort();
    if (tile.kind !== "ready") URL.revokeObjectURL(tile.preview);
    commit((prev) => prev.filter((t) => t.id !== tile.id));
    setNotice(null);

    if (tile.kind === "ready" && tile.source === "upload") {
      // Uploaded photos live in our bucket: delete the file too, not just the reference.
      const warn = () =>
        setNotice({
          tone: "warn",
          lines: ["Image removed from the listing, but its stored file couldn't be deleted right now. We'll try again when you publish."],
        });
      removeUploaded(tile.url)
        .then((removed) => removed === 0 && warn())
        .catch(warn);
    }
  }

  function setPrimary(id: string) {
    commit((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index <= 0) return prev;
      const next = prev.slice();
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
  }

  function moveTile(fromId: string, toId: string) {
    commit((prev) => {
      const from = prev.findIndex((t) => t.id === fromId);
      const to = prev.findIndex((t) => t.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function moveBy(id: string, delta: number) {
    const list = tilesRef.current;
    const from = list.findIndex((t) => t.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    moveTile(id, list[to].id);
    // Moving a node in the DOM can drop keyboard focus; put it back on the same handle.
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"] [data-handle]`)?.focus()
    );
  }

  function markBroken(id: string) {
    commit((prev) => prev.map((t) => (t.id === id && t.kind === "ready" ? { ...t, broken: true } : t)));
  }

  /* --------------------------- drag to reorder --------------------------- */

  // Pointer events cover mouse, touch and pen with one code path. Listeners live on
  // `window` for the length of a drag: React moves DOM nodes while items reorder,
  // which would release pointer capture on the handle mid-drag.
  useEffect(() => {
    if (!dragId) return;

    function tileIdAt(x: number, y: number): string | null {
      const nodes = gridRef.current?.querySelectorAll<HTMLElement>("[data-tile-id]");
      if (!nodes) return null;
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return node.dataset.tileId ?? null;
      }
      return null;
    }
    const onMove = (e: PointerEvent) => {
      const overId = tileIdAt(e.clientX, e.clientY);
      if (overId && overId !== dragId) moveTile(dragId as string, overId);
    };
    const end = () => setDragId(null);

    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      document.body.style.userSelect = previousSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragId]); // eslint-disable-line

  /* ------------------------------ image URLs ------------------------------ */

  const isDuplicate = useCallback(
    (url: string) => {
      const key = urlKey(url);
      return tilesRef.current.some((t) => t.kind === "ready" && urlKey(t.url) === key);
    },
    []
  );

  // Check the typed link a moment after typing stops: format, duplicate, then a real load.
  useEffect(() => {
    if (!urlOpen) return;
    const raw = urlValue.trim();
    if (!raw) {
      setUrlState({ status: "idle" });
      return;
    }
    setUrlState({ status: "checking" });
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const check = normalizeImageUrl(raw);
      if (!check.ok) {
        if (!cancelled) setUrlState({ status: "invalid", error: check.error });
        return;
      }
      if (isDuplicate(check.url)) {
        if (!cancelled) setUrlState({ status: "invalid", error: "This image is already in the gallery." });
        return;
      }
      try {
        await verifyImageLoads(check.url);
        if (!cancelled) setUrlState({ status: "valid", url: check.url });
      } catch (err) {
        if (!cancelled) setUrlState({ status: "invalid", error: err instanceof Error ? err.message : "That link isn't a valid image." });
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [urlValue, urlOpen, isDuplicate]);

  function addUrl() {
    if (urlState.status !== "valid") return;
    if (tilesRef.current.filter((t) => t.kind !== "failed").length >= MAX_PRODUCT_IMAGES) {
      setUrlState({ status: "invalid", error: `You already have ${MAX_PRODUCT_IMAGES} images.` });
      return;
    }
    if (isDuplicate(urlState.url)) {
      setUrlState({ status: "invalid", error: "This image is already in the gallery." });
      return;
    }
    const url = urlState.url;
    commit((prev) => [...prev, { id: nextTileId(), kind: "ready", url, source: "url" }]);
    setNotice(null);
    setUrlValue("");
    setUrlState({ status: "idle" });
    urlInputRef.current?.focus();
  }

  function toggleUrlPanel() {
    setUrlOpen((open) => !open);
    setUrlValue("");
    setUrlState({ status: "idle" });
  }

  useEffect(() => {
    if (urlOpen) urlInputRef.current?.focus();
  }, [urlOpen]);

  /* ------------------------ dropping files onto the box ------------------------ */

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }

  /* --------------------------------- render --------------------------------- */

  const empty = tiles.length === 0;

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-colors ${
        fileDropActive ? "border-brand-400 bg-brand-50" : "border-surface-border bg-white"
      }`}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setFileDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileDropActive(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setFileDropActive(false);
        void addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-soft">
            Product images <span className="text-red-500">*</span>
          </p>
          <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">
            The first image is the main photo. Drag the handle to reorder, or use “Set as Primary”.
          </p>
        </div>
        <span
          className={`chip flex-shrink-0 tabular-nums ${atLimit ? "!bg-brand-50 !border-brand-100 !text-brand-600" : ""}`}
          aria-label={`${slotsUsed} of ${MAX_PRODUCT_IMAGES} images`}
        >
          {slotsUsed} / {MAX_PRODUCT_IMAGES}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // lets the same file be picked again later
          void addFiles(files);
        }}
      />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={atLimit || !canUpload}
          title={!canUpload ? "Uploading needs a connected Supabase project" : atLimit ? `Maximum ${MAX_PRODUCT_IMAGES} images` : undefined}
          className="btn-secondary !py-2 !px-4 text-xs disabled:opacity-50 disabled:pointer-events-none"
        >
          <Upload size={14} /> Upload Images
        </button>
        <button
          type="button"
          onClick={toggleUrlPanel}
          disabled={atLimit && !urlOpen}
          aria-expanded={urlOpen}
          title={atLimit && !urlOpen ? `Maximum ${MAX_PRODUCT_IMAGES} images` : undefined}
          className={`btn-secondary !py-2 !px-4 text-xs disabled:opacity-50 disabled:pointer-events-none ${
            urlOpen ? "!border-brand-400 !text-brand-600" : ""
          }`}
        >
          <Link2 size={14} /> Add Image URL
        </button>
        {!canUpload && (
          <span className="text-[11px] text-ink-soft">Uploads are unavailable right now. Adding by URL still works.</span>
        )}
      </div>

      {urlOpen && (
        <div className="mt-3 rounded-lg border border-surface-border bg-surface-alt p-3">
          <div className="flex gap-2">
            <input
              ref={urlInputRef}
              type="url"
              inputMode="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => {
                // Enter must add the image, not submit the whole product form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              placeholder="https://example.com/photo.jpg"
              aria-label="Image URL"
              aria-invalid={urlState.status === "invalid"}
              className="input-base bg-white"
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={urlState.status !== "valid" || atLimit}
              className="btn-primary !py-2 !px-4 text-xs flex-shrink-0"
            >
              Add
            </button>
          </div>

          <div className="mt-2 min-h-[1.25rem]" role="status" aria-live="polite">
            {urlState.status === "checking" && (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                <Loader2 size={13} className="animate-spin" /> Checking the link…
              </p>
            )}
            {urlState.status === "invalid" && (
              <p className="flex items-start gap-1.5 text-[11px] text-red-600">
                <AlertCircle size={13} className="flex-shrink-0 mt-px" /> {urlState.error}
              </p>
            )}
            {urlState.status === "valid" && (
              <div className="flex items-center gap-3">
                <img
                  src={urlState.url}
                  alt="Preview of the image link"
                  className="w-16 h-16 rounded-lg object-cover border border-surface-border bg-white"
                />
                <p className="flex items-center gap-1 text-[11px] font-medium text-green-700">
                  <Check size={13} /> Valid image. Press Add to include it.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed flex items-start gap-2 ${
            notice.tone === "error" ? "bg-red-50 border-red-100 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {notice.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="flex-shrink-0 opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {empty ? (
        <button
          type="button"
          onClick={() => canUpload && fileInputRef.current?.click()}
          disabled={!canUpload}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-surface-border py-8 px-4 flex flex-col items-center gap-2 text-center hover:border-brand-400 hover:bg-brand-50/40 transition-colors disabled:cursor-default disabled:hover:border-surface-border disabled:hover:bg-transparent"
        >
          <span className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
            <ImagePlus size={20} />
          </span>
          <span className="text-sm font-semibold text-ink">
            {canUpload ? "Drop photos here or click to browse" : "Add photos by URL"}
          </span>
          <span className="text-[11px] text-ink-soft">
            JPG, PNG or WEBP · up to {maxMb} MB each · up to {MAX_PRODUCT_IMAGES} images
          </span>
        </button>
      ) : (
        <div ref={gridRef} className="mt-3 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {tiles.map((tile, index) => (
            <div
              key={tile.id}
              data-tile-id={tile.id}
              className={`relative aspect-square rounded-xl overflow-hidden border bg-surface-alt transition-shadow ${
                dragId === tile.id
                  ? "border-brand-400 ring-2 ring-brand-400 shadow-pop z-10"
                  : tile.kind === "failed"
                    ? "border-red-200"
                    : tile.id === primaryId
                      ? "border-brand-400"
                      : "border-surface-border"
              }`}
            >
              {tile.kind === "ready" && (
                <>
                  {tile.broken ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-soft px-2 text-center">
                      <ImageOff size={20} />
                      <span className="text-[10px] leading-tight">Can't load this image</span>
                    </div>
                  ) : (
                    <img
                      src={tile.url}
                      alt={`Product image ${index + 1}`}
                      draggable={false}
                      onError={() => markBroken(tile.id)}
                      className="w-full h-full object-cover select-none"
                    />
                  )}

                  <button
                    type="button"
                    aria-label={`Reorder image ${index + 1} of ${tiles.length}. Drag, or use the arrow keys.`}
                    title="Drag to reorder"
                    data-handle
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse" && e.button !== 0) return;
                      e.preventDefault();
                      setDragId(tile.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                        e.preventDefault();
                        moveBy(tile.id, -1);
                      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                        e.preventDefault();
                        moveBy(tile.id, 1);
                      }
                    }}
                    className={`absolute top-1.5 left-1.5 w-8 h-8 rounded-full bg-white/95 shadow-card flex items-center justify-center text-ink-soft hover:text-brand-600 touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      dragId === tile.id ? "cursor-grabbing" : "cursor-grab"
                    }`}
                  >
                    <GripVertical size={16} />
                  </button>

                  {tile.id === primaryId ? (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-[11px] font-semibold px-2.5 py-1 shadow-card">
                      <Star size={11} className="fill-white" /> Primary
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimary(tile.id)}
                      className="absolute bottom-1.5 inset-x-1.5 inline-flex items-center justify-center gap-1 rounded-full bg-white/95 text-ink text-[11px] font-semibold py-1 shadow-card hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <Star size={11} /> Set as Primary
                    </button>
                  )}
                </>
              )}

              {tile.kind === "uploading" && (
                <>
                  <img src={tile.preview} alt="" draggable={false} className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3">
                    <Loader2 size={20} className="animate-spin text-brand-600" />
                    <span className="text-xs font-semibold text-ink tabular-nums">{tile.progress}%</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/10" role="progressbar" aria-label={`Uploading ${tile.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={tile.progress}>
                    <div className="h-full bg-brand-500 transition-[width] duration-150" style={{ width: `${tile.progress}%` }} />
                  </div>
                </>
              )}

              {tile.kind === "failed" && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center bg-red-50">
                  <AlertCircle size={18} className="text-red-500" />
                  <p className="text-[10px] leading-tight text-red-700 line-clamp-3">{tile.error}</p>
                  <button
                    type="button"
                    onClick={() => retry(tile)}
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-red-200 text-red-700 text-[11px] font-semibold px-2.5 py-1 hover:bg-red-100"
                  >
                    <RotateCcw size={11} /> Retry
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => removeTile(tile)}
                aria-label={
                  tile.kind === "ready"
                    ? `Remove image ${index + 1}`
                    : tile.kind === "uploading"
                      ? `Cancel upload of ${tile.name}`
                      : `Dismiss failed upload of ${tile.name}`
                }
                title={tile.kind === "uploading" ? "Cancel upload" : "Remove"}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-white/95 shadow-card flex items-center justify-center text-ink-soft hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
