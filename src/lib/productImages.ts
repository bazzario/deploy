/**
 * Product image helpers: limits, validation, URL handling, and the Storage
 * upload / cleanup calls used by the Add Product form.
 *
 * Storage layout (policies: supabase/product-images-storage-policies.sql):
 *   <bucket>/products/<seller-uid>/<product-id>/<timestamp>-<random>.<jpg|png|webp>
 * <seller-uid> is the id the Auth server confirmed for the current session — never
 * a value typed in by the client — and the Storage policy requires it to equal
 * auth.uid(). Older uploads live at products/<product-id>/<file> (no seller
 * folder); they stay readable and are still removable by their product's owner.
 * The database only ever stores the resulting public URLs (`products.images`),
 * never file contents.
 */

import type { Product } from "../data/types";
import { SUPABASE_URL, SessionError, SupabaseError, isSupabaseConfigured, storage } from "./supabase";
import type { VerifiedSession } from "../store/AuthStore";

const env = import.meta.env as Record<string, string | undefined>;

/** Storage bucket for product photos. Override with VITE_SUPABASE_PRODUCT_BUCKET. */
export const PRODUCT_IMAGE_BUCKET = (env.VITE_SUPABASE_PRODUCT_BUCKET ?? "").trim() || "product-images";

export const MAX_PRODUCT_IMAGES = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit
export const MAX_IMAGE_URL_LENGTH = 2048; // matches the DB check constraint
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

type ImageMime = "image/jpeg" | "image/png" | "image/webp";
const EXTENSION: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/* ------------------------------ reading data ------------------------------ */

/**
 * Turns whatever the database holds into a clean list of image URLs:
 * the `images` array when present, otherwise the single legacy `image` value.
 * Trims, drops blanks and removes duplicates while keeping order.
 */
export function normalizeImages(images: unknown, legacyImage?: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const url = value.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };
  if (Array.isArray(images)) images.forEach(push);
  if (out.length === 0) push(legacyImage);
  return out;
}

/** All images of a product, primary first. Works for old (single-image) products too. */
export function getProductImages(product: Pick<Product, "image" | "images">): string[] {
  return normalizeImages(product.images, product.image);
}

/** The primary image — what product cards and lists show. */
export function primaryImage(product: Pick<Product, "image" | "images">): string {
  return getProductImages(product)[0] ?? "";
}

/* ------------------------------- id + names ------------------------------- */

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A fresh UUID for a product that is not saved yet, so its photos can be
 * uploaded to products/<id>/ before the row exists. crypto.randomUUID() only
 * exists on https / localhost, so fall back to building a v4 UUID by hand
 * (e.g. when testing on a phone over plain http on the local network).
 */
export function newProductId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const h = randomHex(16).split("");
  h[12] = "4";
  h[16] = "89ab"[parseInt(h[16], 16) % 4];
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/* ----------------------------- file validation ----------------------------- */

/** Detects the real image type from the first bytes, not from the file name. */
export async function sniffImageType(file: Blob): Promise<ImageMime | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
  ) {
    return "image/png";
  }
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** Returns a user-facing problem, or null when the file is fine to upload. */
export async function validateImageFile(file: File): Promise<string | null> {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is ${megabytes(file.size)} MB. Each image can be up to ${megabytes(MAX_IMAGE_BYTES)} MB.`;
  }
  const declared = file.type.toLowerCase();
  if (declared && !(declared in EXTENSION)) {
    return `${file.name} isn't supported. Use a JPG, PNG or WEBP image.`;
  }
  // The declared type and file name can be faked; the bytes cannot.
  if (!(await sniffImageType(file))) {
    return `${file.name} isn't a valid JPG, PNG or WEBP image.`;
  }
  return null;
}

/* ------------------------------- image URLs ------------------------------- */

const UNSUPPORTED_EXTENSIONS = /\.(gif|svg|bmp|tiff?|heic|heif|avif|ico|pdf)$/i;

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Format checks only (no network). Returns the cleaned-up URL when acceptable. */
export function normalizeImageUrl(raw: string): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Enter an image URL." };
  if (/^data:/i.test(value)) {
    return { ok: false, error: "Embedded (base64) images aren't allowed. Upload the file instead." };
  }
  if (value.length > MAX_IMAGE_URL_LENGTH) {
    return { ok: false, error: `That link is too long (max ${MAX_IMAGE_URL_LENGTH} characters).` };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link. It should start with https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only http:// and https:// links are supported." };
  }
  if (url.protocol === "http:" && typeof window !== "undefined" && window.location.protocol === "https:") {
    return { ok: false, error: "Use a secure https:// link. Insecure images are blocked on this site." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Links that contain a username or password aren't allowed." };
  }
  if (UNSUPPORTED_EXTENSIONS.test(url.pathname)) {
    return { ok: false, error: "Only JPG, PNG or WEBP images are supported." };
  }
  return { ok: true, url: url.toString() };
}

/** Comparison key so the same link can't be added twice (ignores #fragment and URL-encoding quirks). */
export function urlKey(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return raw.trim();
  }
}

/** Resolves if the browser can actually load `url` as an image; rejects otherwise. */
export function verifyImageLoads(url: string, timeoutMs = 10000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => {
      img.src = "";
      reject(new Error("The link took too long to respond."));
    }, timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      if (img.naturalWidth > 0) resolve();
      else reject(new Error("That link isn't an image."));
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(
        new Error(
          "Couldn't load an image from that link. Check that it points directly to a public JPG, PNG or WEBP image."
        )
      );
    };
    img.src = url;
  });
}

/* ------------------------------- storage paths ------------------------------ */

/** Object path inside the bucket for a public URL of ours, or null for external URLs. */
export function storagePathFromUrl(url: string): string | null {
  if (!SUPABASE_URL) return null;
  const prefix = storage.publicPrefix(PRODUCT_IMAGE_BUCKET);
  if (!url.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
}

/** True for images that live in our Storage bucket (as opposed to external links). */
export const isStorageImage = (url: string) => storagePathFromUrl(url) !== null;

/** Folders (with trailing slash) that may hold this product's uploaded files. */
function productFolders(productId: string, ownerId?: string): string[] {
  const folders = [`products/${productId}/`]; // legacy layout (no seller folder)
  if (ownerId) folders.unshift(`products/${ownerId}/${productId}/`);
  return folders;
}

/**
 * Only files inside this product's own folder(s) may ever be deleted by the app —
 * even if someone pastes a link to another product's uploaded photo. (Storage
 * policies enforce the same rule server-side; this just avoids pointless requests.)
 */
function ownFolderPaths(productId: string, urls: string[], ownerId?: string): string[] {
  const folders = productFolders(productId, ownerId);
  return urls
    .map(storagePathFromUrl)
    .filter((p): p is string =>
      p !== null &&
      folders.some((folder) => p.startsWith(folder) && !p.slice(folder.length).includes("/"))
    );
}

/* ------------------------------ storage actions ----------------------------- */

/** Confirms/renews the session and returns a token + verified user id (AuthStore.ensureSession). */
export type GetSession = (options?: { force?: boolean }) => Promise<VerifiedSession>;

interface UploadArgs {
  getSession: GetSession;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** True when Storage rejected the token itself (expired / invalid), as opposed to a policy denial. */
function isTokenProblem(err: unknown): boolean {
  if (!(err instanceof SupabaseError)) return false;
  return /jwt|exp claim|token.*(expired|invalid)|invalid.*token|invalid claim/i.test(err.message);
}

/** True when Storage's row-level security refused the write. */
function isPolicyDenial(err: unknown): boolean {
  if (!(err instanceof SupabaseError)) return false;
  return /row-level security|violates.*polic/i.test(err.message) || (err.status === 403 && !isTokenProblem(err));
}

/**
 * Uploads one validated image to products/<uid>/<productId>/ and returns its public URL.
 *
 * The session is checked with the Auth server FIRST (refreshing it if expired), so an
 * expired login never reaches Storage. The <uid> folder comes from that verified
 * session. If Storage still reports an expired token, the session is force-refreshed
 * and the upload is retried once.
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  { getSession, onProgress, signal }: UploadArgs
): Promise<{ url: string; path: string }> {
  const problem = await validateImageFile(file);
  if (problem) throw new Error(problem);
  // Trust the bytes, not the browser-reported type.
  const mime = (await sniffImageType(file)) as ImageMime;

  let session = await getSession();
  const name = `${Date.now().toString(36)}-${randomHex(4)}.${EXTENSION[mime]}`;
  let path = `products/${session.userId}/${productId}/${name}`;
  const send = () =>
    storage.upload(PRODUCT_IMAGE_BUCKET, path, file, {
      accessToken: session.accessToken,
      contentType: mime,
      onProgress,
      signal,
    });

  try {
    await send();
  } catch (err) {
    if (!isTokenProblem(err)) throw err;
    session = await getSession({ force: true });
    path = `products/${session.userId}/${productId}/${name}`;
    await send();
  }
  return { url: storage.publicUrl(PRODUCT_IMAGE_BUCKET, path), path };
}

/**
 * Turns an upload failure into a message that says what really went wrong, so a
 * storage/config problem is not disguised as "sign in again".
 */
export function describeUploadError(err: unknown): string {
  if (err instanceof SessionError) {
    switch (err.kind) {
      case "no-session":
        return "You're not signed in. Sign in, then retry.";
      case "expired":
        return "Your session expired and couldn't be renewed. Sign in again, then retry.";
      case "network":
        return err.message;
      case "unavailable":
        return err.message;
    }
  }

  const message = err instanceof Error ? err.message : "";
  const status = err instanceof SupabaseError ? err.status : 0;

  if (/bucket not found/i.test(message) || (status === 404 && /bucket/i.test(message))) {
    return `The "${PRODUCT_IMAGE_BUCKET}" storage bucket doesn't exist yet. Run supabase/product-images.sql in your Supabase project.`;
  }
  if (isTokenProblem(err)) {
    return `The server rejected your sign-in token (${message}). Press Retry to renew it; if it keeps failing, sign in again.`;
  }
  if (isPolicyDenial(err)) {
    return `Storage refused this upload${message ? ` (${message})` : ""}. You're signed in, so this is a storage permission rule, not a login problem. The upload policies may be missing or out of date. Run supabase/product-images-storage-policies.sql.`;
  }
  if (status === 413 || /too large|exceed|payload/i.test(message)) {
    return "That file is too large for the server. Each image can be up to 5 MB.";
  }
  if (/mime|not supported|invalid.*type|unsupported/i.test(message)) {
    return `The server rejected this file type${message ? ` (${message})` : ""}. Use JPG, PNG or WEBP.`;
  }
  if (err instanceof SupabaseError && status === 0) {
    return "Couldn't reach the server. Check your connection and retry.";
  }
  if (status === 0 && !message) return "Couldn't reach the server. Check your connection and retry.";
  return message || "The upload failed. Please retry.";
}

/**
 * Deletes the uploaded files behind `urls` (external links are ignored).
 * Returns how many files were really removed.
 */
export async function removeProductImageFiles(
  productId: string,
  ownerId: string | undefined,
  urls: string[],
  accessToken?: string
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const paths = ownFolderPaths(productId, urls, ownerId);
  if (paths.length === 0) return 0;
  const removed = await storage.remove(PRODUCT_IMAGE_BUCKET, paths, accessToken);
  return removed.length;
}

async function listProductFiles(productId: string, ownerId: string | undefined, accessToken?: string) {
  const out: string[] = [];
  for (const folder of productFolders(productId, ownerId)) {
    out.push(...(await storage.list(PRODUCT_IMAGE_BUCKET, folder.replace(/\/$/, ""), accessToken)));
  }
  return out;
}

/** Deletes every file in the product's folder(s) (used when a listing is deleted or abandoned). */
export async function deleteProductFolder(
  productId: string,
  ownerId: string | undefined,
  accessToken?: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const files = await listProductFiles(productId, ownerId, accessToken);
  if (files.length > 0) await storage.remove(PRODUCT_IMAGE_BUCKET, files, accessToken);
}

/**
 * After publishing: deletes any file in the product's folder that the saved
 * image list no longer references (e.g. a removal whose delete request failed).
 */
export async function sweepUnusedProductImages(
  productId: string,
  ownerId: string | undefined,
  keepUrls: string[],
  accessToken?: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const keep = new Set(ownFolderPaths(productId, keepUrls, ownerId));
  const files = await listProductFiles(productId, ownerId, accessToken);
  const stale = files.filter((f) => !keep.has(f));
  if (stale.length > 0) await storage.remove(PRODUCT_IMAGE_BUCKET, stale, accessToken);
}
