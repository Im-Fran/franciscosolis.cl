import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {CheckCircle, Circle} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatBytes} from "@/lib/custom-apps/format.ts";
import {cn} from "@/lib/utils.ts";
import {CopyButton} from "@/pages/custom-apps/components/copy-button.tsx";
import {KEYGEN_SNIPPET, uploadSnippet} from "@/pages/custom-apps/components/releases/release-format.ts";

const preClass =
  "overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre text-neutral-300";

/** A shell snippet with its copy button. */
export const Snippet = ({value, label}: {value: string; label: string}) => (
  <div className="relative">
    <pre className={cn(preClass, "pr-12")}>{value}</pre>
    <span className="absolute top-1 right-1">
      <CopyButton value={value} label={label} />
    </span>
  </div>
);

const Step = ({done, title, children}: {done: boolean | null; title: string; children: ReactNode}) => (
  <li className="flex gap-3">
    <span className={cn("mt-0.5 shrink-0", done ? "text-emerald-400" : "text-neutral-600")} aria-hidden="true">
      {done ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} />}
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-sm text-text">{title}</p>
      {children}
    </div>
  </li>
);

/**
 * How a release gets here: the panel never uploads one. CI signs the build with the app's private
 * key and posts it with a CI token, and it arrives as a draft for somebody to publish.
 *
 * `hasKey` and `hasToken` tick the first two steps off when known (null while they are), so the same
 * text reads as a checklist on an app that is halfway set up.
 */
export const CiUploadHelp = ({
  appId,
  hasKey,
  hasToken,
  maxBytes,
}: {
  appId: string;
  hasKey: boolean | null;
  hasToken: boolean | null;
  maxBytes: number;
}) => {
  const {t, i18n} = useTranslation("custom_apps");

  return (
    <ol className="flex flex-col gap-5">
      <Step done={hasKey} title={t("releases.help.key_title")}>
        <p className="text-[13px] leading-relaxed text-neutral-400">
          {t("releases.help.key_body")}{" "}
          <Link to={customAppsRoute.appSettings(appId)} className="underline">
            {t("releases.help.settings_link")}
          </Link>
        </p>
        <Snippet value={KEYGEN_SNIPPET} label={t("releases.help.key_title")} />
      </Step>
      <Step done={hasToken} title={t("releases.help.token_title")}>
        <p className="text-[13px] leading-relaxed text-neutral-400">
          {t("releases.help.token_body")}{" "}
          <Link to={customAppsRoute.appSettings(appId)} className="underline">
            {t("releases.help.settings_link")}
          </Link>
        </p>
      </Step>
      <Step done={null} title={t("releases.help.upload_title")}>
        <p className="text-[13px] leading-relaxed text-neutral-400">
          {t("releases.help.upload_body", {max: formatBytes(maxBytes, i18n.language)})}
        </p>
        <Snippet value={uploadSnippet(appId)} label={t("releases.help.upload_title")} />
        <p className="text-[12px] leading-relaxed text-neutral-500">{t("releases.help.upload_after")}</p>
      </Step>
    </ol>
  );
};
