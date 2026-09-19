import {useCallback, useId, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Code, Eye, ListBullets, Link as LinkIcon, TextAa, TextB, TextItalic} from "@phosphor-icons/react";
import {Textarea} from "@/components/ui/input.tsx";
import {readingMinutes} from "@/lib/prose/format.ts";
import {PROSE_CLASS, renderMarkdown} from "@/lib/prose/markdown.ts";
import {cn} from "@/lib/utils.ts";

type Mode = "write" | "preview" | "split";

/** A toolbar button either wraps the selection or prefixes each selected line. */
type Action =
  | {kind: "wrap"; before: string; after: string; placeholder: string}
  | {kind: "prefix"; prefix: string};

const ACTIONS: {id: string; icon: typeof TextB; action: Action}[] = [
  {id: "bold", icon: TextB, action: {kind: "wrap", before: "**", after: "**", placeholder: "bold"}},
  {id: "italic", icon: TextItalic, action: {kind: "wrap", before: "_", after: "_", placeholder: "italic"}},
  {id: "heading", icon: TextAa, action: {kind: "prefix", prefix: "## "}},
  {id: "list", icon: ListBullets, action: {kind: "prefix", prefix: "- "}},
  {id: "link", icon: LinkIcon, action: {kind: "wrap", before: "[", after: "](https://)", placeholder: "text"}},
  {id: "code", icon: Code, action: {kind: "wrap", before: "`", after: "`", placeholder: "code"}},
];

export type MarkdownEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  /**
   * Rendered in the toolbar, before the write/preview tabs.
   *
   * It exists for one caller: `TranslatableField` puts its translate icon *inside* the control, and
   * this editor is the one control with no corner to spare — a button floated over it would sit on
   * the toolbar or on the first line of somebody's text.
   */
  action?: ReactNode;
  /** Names the field for assistive tech when the surrounding `<Field>` label is not enough. */
  "aria-describedby"?: string;
};

/**
 * The editor behind every long-form field on this site — a content body, a legal document, the text
 * of an email template, the body of a help article.
 *
 * It is shared rather than owned by the section that wrote it first. The support console needed the
 * same editor, and importing the CMS's copy of it is what made a help article's editor throw inside
 * `<CmsProvider>`'s hook: a component that reaches for another section's context is that section's
 * component, wherever the file happens to sit.
 *
 * The source stays plain markdown at all times: the preview renders it, but never round-trips
 * through HTML, so what the API stores is exactly what was typed. Formatting is applied to the
 * textarea's own selection, which is what keeps undo working with the browser's history.
 */
export const MarkdownEditor = ({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 18,
  disabled,
  action,
  ...rest
}: MarkdownEditorProps) => {
  const {t} = useTranslation("prose");
  const [mode, setMode] = useState<Mode>("write");
  const area = useRef<HTMLTextAreaElement>(null);
  const previewId = useId();

  const html = useMemo(() => (mode === "write" ? "" : renderMarkdown(value)), [mode, value]);

  const apply = useCallback(
    (action: Action) => {
      const element = area.current;
      if (!element) return;

      const start = element.selectionStart;
      const end = element.selectionEnd;
      const selected = value.slice(start, end);

      let next: string;
      let caret: [number, number];

      if (action.kind === "wrap") {
        const inner = selected || action.placeholder;
        next = `${value.slice(0, start)}${action.before}${inner}${action.after}${value.slice(end)}`;
        const from = start + action.before.length;
        caret = [from, from + inner.length];
      } else {
        /* Prefixes apply per line, so selecting a paragraph turns all of it into a list. */
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const block = value.slice(lineStart, end) || action.prefix;
        const prefixed = block
          .split("\n")
          .map((line) => (line.startsWith(action.prefix) ? line : `${action.prefix}${line}`))
          .join("\n");
        next = `${value.slice(0, lineStart)}${prefixed}${value.slice(end)}`;
        caret = [lineStart, lineStart + prefixed.length];
      }

      onChange(next);
      /* Restore the selection after React has written the new value back into the textarea. */
      requestAnimationFrame(() => {
        element.focus();
        element.setSelectionRange(caret[0], caret[1]);
      });
    },
    [onChange, value],
  );

  const tab = (target: Mode, label: string, hiddenBelowLg = false) => (
    <button
      key={target}
      type="button"
      onClick={() => setMode(target)}
      aria-pressed={mode === target}
      className={cn(
        "cursor-pointer rounded-[var(--radius-sm)] px-2.5 py-1 text-xs transition-colors",
        mode === target ? "bg-neutral-800 text-text" : "text-neutral-500 hover:text-neutral-300",
        hiddenBelowLg && "hidden lg:inline-flex",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-bg">
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 px-2 py-1.5">
        {ACTIONS.map(({id: actionId, icon: Icon, action}) => (
          <button
            key={actionId}
            type="button"
            onClick={() => apply(action)}
            disabled={disabled || mode === "preview"}
            title={t(`prose:markdown.${actionId}`)}
            aria-label={t(`prose:markdown.${actionId}`)}
            className="cursor-pointer rounded-[var(--radius-sm)] p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon size={15}/>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-0.5">
          {action}
          {tab("write", t("prose:markdown.write"))}
          {tab("preview", t("prose:markdown.preview"))}
          {tab("split", t("prose:markdown.split"), true)}
        </div>
      </div>

      <div className={cn("grid", mode === "split" && "lg:grid-cols-2 lg:divide-x lg:divide-neutral-800")}>
        {mode !== "preview" && (
          <Textarea
            ref={area}
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={rows}
            disabled={disabled}
            spellCheck
            className="resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-relaxed focus:border-0"
            {...rest}
          />
        )}

        {mode !== "write" && (
          <div id={previewId} className={cn("overflow-y-auto px-4 py-3", PROSE_CLASS)} style={{minHeight: rows * 22}}>
            {value.trim() ? (
              /* Sanitized in `renderMarkdown`; see the note there on why a preview needs it too. */
              <div dangerouslySetInnerHTML={{__html: html}}/>
            ) : (
              <p className="flex items-center gap-2 text-[13px] text-neutral-600">
                <Eye size={15}/> {t("prose:markdown.preview_empty")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 px-3 py-1.5 text-[11px] text-neutral-600">
        <span>{t("prose:markdown.hint")}</span>
        <span>
          {maxLength
            ? t("prose:markdown.count_max", {count: value.length, max: maxLength})
            : t("prose:markdown.count", {count: value.length})}
          {value.trim() && ` · ${t("prose:markdown.reading", {minutes: readingMinutes(value)})}`}
        </span>
      </div>
    </div>
  );
};
