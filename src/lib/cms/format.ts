/** Presentation helpers particular to the CMS. */

/** A rough "5 min read" figure for the markdown editor's footer. */
export const readingMinutes = (source: string) => Math.max(1, Math.round(source.trim().split(/\s+/).length / 200));
