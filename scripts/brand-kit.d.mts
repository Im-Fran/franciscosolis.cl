/** Types for scripts/brand-kit.mjs, so vite.config.ts can pull the plugin in under `tsc -b`. */
import type {Plugin} from "vite";

/** The archive's file name, e.g. `franciscosolis-brand-kit.zip`. */
export declare const BRAND_KIT_FILE_NAME: string;
/** Bundle-relative path the archive is emitted at, e.g. `brand/franciscosolis-brand-kit.zip`. */
export declare const BRAND_KIT_PATH: string;
/** Absolute URL path the site serves the archive from. Mirrored in src/pages/brand/brand.tsx. */
export declare const BRAND_KIT_URL: string;
/** Packs public/brand/ plus its BRAND.md and returns the ZIP. */
export declare const buildBrandKit: () => Buffer;
/** Serves the kit in dev and preview, and emits it into the client bundle on build. */
export declare const brandKit: () => Plugin;
