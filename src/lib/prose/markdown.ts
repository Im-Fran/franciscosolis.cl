import DOMPurify from "dompurify";
import {marked} from "marked";

/**
 * Renders the markdown an editor is typing, for the preview pane beside the field.
 *
 * The output is sanitized even though it never leaves this browser: a preview shows what *another*
 * editor wrote as often as what you are writing yourself, and markdown passes raw HTML through by
 * design. Rendering it unsanitized would make an editor the one place on the site where a stored
 * script actually runs.
 *
 * It lives here, outside every section, because four of them render markdown now — the CMS's
 * entries and legal documents, an application page's prose, a help article, and the preview inside
 * the editor all of them share. A second copy in the section that needed it next is how two
 * sanitizer configurations end up on one site.
 */
export const renderMarkdown = (source: string) =>
  DOMPurify.sanitize(marked.parse(source, {async: false, gfm: true, breaks: false}), {
    /* `target` so the sanitizer keeps the attribute the renderer adds to outbound links. */
    ADD_ATTR: ["target", "rel"],
  });

/** Tailwind classes that give the rendered HTML the site's typography inside a preview pane. */
export const PROSE_CLASS = [
  "text-sm leading-relaxed text-neutral-300",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:text-text",
  "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:text-text",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:text-text",
  "[&_p]:my-3",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-1",
  "[&_a]:text-accent-300 [&_a]:underline [&_a]:underline-offset-4",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-700 [&_blockquote]:pl-4 [&_blockquote]:text-neutral-400",
  "[&_code]:rounded-[var(--radius-sm)] [&_code]:bg-neutral-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:bg-neutral-900 [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_hr]:my-6 [&_hr]:border-neutral-800",
  "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-[var(--radius-md)]",
  "[&_table]:my-3 [&_table]:w-full [&_table]:text-left",
  "[&_th]:border-b [&_th]:border-neutral-700 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-neutral-400 [&_th]:font-medium",
  "[&_td]:border-b [&_td]:border-neutral-800/70 [&_td]:py-2 [&_td]:pr-4",
  "[&_strong]:text-text",
].join(" ");
