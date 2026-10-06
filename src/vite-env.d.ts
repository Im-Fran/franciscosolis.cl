/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the auth service, without a trailing slash. */
  readonly VITE_AUTH_BASE_URL?: string;
  /** Client ID this front-end is registered under on the auth service. */
  readonly VITE_AUTH_CLIENT_ID?: string;
  /** Base URL of the CMS service, without a trailing slash. */
  readonly VITE_CMS_BASE_URL?: string;
  /** Client ID the CMS interface is registered under on the auth service. */
  readonly VITE_CMS_CLIENT_ID?: string;
  /** Base URL of the asset CDN (the `franciscosolis` R2 bucket), without a trailing slash. */
  readonly VITE_CDN_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
