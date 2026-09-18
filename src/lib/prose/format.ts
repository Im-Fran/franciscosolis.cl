/** Presentation helpers shared by every prose editor on this site. */

/** A rough "5 min read" figure for the markdown editor's footer. */
export const readingMinutes = (source: string) => Math.max(1, Math.round(source.trim().split(/\s+/).length / 200));
