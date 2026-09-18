import {useMemo} from "react";
import {renderMarkdown} from "@/lib/prose/markdown.ts";
import {cn} from "@/lib/utils.ts";

/**
 * The Markdown a page actually shows a visitor.
 *
 * `renderMarkdown` is shared with the CMS's editor preview — same parser, same sanitizer — so what
 * an editor sees while writing is what a reader gets. What differs is the scale: the CMS's
 * `PROSE_CLASS` is sized for a preview pane beside a form, and a product page is a page. Reading
 * size, heading rhythm and image treatment are set here rather than by overriding that class at
 * every call site.
 *
 * The sanitizer is not optional even though this text comes from our own CMS: Markdown passes raw
 * HTML through by design, and the one place it is rendered is the one place a stored script would
 * run.
 */
const PAGE_PROSE = [
  "text-[15px] leading-relaxed text-neutral-300",
  "[&_h1]:mt-10 [&_h1]:mb-4 [&_h1]:text-[28px] [&_h1]:leading-tight [&_h1]:text-text [&_h1:first-child]:mt-0",
  "[&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-[22px] [&_h2]:leading-snug [&_h2]:text-text [&_h2:first-child]:mt-0",
  "[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[18px] [&_h3]:text-text",
  "[&_p]:my-4",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-1.5",
  "[&_a]:text-accent-300 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent-200",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-accent-700 [&_blockquote]:pl-4 [&_blockquote]:text-neutral-400",
  "[&_code]:rounded-[var(--radius-sm)] [&_code]:bg-neutral-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]",
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:bg-neutral-900 [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-8 [&_hr]:border-neutral-800",
  "[&_img]:my-5 [&_img]:max-w-full [&_img]:rounded-[var(--radius-md)]",
  "[&_table]:my-5 [&_table]:w-full [&_table]:text-left",
  "[&_th]:border-b [&_th]:border-neutral-700 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-neutral-400",
  "[&_td]:border-b [&_td]:border-neutral-800/70 [&_td]:py-2 [&_td]:pr-4",
  "[&_strong]:text-text",
].join(" ");

export const ApplicationProse = ({source, className}: {source: string; className?: string}) => {
  const html = useMemo(() => renderMarkdown(source), [source]);

  /* Sanitized in `renderMarkdown`; see the note there. */
  return <div className={cn(PAGE_PROSE, className)} dangerouslySetInnerHTML={{__html: html}}/>;
};

export {PAGE_PROSE};
