import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { HTMLAttributes, ReactNode } from "react";
import {RouterProvider} from "react-router-dom";
import router from "@/router.tsx";
import {AuthProvider} from "@/lib/auth/auth-provider.tsx";
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
    ns: ['common', 'personal_info', 'projects', 'experience', 'hero', 'nav', 'stack', 'contact', 'legal', 'brand', 'not_found', 'auth', 'admin', 'cms', 'a11y'],
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <A11yProvider>
      <AuthProvider>
        <RouterProvider router={router}/>
      </AuthProvider>
    </A11yProvider>
  </StrictMode>,
)
