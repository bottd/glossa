/** Lowercase, trim, and collapse internal whitespace for consistent keys. */
export function normalizeTerm(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Parse the mention input as a single tag — no splitting, the whole phrase is one tag. */
export function parseTag(input: string): { tag: string; display: string } | null {
  const display = input.trim();
  if (!display) return null;
  return { tag: normalizeTerm(display), display };
}

/** Truncate to `max` characters with an ellipsis. */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
