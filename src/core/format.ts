/**
 * Source-wide properties that change how lines are read.
 *
 *  - Source format: NetCOBOL compiler option SRF(FIX|VAR|FREE). FIX has the 73-80
 *    identification area; VAR has no right margin; FREE has no sequence/indicator area
 *    (this extension only reads fixed-style columns, so FREE turns column checks off).
 *  - Debugging lines: a 'D' in column 7 is compiled only when SOURCE-COMPUTER has
 *    WITH DEBUGGING MODE; otherwise the line is treated as a comment.
 */
export type SourceFormat = 'fixed' | 'variable' | 'free';
export type FormatSetting = 'auto' | SourceFormat;

export interface FormatInfo {
  format: SourceFormat;
  debugging: boolean;
}

const SRF_RE = /@OPTIONS\b[^\n]*\bSRF\s*\(\s*(FIX|VAR|FREE)/i;
const DEBUG_RE = /\bDEBUGGING\s+MODE\b/i;

export function detectFormat(lines: readonly string[], setting: FormatSetting = 'auto'): FormatInfo {
  let format: SourceFormat = setting === 'auto' ? 'fixed' : setting;
  let debugging = false;
  let seenSrf = false;
  for (const raw of lines) {
    // column 7 '*' or '/' = comment line; skip
    const ind = raw.charAt(6);
    if (ind === '*' || ind === '/') continue;
    const text = raw.slice(7);
    if (!seenSrf && setting === 'auto') {
      const m = SRF_RE.exec(raw);
      if (m) {
        seenSrf = true;
        format = m[1].toUpperCase() === 'VAR' ? 'variable' : m[1].toUpperCase() === 'FREE' ? 'free' : 'fixed';
      }
    }
    if (!debugging && DEBUG_RE.test(text.replace(/\*>.*$/, ''))) debugging = true;
  }
  return { format, debugging };
}

/** Is this a debugging line ('D'/'d' in column 7)? Uses the character position, as the grammar does. */
export const isDebugLine = (line: string) => line.charAt(6) === 'D' || line.charAt(6) === 'd';
