/**
 * Chhota sa Supabase client — koi npm dependency nahi, sirf fetch.
 *
 * Enable karne ke liye project root mein `.env` banayein:
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhbGci...
 *
 * Anon key browser mein expose hona NORMAL hai — asli security Supabase ki
 * Row Level Security (RLS) policies se aati hai. supabase/schema.sql dekhein.
 */

const env = import.meta.env as Record<string, string | undefined>;

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export class SupabaseError extends Error {
  status: number;
  /** Short machine-ish label from the server body (e.g. "Unauthorized"), when it sent one. */
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SupabaseError";
    this.status = status;
    this.code = code;
  }
}

/**
 * The user's Supabase session is missing, expired beyond repair, or could not be
 * checked. Thrown by AuthStore.ensureSession() BEFORE any protected request is
 * attempted, so callers can tell "not signed in" apart from "signed in, but the
 * server said no".
 */
export type SessionErrorKind = "no-session" | "expired" | "network" | "unavailable";
export class SessionError extends Error {
  kind: SessionErrorKind;
  constructor(kind: SessionErrorKind, message: string) {
    super(message);
    this.name = "SessionError";
    this.kind = kind;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new SupabaseError("Supabase is not configured.", 0);
  }

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${options.accessToken || SUPABASE_ANON_KEY}`,
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    throw new SupabaseError(extractMessage(data) ?? `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Storage answers a policy denial with HTTP 400 or 403 depending on its version and
 * puts the real status in the body ({ statusCode: "403", error: "Unauthorized", ... }).
 * Prefer the body's status so callers see the true reason.
 */
function storageStatus(data: unknown, httpStatus: number): number {
  if (data && typeof data === "object") {
    const n = Number((data as Record<string, unknown>).statusCode);
    if (Number.isInteger(n) && n >= 400 && n < 600) return n;
  }
  return httpStatus;
}

function extractCode(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const v = (data as Record<string, unknown>).error;
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

function extractMessage(data: unknown): string | null {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["error_description", "msg", "message", "error", "hint"]) {
      const val = obj[key];
      if (typeof val === "string" && val) return val;
    }
  }
  return null;
}

/** Supabase Auth (GoTrue) endpoints. */
export const auth = {
  signUp: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/auth/v1/signup", { method: "POST", body }),
  signIn: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/auth/v1/token?grant_type=password", { method: "POST", body }),
  refresh: (refreshToken: string) =>
    request<Record<string, unknown>>("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }),
  recover: (email: string) =>
    request<unknown>("/auth/v1/recover", { method: "POST", body: { email } }),
  signOut: (accessToken: string) =>
    request<unknown>("/auth/v1/logout", { method: "POST", accessToken }),
  /**
   * Asks the Auth server who the token belongs to (GET /auth/v1/user). Unlike
   * decoding the JWT in the browser, this fails for expired, revoked or forged
   * tokens — it is the check to use before a protected action.
   */
  getUser: (accessToken: string) =>
    request<{ id?: string; email?: string }>("/auth/v1/user", { accessToken }),
};

/** PostgREST (database) helpers. */
export const db = {
  select: <T>(table: string, query = "select=*", accessToken?: string) =>
    request<T>(`/rest/v1/${table}?${query}`, { accessToken }),
  /**
   * By default returns the inserted rows (`Prefer: return=representation`). That
   * makes Postgres check the new row against the table's SELECT policies too, so
   * pass `{ returnRow: false }` when the response isn't needed and the caller may
   * be allowed to insert without being allowed to read the row back (guest orders).
   */
  insert: <T>(table: string, rows: unknown, accessToken?: string, options?: { returnRow?: boolean }) =>
    request<T>(`/rest/v1/${table}`, {
      method: "POST",
      body: rows,
      accessToken,
      headers: { Prefer: options?.returnRow === false ? "return=minimal" : "return=representation" },
    }),
  update: <T>(table: string, query: string, patch: unknown, accessToken?: string) =>
    request<T>(`/rest/v1/${table}?${query}`, {
      method: "PATCH",
      body: patch,
      accessToken,
      headers: { Prefer: "return=representation" },
    }),
  /**
   * Returns the deleted rows (`Prefer: return=representation`). PostgREST answers a
   * DELETE that Row Level Security filtered down to zero rows with a plain success,
   * so callers should check for an empty array instead of assuming it worked.
   */
  remove: (table: string, query: string, accessToken?: string) =>
    request<unknown[]>(`/rest/v1/${table}?${query}`, {
      method: "DELETE",
      accessToken,
      headers: { Prefer: "return=representation" },
    }),
  /**
   * Exact row count via a HEAD request (`Prefer: count=exact`) — reads the total
   * from the Content-Range header, so it is not capped by PostgREST's row limit
   * and downloads no rows. Row Level Security still applies: the count only
   * includes rows the given token is allowed to see. `filter` is an optional
   * PostgREST filter string, e.g. `status=eq.Placed`.
   */
  count: async (table: string, filter = "", accessToken?: string): Promise<number> => {
    if (!isSupabaseConfigured) {
      throw new SupabaseError("Supabase is not configured.", 0);
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id${filter ? `&${filter}` : ""}`, {
      method: "HEAD",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) {
      throw new SupabaseError(`Could not count ${table} (${res.status}).`, res.status);
    }
    // Content-Range looks like "*/12" (or "0-4/12"); the part after "/" is the total.
    const total = Number((res.headers.get("content-range") ?? "").split("/")[1]);
    if (!Number.isFinite(total)) {
      throw new SupabaseError(`Could not read the ${table} row count.`, res.status);
    }
    return total;
  },
};

/** Encode each segment of an object path, keeping the "/" separators. */
const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

interface UploadOptions {
  accessToken: string;
  contentType: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Supabase Storage (REST). Uses the same URL, anon key and user access token as
 * `auth` / `db` above, so Storage policies see the signed-in user exactly like
 * the database's Row Level Security does.
 */
export const storage = {
  /** URL prefix that every public object of `bucket` starts with. */
  publicPrefix: (bucket: string) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`,

  publicUrl: (bucket: string, path: string) =>
    `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodePath(path)}`,

  /**
   * Uploads one file. Uses XMLHttpRequest (not fetch) because it is the only
   * browser API that reports upload progress. Never overwrites: `x-upsert` is
   * false, so a name clash fails instead of replacing someone's file.
   */
  upload: (bucket: string, path: string, file: Blob, options: UploadOptions) =>
    new Promise<void>((resolve, reject) => {
      if (!isSupabaseConfigured) {
        reject(new SupabaseError("Supabase is not configured.", 0));
        return;
      }
      if (options.signal?.aborted) {
        reject(new DOMException("Upload cancelled", "AbortError"));
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Authorization", `Bearer ${options.accessToken}`);
      xhr.setRequestHeader("Content-Type", options.contentType);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("cache-control", "max-age=31536000");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) options.onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          options.onProgress?.(1);
          resolve();
          return;
        }
        const data = xhr.responseText ? safeParse(xhr.responseText) : null;
        reject(
          new SupabaseError(
            extractMessage(data) ?? `Upload failed (${xhr.status})`,
            storageStatus(data, xhr.status),
            extractCode(data)
          )
        );
      };
      xhr.onerror = () => reject(new SupabaseError("Network error while uploading.", 0));
      xhr.ontimeout = () => reject(new SupabaseError("The upload timed out.", 0));
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
      options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });

      xhr.send(file);
    }),

  /**
   * Deletes objects by path. Like PostgREST, Storage answers a delete that its
   * policies filtered down to nothing with a plain success, so this returns the
   * names that were really removed — compare with what you asked for.
   */
  remove: async (bucket: string, paths: string[], accessToken?: string): Promise<string[]> => {
    if (paths.length === 0) return [];
    const removed = await request<{ name: string }[]>(`/storage/v1/object/${bucket}`, {
      method: "DELETE",
      body: { prefixes: paths },
      accessToken,
    });
    return (removed ?? []).map((o) => o.name);
  },

  /** Lists the files directly inside a "folder" (path prefix). */
  list: async (bucket: string, prefix: string, accessToken?: string): Promise<string[]> => {
    const items = await request<{ name: string; id: string | null }[]>(
      `/storage/v1/object/list/${bucket}`,
      {
        method: "POST",
        body: { prefix, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } },
        accessToken,
      }
    );
    // Sub-folders come back with id = null; only real files have an id.
    return (items ?? []).filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
  },
};
