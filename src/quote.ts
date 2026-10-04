/** A quote is a full line copied from the diff, never model-written text. */

export function pickQuote(diff: string): string | null {
  const lines = diff.split(/\r?\n/);
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++") && line.slice(1).trim() !== "");
  if (added.length > 0) return added[0] ?? null;
  const context = lines.filter((line) => line.startsWith(" ") && line.trim() !== "");
  if (context.length > 0) return context[0] ?? null;
  return null;
}

export function quoteInDiff(diff: string, quoteLine: string): boolean {
  if (!quoteLine) return false;
  return diff.split(/\r?\n/).includes(quoteLine);
}
