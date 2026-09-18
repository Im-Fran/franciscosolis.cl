import {useTranslation} from "react-i18next";
import {Plus, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {LINK_KINDS, MAX_LINKS} from "@/lib/pages/types.ts";
import type {ApplicationLink} from "@/lib/pages/types.ts";

/**
 * The link editor behind an application's header buttons and a release note's.
 *
 * `kind` is a picklist rather than free text because the *page* draws an icon from it — the closed
 * vocabulary on the service exists so the button for a Play Store link looks like a Play Store
 * button on every application, without an editor choosing an icon. `other` is the escape hatch, and
 * it is the one kind that reads as a plain link with whatever label it carries.
 *
 * The label is optional on purpose: left blank, the page falls back to the kind's own name in the
 * visitor's language, which is one fewer thing to translate for the common case of "a GitHub link
 * that says GitHub".
 */
export type LinksFieldProps = {
  value: ApplicationLink[];
  onChange: (links: ApplicationLink[]) => void;
  disabled?: boolean;
  /** Prefix for the generated input ids, so two of these can sit on one screen. */
  idPrefix: string;
};

export const LinksField = ({value, onChange, disabled, idPrefix}: LinksFieldProps) => {
  const {t} = useTranslation(["cms_pages", "application"]);

  const set = (index: number, patch: Partial<ApplicationLink>) =>
    onChange(value.map((link, position) => (position === index ? {...link, ...patch} : link)));

  const remove = (index: number) => onChange(value.filter((_, position) => position !== index));

  const add = () => onChange([...value, {kind: "website", url: "", label: null}]);

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && <p className="text-[13px] text-neutral-500">{t("cms_pages:links.empty")}</p>}

      {value.map((link, index) => (
        <div
          // The index is the identity here: two links of the same kind and url are the same entry,
          // and keying on the url would rebuild the row — losing focus — on every keystroke in it.
          key={index}
          className="grid gap-2 rounded-[var(--radius-md)] border border-neutral-800 p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,9rem)_auto]"
        >
          <Select
            id={`${idPrefix}-kind-${index}`}
            value={link.kind}
            disabled={disabled}
            aria-label={t("cms_pages:links.kind")}
            onChange={(event) => set(index, {kind: event.target.value})}
          >
            {LINK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`application:links.${kind}`, {defaultValue: kind})}
              </option>
            ))}
          </Select>

          <Input
            id={`${idPrefix}-url-${index}`}
            type="url"
            value={link.url}
            disabled={disabled}
            placeholder="https://"
            aria-label={t("cms_pages:links.url")}
            className="font-mono text-[13px]"
            onChange={(event) => set(index, {url: event.target.value})}
          />

          <Input
            id={`${idPrefix}-label-${index}`}
            value={link.label ?? ""}
            disabled={disabled}
            maxLength={80}
            placeholder={t(`application:links.${link.kind}`, {defaultValue: ""})}
            aria-label={t("cms_pages:links.label")}
            onChange={(event) => set(index, {label: event.target.value})}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => remove(index)}
            aria-label={t("cms_pages:links.remove", {url: link.url || t("cms_pages:links.untitled")})}
            className="text-neutral-400 hover:text-red-300"
            data-fs-hover
          >
            <Trash size={16}/>
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={add}
          disabled={disabled || value.length >= MAX_LINKS}
          data-fs-hover
        >
          <Plus size={15}/> {t("cms_pages:links.add")}
        </Button>
        <span className="text-[12px] text-neutral-600">
          {t("cms_pages:links.count", {count: value.length, max: MAX_LINKS})}
        </span>
      </div>
    </div>
  );
};
