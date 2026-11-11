/**
 * Copybook lookup rules (pure; directory listing is supplied by the caller).
 *
 * COPY name            → name, name.cbl, name.cob, … (extensions setting), case-insensitive
 * COPY name OF lib     → the same, first inside a sub-directory named lib, then directly
 * COPY "dir/file.cbl"  → treated as a relative path first, then like a plain name
 */

export const DEFAULT_COPY_EXTENSIONS = ['', '.cbl', '.cob', '.cpy', '.cobol'];

/** File names to try for `name`, in order. */
export function candidateNames(name: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  for (const ext of extensions) {
    const n = name + ext;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Pick the entry of a directory listing that matches `name`.
 * An exact-case match wins over a case-insensitive one; extension order decides otherwise.
 */
export function matchEntry(entries: readonly string[], name: string, extensions: readonly string[]): string | undefined {
  for (const cand of candidateNames(name, extensions)) {
    if (entries.includes(cand)) return cand;
    const lower = cand.toLowerCase();
    const hit = entries.find((e) => e.toLowerCase() === lower);
    if (hit) return hit;
  }
  return undefined;
}

/** Find a sub-directory entry named `lib`, case-insensitively. */
export function matchDir(entries: readonly string[], lib: string): string | undefined {
  return entries.includes(lib) ? lib : entries.find((e) => e.toLowerCase() === lib.toLowerCase());
}
