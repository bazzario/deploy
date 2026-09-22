import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * A string state value that lives in the URL query string (e.g. `?q=ali`).
 *
 * The admin pages use it for their search box / filters so that the header
 * "Quick search" and the notification links can drive the page they land on,
 * and so a filtered view survives a refresh. Changes use `replace`, so typing
 * doesn't fill the browser history with one entry per keystroke.
 *
 * A value equal to `fallback` (or empty) is removed from the URL.
 */
export function useUrlParam(name: string, fallback = ""): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;

  const set = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (!next || next === fallback) copy.delete(name);
          else copy.set(name, next);
          return copy;
        },
        { replace: true }
      );
    },
    [name, fallback, setParams]
  );

  return [value, set];
}
