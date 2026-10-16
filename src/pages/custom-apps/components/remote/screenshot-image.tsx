import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {ImageBroken} from "@phosphor-icons/react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {cn} from "@/lib/utils.ts";

/**
 * One screenshot, fetched with the panel's token and shown through an object URL.
 *
 * The image lives behind the same bearer token as everything else — it can show a client's
 * customers, so it is not a public URL — and an `<img src>` would ask for it without one. The URL is
 * revoked when the image unmounts or changes, so a gallery paged through all afternoon does not keep
 * every picture it ever showed in memory.
 */
export const ScreenshotImage = ({path, alt, className}: {path: string; alt: string; className?: string}) => {
  const {t} = useTranslation("custom_apps");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);

    customAppsApi.screenshots
      .image(path, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (failed) {
    return (
      <span className={cn("flex flex-col items-center justify-center gap-2 bg-bg text-[12px] text-neutral-500", className)}>
        <ImageBroken size={24} aria-hidden="true" />
        {t("screenshots.load_failed")}
      </span>
    );
  }

  if (!url) {
    return (
      <span className={cn("flex items-center justify-center bg-bg text-neutral-500", className)}>
        <Spinner size={18} label={t("screenshots.loading")} />
      </span>
    );
  }

  return <img src={url} alt={alt} className={cn("bg-bg object-contain", className)} />;
};
