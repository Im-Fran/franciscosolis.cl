import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HTMLAttributes, ReactNode } from "react";
import {RouterProvider} from "react-router-dom";
import router from "@/router.tsx";
import {AuthProvider} from "@/lib/auth/auth-provider.tsx";
import {NotificationsProvider} from "@/lib/notifications/notifications-provider.tsx";
import {registerServiceWorker} from "@/lib/notifications/push.ts";
import {A11yProvider, readPreferences} from "@/lib/a11y";
import '@/lib/main.css'
import "@radix-ui/themes/styles.css";
import i18next from "i18next";
import I18NextLocalStorageBackend from "i18next-localstorage-backend";
import resourcesToBackend from "i18next-resources-to-backend";
import {initReactI18next} from "react-i18next";

export type BaseProperties = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
};

i18next
  .use(initReactI18next)
  .use(resourcesToBackend((lang: string, namespace: string) => import(`./translations/${lang}/${namespace}.json`)))
  .init({
    /* The visitor's stored choice, or their browser's language the first time around. */
    lng: readPreferences().language,
    fallbackLng: 'en',
    ns: ['common', 'personal_info', 'projects', 'experience', 'hero', 'nav', 'stack', 'contact', 'legal', 'brand', 'not_found', 'auth', 'admin', 'cms', 'prose', 'support', 'a11y', 'notifications'],
    /*
     * React escapes every string it renders as a text node, so i18next escaping the value first
     * only double-encodes it: a title with an apostrophe reaches the screen as `O&#39;Brien`, and a
     * `JSON.parse` message — which is mostly quotes — becomes unreadable. Nothing here feeds a
     * translated string to `dangerouslySetInnerHTML` or `<Trans>`, which are the two cases that
     * would still need the escaping.
     */
    interpolation: {escapeValue: false},
    backend: {
      backends: [I18NextLocalStorageBackend],
      backendOptions: [
        { expirationTime: 7 * 24 * 60 * 60 * 1000 }, // 7 days
      ]
    }
  })

i18next.loadLanguages(['en', 'es'])

/*
 * The service worker is what receives a push and turns it into a notification (see public/sw.js
 * and docs/NOTIFICATIONS.md). It is registered on every build, `vite dev` included: it has no
 * `fetch` handler and caches nothing, so it cannot serve a stale bundle or get in the way of HMR.
 * After `load`, so it never competes with the first paint for the network.
 */
window.addEventListener('load', () => void registerServiceWorker())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <A11yProvider>
      <AuthProvider>
        {/* The site's own session, read without ever asking for one — the home page's bell and
            the account's notifications tab share the unread count kept here. */}
        <NotificationsProvider>
          <RouterProvider router={router}/>
        </NotificationsProvider>
      </AuthProvider>
    </A11yProvider>
  </StrictMode>,
)
