import {useEffect} from "react";
import {authApi} from "@/lib/auth/api.ts";
import type {Language} from "@/lib/a11y";
import {notificationsApi} from "@/lib/notifications/client.ts";

/** The last `sub:language` pair both services confirmed, so an unchanged language costs no request. */
const SYNCED_KEY = "fs.notifications.language";

const readSynced = () => {
  try {
    return localStorage.getItem(SYNCED_KEY);
  } catch {
    return null;
  }
};

const writeSynced = (value: string) => {
  try {
    localStorage.setItem(SYNCED_KEY, value);
  } catch {
    /* Storage blocked: the next load simply writes the same language again. */
  }
};

/** `es-CL` and `es` are the same language as far as either service is concerned. */
const baseTag = (locale: string | null | undefined) => (locale ?? "").toLowerCase().split(/[-_]/)[0];

/**
 * Tells the services which language this person reads the site in.
 *
 * Nothing the site does happens in a browser for the notifications that leave it: a push is written
 * when the event arrives, an email when the digest runs, a sign-in link before anybody is signed in.
 * Each of those is written in a language the *service* holds for the account, and until the site
 * told it one, that was English for everybody. So the language picked here is copied to both places
 * that write on the account's behalf:
 *
 * - the notifications service's `locale` preference — the bell, push and every notification email;
 * - the account's own `locale` in auth — the security notice it falls back to emailing, and what a
 *   new notifications row is seeded from. A region the person typed in their profile (`es-CL`) is
 *   kept when it already names the same language.
 *
 * The last language on the last device wins, which is the same rule as changing it on the site.
 * Failure is silent and retried on the next load: the only cost is one more notification in the
 * previous language.
 */
export const useLanguageSync = (sub: string | null, accountLocale: string | null | undefined, language: Language) => {
  useEffect(() => {
    if (!sub) return;
    const pair = `${sub}:${language}`;
    if (readSynced() === pair && baseTag(accountLocale) === language) return;

    let cancelled = false;
    void (async () => {
      try {
        await Promise.all([
          notificationsApi.updatePreferences({locale: language}),
          baseTag(accountLocale) === language ? null : authApi.updateMe({locale: language}),
        ]);
        if (!cancelled) writeSynced(pair);
      } catch {
        /* Tried again on the next load. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sub, accountLocale, language]);
};
