import {useTranslation} from "react-i18next";
import {useIntersectionObserver} from "usehooks-ts";
import {AppleLogo, DownloadSimple, HardDrives, LinkSimple, LockKey, Package, Timer, WindowsLogo} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatBytes} from "@/lib/marketplace/store.ts";
import {useReleaseFiles} from "@/lib/marketplace/store.ts";
import type {ReleaseFile} from "@/lib/marketplace/types.ts";
import {usePurchase} from "@/pages/product/purchase-context.ts";

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
export const ReleaseDownloads = ({slug, channel, version}: ReleaseDownloadsProps) => {
  const {i18n} = useTranslation(["product"]);
  const locale = i18n.resolvedLanguage ?? "en";
  /* `freezeOnceVisible` so scrolling back past a release does not re-run its request. */
  const {isIntersecting, ref} = useIntersectionObserver({freezeOnceVisible: true, rootMargin: "200px"});

  return (
    <div ref={ref}>
      {isIntersecting && <ReleaseFileList slug={slug} channel={channel} version={version} locale={locale}/>}
    </div>
  );
};

type ReleaseDownloadsProps = {
  slug: string;
  /** Part of the release's identity, not a label: the same version can exist on two lines. */
  channel: string;
  version: string;
};

const ReleaseFileList = ({slug, channel, version, locale}: ReleaseDownloadsProps & {locale: string}) => {
  const {t} = useTranslation(["product"]);
  const files = useReleaseFiles(slug, channel, version);

  if (files.loading) {
    return (
      <p className="mt-4 flex items-center gap-2 text-[13px] text-neutral-500">
        <Spinner size={14}/> {t("product:downloads.loading")}
      </p>
    );
  }

  /* A failed file list must not take the changelog entry with it: the text is the point. */
  if (files.error || !files.data || files.data.files.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-neutral-800/60 pt-4">
      <p className="flex items-center gap-2 text-[12px] tracking-wide text-neutral-500 uppercase">
        <DownloadSimple size={13}/> {t("product:downloads.title")}
        {files.data.channel_requires_purchase ? (
          /*
           * The supporters-only line is worded separately from the paid one on purpose: on a
           * `donation` product the stable build is still free to take, and saying "this has to be
           * paid for" there would be false.
           */
          <span className="inline-flex items-center gap-1 text-neutral-500 normal-case">
            <LockKey size={12}/> {t("product:downloads.supporters_only")}
          </span>
        ) : files.data.requires_payment ? (
          <span className="inline-flex items-center gap-1 text-neutral-500 normal-case">
            <LockKey size={12}/> {t("product:downloads.requires_payment")}
          </span>
        ) : null}
      </p>

      <ul className="flex flex-col gap-2">
        {files.data.files.map((file) => (
          <DownloadRow
            key={file.id}
            file={file}
            locale={locale}
            channelRequiresPurchase={files.data?.channel_requires_purchase ?? false}
          />
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
const DownloadRow = ({
  file,
  locale,
  channelRequiresPurchase,
}: {
  file: ReleaseFile;
  locale: string;
  channelRequiresPurchase: boolean;
}) => {
  const {t} = useTranslation(["product"]);
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
            ? t("product:downloads.cooldown", {count: download.secondsLeft})
            : t("product:downloads.starting")}
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => requestDownload(file, {channelRequiresPurchase})}>
          <DownloadSimple size={15}/> {t("product:downloads.get")}
        </Button>
      )}

      {ready && (
        <a href={ready.url} download={ready.filename} className="text-[12px] text-accent-300 underline">
          {t("product:downloads.manual")}
        </a>
      )}
    </li>
  );
};
