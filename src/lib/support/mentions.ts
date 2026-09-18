/**
 * `@mentions` inside a ticket message body.
 *
 * A message body is plain text end to end — see the root `CLAUDE.md` note that there is no column
 * for HTML anywhere near a ticket — so a mention cannot be stored as a link. It is written as
 * `@` immediately followed by an email address (`@fran@franciscosolis.cl`), which reads fine as
 * plain text on its own, and is turned into a `mailto:` link only at render time, here and in the
 * reply-digest email template (`packages/emails/src/templates/support-ticket-reply.tsx`, which
 * carries its own copy of this pattern — the two live in separate repositories).
 */
const MENTION_PATTERN = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export type MentionPart = {kind: "text"; value: string} | {kind: "mention"; email: string};

/** Splits a message body into plain-text runs and mentioned addresses, in order. */
export const splitMentions = (text: string): MentionPart[] => {
  const parts: MentionPart[] = [];
  let last = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({kind: "text", value: text.slice(last, index)});
    parts.push({kind: "mention", email: match[1]});
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({kind: "text", value: text.slice(last)});

  return parts;
};
