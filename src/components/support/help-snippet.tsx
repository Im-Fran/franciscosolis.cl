import DOMPurify from "dompurify";
import {useMemo} from "react";

/**
 * A search snippet, with the matched words highlighted.
 *
 * `/help/search` is the only endpoint in this API that returns markup: SQLite's `snippet()` wraps
 * the matched terms in `<mark>`. It is generated from stored article text rather than from the
 * query, so it is not user input — but it is still the one string on this page that reaches
 * `dangerouslySetInnerHTML`, so it goes through DOMPurify with an allowlist of exactly one tag and
 * no attributes. Anything else the database ever learns to emit arrives as plain text.
 */
export const HelpSnippet = ({html, className}: {html: string; className?: string}) => {
  const clean = useMemo(() => DOMPurify.sanitize(html, {ALLOWED_TAGS: ["mark"], ALLOWED_ATTR: []}), [html]);

  return (
    <span
      className={className}
      /* eslint-disable-next-line react/no-danger -- sanitized above to <mark> and nothing else. */
      dangerouslySetInnerHTML={{__html: clean}}
    />
  );
};
