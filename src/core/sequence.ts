/**
 * Sequence area (columns 1-6): checks and renumbering. Pure TypeScript, no vscode.
 *
 *   NC012 info  sequence area is blank (consecutive blank lines are reported once)
 *   NC013 info  sequence area is not a 6-digit number
 *   NC014 info  sequence number is not greater than the previous one
 *
 * Lines that are entirely empty count as "blank" (they get a number when renumbered),
 * except the very last line of a file that ends with a newline.
 */
import { ColumnMode, INDICATOR_COL, LineColumns, SEQUENCE_END } from './columns';

export const SEQ_MAX = 999999;

export interface SequenceIssue {
  code: 'NC012' | 'NC013' | 'NC014';
  line: number;
  start: number;
  end: number;
  args: string[];
}

export interface SequenceEdit {
  line: number;
  /** UTF-16 range of the old sequence area to replace */
  start: number;
  end: number;
  newText: string;
}

export interface RenumberResult {
  edits: SequenceEdit[];
  /** lines left untouched because a full-width char straddles columns 6|7 */
  skipped: number[];
  first?: number;
  last?: number;
  overflow: boolean;
}

/** Number of lines that take part (drops the trailing empty line after the final newline). */
export function effectiveLineCount(lines: readonly string[]): number {
  let n = lines.length;
  if (n > 0 && lines[n - 1] === '') n--;
  return n;
}

interface SeqInfo {
  /** UTF-16 offset where the sequence area ends */
  end: number;
  text: string;
  /** a full-width char sits on columns 6-7 */
  straddles: boolean;
}

function seqInfo(line: string, mode: ColumnMode): SeqInfo {
  const lc = new LineColumns(line, mode);
  const c6 = lc.cellAtCol(SEQUENCE_END);
  const straddles = !!c6 && c6.col + c6.width - 1 > SEQUENCE_END;
  const end = lc.offsetAtCol(INDICATOR_COL);
  return { end, text: line.slice(0, end), straddles };
}

export const formatSeq = (n: number) => String(n).padStart(6, '0');

export function analyzeSequence(lines: readonly string[], mode: ColumnMode): SequenceIssue[] {
  const out: SequenceIssue[] = [];
  const n = effectiveLineCount(lines);
  let prev: { n: number; text: string } | undefined;
  let blankRun: number[] = [];

  const flushBlank = () => {
    if (blankRun.length === 0) return;
    const first = blankRun[0];
    const last = blankRun[blankRun.length - 1];
    const end = seqInfo(lines[first], mode).end;
    out.push({ code: 'NC012', line: first, start: 0, end, args: [String(blankRun.length), String(first + 1), String(last + 1)] });
    blankRun = [];
  };

  for (let i = 0; i < n; i++) {
    const s = seqInfo(lines[i], mode);
    if (s.text.trim() === '') {
      blankRun.push(i);
      continue;
    }
    flushBlank();
    if (!/^\d{6}$/.test(s.text)) {
      out.push({ code: 'NC013', line: i, start: 0, end: s.end, args: [s.text] });
      continue;
    }
    const num = Number(s.text);
    if (prev && num <= prev.n) {
      out.push({ code: 'NC014', line: i, start: 0, end: s.end, args: [s.text, prev.text] });
    }
    prev = { n: num, text: s.text };
  }
  flushBlank();
  return out;
}

/**
 * Renumber lines [from, to] (inclusive, 0-based).
 * The first line gets `firstNumber`, each next line +step.
 */
export function renumber(
  lines: readonly string[],
  mode: ColumnMode,
  from: number,
  to: number,
  firstNumber: number,
  step: number
): RenumberResult {
  const n = effectiveLineCount(lines);
  to = Math.min(to, n - 1);
  const result: RenumberResult = { edits: [], skipped: [], overflow: false };
  if (from > to) return result;
  if (firstNumber + (to - from) * step > SEQ_MAX) {
    result.overflow = true;
    return result;
  }
  let num = firstNumber;
  for (let i = from; i <= to; i++, num += step) {
    const s = seqInfo(lines[i], mode);
    if (s.straddles) {
      result.skipped.push(i);
      continue;
    }
    const text = formatSeq(num);
    if (result.first === undefined) result.first = num;
    result.last = num;
    if (s.text !== text) result.edits.push({ line: i, start: 0, end: s.end, newText: text });
  }
  return result;
}

/**
 * Number for the first line of a partial renumber: the nearest valid number above `line`
 * plus `step`, or `start` when there is none.
 */
export function numberAfterPrevious(lines: readonly string[], mode: ColumnMode, line: number, start: number, step: number): number {
  for (let i = line - 1; i >= 0; i--) {
    const t = seqInfo(lines[i], mode).text;
    if (/^\d{6}$/.test(t)) return Number(t) + step;
  }
  return start;
}
