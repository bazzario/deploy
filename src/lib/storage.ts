import { useEffect, useState } from "react";

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private browsing / quota full — is session ke liye sirf memory mein rahega
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** useState jaisa hi, lekin value localStorage mein persist hoti hai. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readJSON(key, initial));

  useEffect(() => {
    writeJSON(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
