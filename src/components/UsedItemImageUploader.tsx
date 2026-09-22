import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ImageOff, ImagePlus, Loader2, RotateCcw, Star, X } from "lucide-react";
import { useAuth } from "../store/AuthStore";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  describeUploadError,
  removeProductImageFiles,
  uploadProductImage,
  validateImageFile,
} from "../lib/productImages";

/**
 * Photo uploader for the Used Product form.
 *
 * It is a slimmer front-end for the SAME upload system the New Product form uses:
 * every file goes through lib/productImages.ts (validation, session check, unique
 * file names, the existing `product-images` bucket and its existing Storage policies).
 * Only the limits and layout differ: max 4 photos, no "add by URL", no reordering.
 */

const MAX_USED_ITEM_IMAGES = 4;
const maxMb = MAX_IMAGE_BYTES / (1024 * 1024);

/** One slot in the gallery. Order in the list = display order; the first ready image is the main photo. */
type Tile =
  | { id: string; kind: "ready"; url: string; broken?: boolean }
  | { id: string; kind: "uploading"; name: string; preview: string; progress: number; file: File }
  | { id: string; kind: "failed"; name: string; preview: string; error: string; file: File };

type Notice = { tone: "error" | "warn"; lines: string[] };

let tileCounter = 0;
const nextTileId = () => `used-img-${Date.now().toString(36)}-${(tileCounter += 1)}`;

interface Props {
  /** Draft id of the listing — uploads go to products/<user-id>/<draftId>/ (the path the existing Storage policy allows). */
  draftId: string;
  /** Called with the finished image URLs, in display order (first = main photo). */
  onChange: (urls: string[]) => void;
  /** True while any upload is still running, so the form can hold back "Publish". */
  onBusyChange?: (busy: boolean) => void;
  /** Called when the first file of a draft starts uploading (the form uses it to clean up if abandoned). */
  onUploadStart?: () => void;
  /** Locks the uploader (e.g. while the listing is being saved) so files can't be removed mid-publish. */
  disabled?: boolean;
}

export default function UsedItemImageUploader({ draftId, onChange, onBusyChange, onUploadStart, disabled = false }: Props) {
  const { user, ensureSession } = useAuth();
  // Whether the login is still valid is checked against the Auth server at upload time
  // (ensureSession), not guessed from local state — so the dropzone only needs a user.
  const canUpload = isSupabaseConfigured && Boolean(user);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const tilesRef = useRef<Tile[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dropActive, setDropActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const abortersRef = useRef(new Map<string, AbortController>());

  // Latest values for use inside async callbacks without re-creating them.
  const ensureSessionRef = useRef(ensureSession);
  ensureSessionRef.current = ensureSession;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  const cbRef = useRef({ onChange, onBusyChange, onUploadStart });
  cbRef.current = { onChange, onBusyChange, onUploadStart };
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  /** Every change goes through here so async code always builds on the newest list. */
  const commit = useCallback((fn: (prev: Tile[]) => Tile[]) => {
    const next = fn(tilesRef.current);
    tilesRef.current = next;
    setTiles(next);
  }, []);

  const readyUrls = useMemo(() => tiles.flatMap((t) => (t.kind === "ready" ? [t.url] : [])), [tiles]);
  const readyKey = readyUrls.join("\n");
  const uploadingCount = tiles.filter((t) => t.kind === "uploading").length;
  const slotsUsed = tiles.filter((t) => t.kind !== "failed").length;
  const atLimit = slotsUsed >= MAX_USED_ITEM_IMAGES;
  const primaryId = tiles.find((t) => t.kind === "ready")?.id;
  const dropEnabled = canUpload && !disabled;

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
      aborters.forEach((a) => a.abort());
      aborters.clear();
      tilesRef.current.forEach((t) => {
        if (t.kind !== "ready") URL.revokeObjectURL(t.preview);
      });
    };
  }, []);

  /* ------------------------------ uploading ------------------------------ */

  /** Deletes one of our own uploaded files, using a session the server has just confirmed. */
  async function removeUploaded(url: string): Promise<number> {
    const session = await ensureSessionRef.current();
    return removeProductImageFiles(draftIdRef.current, session.userId, [url], session.accessToken);
  }

  async function runUpload(tile: Extract<Tile, { kind: "uploading" }>) {
    const controller = new AbortController();
    abortersRef.current.set(tile.id, controller);
    let lastPercent = -1;
    try {
      // uploadProductImage confirms the session with Supabase first (refreshing it if it
      // expired) and builds a unique path under the signed-in user's own folder.
      const { url } = await uploadProductImage(draftIdRef.current, tile.file, {
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
      commit((prev) => prev.map((t) => (t.id === tile.id ? { id: t.id, kind: "ready", url } : t)));
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
    }
  }

  async function addFiles(files: File[]) {
    if (files.length === 0 || disabledRef.current) return;
    if (!canUpload) {
      setNotice({
        tone: "warn",
        lines: ["Uploading needs a connected Supabase project and a signed-in account."],
      });
      return;
    }

    const checked = await Promise.all(files.map(async (file) => ({ file, problem: await validateImageFile(file) })));
    const problems = checked.flatMap((c) => (c.problem ? [c.problem] : []));
    const valid = checked.flatMap((c) => (c.problem ? [] : [c.file]));

    // Read the slot count only now — the list may have changed while files were being checked.
    const room = Math.max(0, MAX_USED_ITEM_IMAGES - tilesRef.current.filter((t) => t.kind !== "failed").length);
    const accepted = valid.slice(0, room);
    const skipped = valid.length - accepted.length;
    const lines = [...problems];
    if (skipped > 0) {
      lines.push(
        room === 0
          ? `You already have ${MAX_USED_ITEM_IMAGES} images. Remove one to add another.`
          : `Only ${room} more image${room === 1 ? "" : "s"} fit (max ${MAX_USED_ITEM_IMAGES}). ${skipped} file${skipped === 1 ? " was" : "s were"} skipped.`
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
    // At most MAX_USED_ITEM_IMAGES tiles exist, so every upload can start right away.
    created.forEach((t) => {
      if (t.kind === "uploading") void runUpload(t);
    });
  }

  function retry(tile: Extract<Tile, { kind: "failed" }>) {
    if (disabledRef.current) return;
    if (tilesRef.current.filter((t) => t.kind !== "failed").length >= MAX_USED_ITEM_IMAGES) {
      setNotice({
        tone: "warn",
        lines: [`You already have ${MAX_USED_ITEM_IMAGES} images. Remove one to retry this upload.`],
      });
      return;
    }
    setNotice(null);
    const uploading: Extract<Tile, { kind: "uploading" }> = {
      id: tile.id,
      kind: "uploading",
      name: tile.name,
      preview: tile.preview,
      progress: 0,
      file: tile.file,
    };
    commit((prev) => prev.map((t) => (t.id === tile.id ? uploading : t)));
    void runUpload(uploading);
  }

  /* ------------------------------ tile actions ------------------------------ */

  function removeTile(tile: Tile) {
    if (disabledRef.current) return;
    if (tile.kind === "uploading") abortersRef.current.get(tile.id)?.abort();
    if (tile.kind !== "ready") URL.revokeObjectURL(tile.preview);
    commit((prev) => prev.filter((t) => t.id !== tile.id));
    setNotice(null);

    if (tile.kind === "ready") {
      // Uploaded photos live in our bucket: delete the file too, not just the reference.
      const warn = () =>
        setNotice({
          tone: "warn",
          lines: ["Image removed, but its stored file couldn't be deleted right now. We'll try again when you publish."],
        });
      removeUploaded(tile.url)
        .then((removed) => removed === 0 && warn())
        .catch(warn);
    }
  }

  function markBroken(id: string) {
    commit((prev) => prev.map((t) => (t.id === id && t.kind === "ready" ? { ...t, broken: true } : t)));
  }

  /* ------------------------- drag & drop on the dropzone ------------------------- */

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }

  function openPicker() {
    if (!dropEnabled || atLimit) return;
    fileInputRef.current?.click();
  }

  /* --------------------------------- render --------------------------------- */

  const dropTitle = !canUpload
    ? "Uploads are unavailable right now"
    : atLimit
      ? `Image limit reached (${MAX_USED_ITEM_IMAGES})`
      : "Drag & drop images here";
  const dropHint = !canUpload ? "Sign in with a connected Supabase project to upload" : atLimit ? "Remove an image to add another" : "or click to browse";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-xs font-medium text-ink-soft">
          Photos <span className="text-red-500">*</span>
        </span>
        <span className="text-[11px] text-ink-soft">First photo is the main photo</span>
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

      {/* The dropzone is a plain container (not a button), so drag events always reach it. */}
      <div
        role="button"
        tabIndex={dropEnabled && !atLimit ? 0 : -1}
        aria-disabled={!dropEnabled || atLimit}
        aria-label={`Upload photos. ${slotsUsed} of ${MAX_USED_ITEM_IMAGES} added. JPG, PNG or WEBP, up to ${maxMb} MB each.`}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepthRef.current += 1;
          if (dropEnabled) setDropActive(true);
        }}
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault(); // required, otherwise the browser never fires `drop`
          e.dataTransfer.dropEffect = dropEnabled && !atLimit ? "copy" : "none";
        }}
        onDragLeave={(e) => {
          if (!hasFiles(e)) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDropActive(false);
        }}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepthRef.current = 0;
          setDropActive(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`w-full rounded-xl border-2 border-dashed py-6 px-4 flex flex-col items-center gap-1.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
          dropActive && !atLimit
            ? "border-brand-400 bg-brand-50"
            : dropEnabled && !atLimit
              ? "border-surface-border cursor-pointer hover:border-brand-400 hover:bg-brand-50/40"
              : "border-surface-border cursor-default"
        }`}
      >
        <span className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
          <ImagePlus size={20} />
        </span>
        <span className="text-sm font-semibold text-ink">{dropTitle}</span>
        <span className="text-[11px] text-ink-soft">{dropHint}</span>
        <span
          className={`chip tabular-nums mt-1 ${atLimit ? "!bg-brand-50 !border-brand-100 !text-brand-600" : ""}`}
          aria-live="polite"
        >
          {slotsUsed}/{MAX_USED_ITEM_IMAGES} images
        </span>
        <span className="text-[11px] text-ink-soft">JPG, PNG or WEBP · up to {maxMb} MB each</span>
      </div>

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
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="flex-shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {tiles.length > 0 && (
        <div className="mt-3 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {tiles.map((tile, index) => (
            <div
              key={tile.id}
              className={`relative aspect-square rounded-xl overflow-hidden border bg-surface-alt ${
                tile.kind === "failed"
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
                      alt={`Photo ${index + 1}`}
                      draggable={false}
                      onError={() => markBroken(tile.id)}
                      className="w-full h-full object-cover select-none"
                    />
                  )}
                  {tile.id === primaryId && (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-brand-500 text-white text-[11px] font-semibold px-2.5 py-1 shadow-card">
                      <Star size={11} className="fill-white" /> Main
                    </span>
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
                  <div
                    className="absolute bottom-0 inset-x-0 h-1.5 bg-black/10"
                    role="progressbar"
                    aria-label={`Uploading ${tile.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={tile.progress}
                  >
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
                    disabled={disabled}
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-red-200 text-red-700 text-[11px] font-semibold px-2.5 py-1 hover:bg-red-100 disabled:opacity-50"
                  >
                    <RotateCcw size={11} /> Retry
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => removeTile(tile)}
                disabled={disabled}
                aria-label={
                  tile.kind === "ready"
                    ? `Remove photo ${index + 1}`
                    : tile.kind === "uploading"
                      ? `Cancel upload of ${tile.name}`
                      : `Dismiss failed upload of ${tile.name}`
                }
                title={tile.kind === "uploading" ? "Cancel upload" : "Remove"}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-white/95 shadow-card flex items-center justify-center text-ink-soft hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
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
