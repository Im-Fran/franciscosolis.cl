import {useEffect, useImperativeHandle, useRef} from "react";
import type {Ref} from "react";

/**
 * Cloudflare Turnstile, as the sign-in screen uses it.
 *
 * The widget is a script on Cloudflare's own origin, so this component is the one place in the
 * application that loads a third-party script — and it only does so when the service says a check
 * is required. A deployment with no keypair (a local stack, a preview) never reaches this file at
 * all, which is deliberate: the fallback for "no bot check configured" is no network request, not a
 * widget that fails to render.
 *
 * Three details are worth knowing before changing any of this:
 *
 * - **The script is loaded once per document and never removed.** Turnstile registers a global, and
 *   a second copy of the script re-registers it; React Strict Mode mounts every effect twice in
 *   development, which is exactly the case that would produce one.
 * - **A token is single-use and short-lived.** Cloudflare expires it after five minutes and the
 *   service refuses a replay, so `reset()` exists for the screen to call after a failed submit —
 *   without it the second attempt would present a token the first one already spent.
 * - **The widget renders into a div this component owns.** Turnstile writes an iframe into it, so
 *   React must never re-render its children; the `div` is deliberately empty in JSX.
 */

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      language?: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Loads the widget script once, and resolves when `window.turnstile` is actually there. */
const loadTurnstile = (): Promise<TurnstileApi> =>
  new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const settle = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile-unavailable")));
    script.addEventListener("load", settle, {once: true});
    script.addEventListener("error", () => reject(new Error("turnstile-unavailable")), {once: true});

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

export type TurnstileHandle = {
  /** Clears the solved token and asks for a fresh challenge. Called after a refused submit. */
  reset: () => void;
};

export type TurnstileProps = {
  siteKey: string;
  /** Called with a solved token, and with null whenever the previous one stops being usable. */
  onToken: (token: string | null) => void;
  /** Reported when the script cannot be loaded or the widget errors, so the screen can say so. */
  onError?: () => void;
  language?: string;
  ref?: Ref<TurnstileHandle>;
};

export const Turnstile = ({siteKey, onToken, onError, language, ref}: TurnstileProps) => {
  const container = useRef<HTMLDivElement | null>(null);
  const widget = useRef<string | null>(null);
  /* Read through a ref so re-rendering the parent never re-renders the widget itself. */
  const handlers = useRef({onToken, onError});
  handlers.current = {onToken, onError};

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widget.current && window.turnstile) {
        window.turnstile.reset(widget.current);
        handlers.current.onToken(null);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current || widget.current) return;
        widget.current = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "dark",
          language,
          callback: (token) => handlers.current.onToken(token),
          /* Both of these leave the form unsubmittable, which is the honest state to be in. */
          "error-callback": () => {
            handlers.current.onToken(null);
            handlers.current.onError?.();
          },
          "expired-callback": () => handlers.current.onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError?.();
      });

    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) {
        window.turnstile.remove(widget.current);
        widget.current = null;
      }
    };
  }, [language, siteKey]);

  return <div ref={container} className="min-h-[65px]"/>;
};
