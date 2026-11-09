"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;
function loadTurnstile() {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject());
    script.onerror = () => {
      // Let "Try again" load it afresh.
      script.remove();
      loading = undefined;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile (Phase 1 task 9). Usually invisible; shows a checkbox only when unsure.
 * Tokens are single-use: call `reset()` after each request that sent one. Without a site key
 * this is a no-op and `ready` is always true, so forms work unchanged. Forms stay disabled
 * until there's a token, so a check that can't finish says so and offers "Try again".
 */
export function useTurnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [token, setToken] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !ref.current) return;
        widgetId.current = turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          theme: "auto",
          callback: (t: string) => {
            setToken(t);
            setFailed(false);
          },
          "expired-callback": () => setToken(undefined),
          "error-callback": () => {
            setToken(undefined);
            setFailed(true);
          },
          "timeout-callback": () => {
            setToken(undefined);
            setFailed(true);
          },
          "unsupported-callback": () => setFailed(true),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [attempt]);

  const reset = useCallback(() => {
    setToken(undefined);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setToken(undefined);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
    else setAttempt((n) => n + 1); // The script itself never loaded.
  }, []);

  return {
    token,
    ready: !SITE_KEY || !!token,
    reset,
    widget: SITE_KEY ? (
      <div>
        <div ref={ref} />
        {failed && (
          <div role="alert" className="flex items-center justify-between gap-3 py-1">
            <p className="text-footnote text-danger">
              The security check didn&apos;t finish. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={retry}
              className="hit relative shrink-0 text-subhead font-semibold text-accent"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    ) : null,
  };
}
