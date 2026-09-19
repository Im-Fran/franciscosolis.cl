import {useTranslation} from "react-i18next";
import {useIntersectionObserver} from "usehooks-ts";
import {AppleLogo, DownloadSimple, HardDrives, LinkSimple, LockKey, Package, Timer, WindowsLogo} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatBytes} from "@/lib/pages/store.ts";
import {useReleaseFiles} from "@/lib/pages/store.ts";
import type {ReleaseFile} from "@/lib/pages/types.ts";
import {usePurchase} from "@/pages/application/purchase-context.ts";

/** An icon per build platform. `any` is the cross-platform artifact most releases actually ship. */
const PLATFORM_ICONS: Record<string, Icon> = {
  any: Package,
  windows: WindowsLogo,
  macos: AppleLogo,
  ios: AppleLogo,
  linux: HardDrives,
  android: DownloadSimple,
  web: LinkSimple,
  server: HardDrives,
};

/**
 * The builds attached to one release.
 *
 * Loaded when the entry scrolls into view rather than with the changelog. A page listing twenty
 * releases would otherwise open twenty requests to show buttons nobody has scrolled to, and the
 * archive of old versions is exactly the part visitors do not read.
 */
export const ReleaseDownloads = ({slug, version}: {slug: string; version: string}) => {
  const {i18n} = useTranslation(["application"]);
  const locale = i18n.resolvedLanguage ?? "en";
  /* `freezeOnceVisible` so scrolling back past a release does not re-run its request. */
  const {isIntersecting, ref} = useIntersectionObserver({freezeOnceVisible: true, rootMargin: "200px"});

  return (
    <div ref={ref}>
      {isIntersecting && <ReleaseFileList slug={slug} version={version} locale={locale}/>}
    </div>
  );
};

const ReleaseFileList = ({slug, version, locale}: {slug: string; version: string; locale: string}) => {
  const {t} = useTranslation(["application"]);
  const files = useReleaseFiles(slug, version);

  if (files.loading) {
    return (
      <p className="mt-4 flex items-center gap-2 text-[13px] text-neutral-500">
        <Spinner size={14}/> {t("application:downloads.loading")}
      </p>
    );
  }

  /* A failed file list must not take the changelog entry with it: the text is the point. */
  if (files.error || !files.data || files.data.files.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-neutral-800/60 pt-4">
      <p className="flex items-center gap-2 text-[12px] tracking-wide text-neutral-500 uppercase">
        <DownloadSimple size={13}/> {t("application:downloads.title")}
        {files.data.requires_payment && (
          <span className="inline-flex items-center gap-1 text-neutral-500 normal-case">
            <LockKey size={12}/> {t("application:downloads.requires_payment")}
          </span>
        )}
      </p>

      <ul className="flex flex-col gap-2">
        {files.data.files.map((file) => (
          <DownloadRow key={file.id} file={file} locale={locale}/>
        ))}
      </ul>
    </div>
  );
};

/**
 * One build, and the button that gets it.
 *
 * The button never decides anything: it hands the file to `requestDownload`, which is where the
 * page's single answer about payment and cooldown is applied. What this row owns is telling the
 * visitor what is happening to *their* click — the countdown while a non-payer's link is not valid
 * yet, and the plain link once it is, so a browser that refuses the automatic download is not a
 * dead end.
 */
const DownloadRow = ({file, locale}: {file: ReleaseFile; locale: string}) => {
  const {t} = useTranslation(["application"]);
  const {requestDownload, download} = usePurchase();
  const PlatformIcon = PLATFORM_ICONS[file.platform] ?? Package;

  const waiting = download.pending === file.id;
  const ready = download.ready?.fileId === file.id ? download.ready : null;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] bg-bg/40 px-3 py-2">
      <PlatformIcon size={18} className="shrink-0 text-neutral-400"/>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text">{file.label?.trim() || file.filename}</span>
        <span className="block text-[12px] text-neutral-500">
          {file.label?.trim() ? `${file.filename} · ` : ""}
          {formatBytes(file.size, locale)}
        </span>
      </span>

      {waiting ? (
        <span className="flex items-center gap-2 text-[13px] text-neutral-400">
          <Timer size={15}/>
          {download.secondsLeft > 0
            ? t("application:downloads.cooldown", {count: download.secondsLeft})
            : t("application:downloads.starting")}
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => requestDownload(file)}>
          <DownloadSimple size={15}/> {t("application:downloads.get")}
        </Button>
      )}

      {ready && (
        <a href={ready.url} download={ready.filename} className="text-[12px] text-accent-300 underline">
          {t("application:downloads.manual")}
        </a>
      )}
    </li>
  );
};
