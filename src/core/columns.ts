/**
 * Column model for fixed-format NetCOBOL source.
 *
 * NetCOBOL counts columns in bytes of the source encoding, not in characters.
 * For Shift_JIS a full-width character occupies two columns, so
 * "01 名前" ends two columns later than the character count suggests.
 * Everything that talks about "column N" in this extension goes through here.
 *
 * Pure TypeScript (no vscode import) so it can be unit-tested with plain node.
 */

export type ColumnMode = 'shiftjis' | 'utf8' | 'character';

export const SEQUENCE_END = 6; // columns 1-6
export const INDICATOR_COL = 7;
export const AREA_A_START = 8;
export const AREA_A_END = 11;
export const AREA_B_START = 12;
export const AREA_B_END = 72;
export const IDENT_START = 73;

/** Width in columns of one code point. */
export function charWidth(cp: number, mode: ColumnMode): number {
  switch (mode) {
    case 'character':
      return 1;
    case 'utf8':
      return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    case 'shiftjis':
    default:
      if (cp < 0x80) return 1;
      if (cp >= 0xff61 && cp <= 0xff9f) return 1; // half-width katakana
      if (cp === 0xa5 || cp === 0x203e) return 1; // ¥ ‾ (JIS X 0201 single byte)
      return 2;
  }
}

export interface Cell {
  /** UTF-16 offset of the first code unit */
  start: number;
  /** UTF-16 offset after the last code unit */
  end: number;
  /** 1-based column where this character begins */
  col: number;
  /** number of columns the character occupies */
  width: number;
  ch: string;
}

export class LineColumns {
  readonly cells: Cell[] = [];
  readonly totalWidth: number;

  constructor(readonly text: string, mode: ColumnMode) {
    let col = 1;
    let i = 0;
    while (i < text.length) {
      const cp = text.codePointAt(i)!;
      const len = cp > 0xffff ? 2 : 1;
      const width = charWidth(cp, mode);
      this.cells.push({ start: i, end: i + len, col, width, ch: text.slice(i, i + len) });
      col += width;
      i += len;
    }
    this.totalWidth = col - 1;
  }

  /** The character that covers `col` (begins at or spans over it). */
  cellAtCol(col: number): Cell | undefined {
    // binary search: cells are sorted by col
    let lo = 0;
    let hi = this.cells.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = this.cells[mid];
      if (col < c.col) hi = mid - 1;
      else if (col >= c.col + c.width) lo = mid + 1;
      else return c;
    }
    return undefined;
  }

  /** UTF-16 offset of the first character that begins at column >= `col`. */
  offsetAtCol(col: number): number {
    for (const c of this.cells) {
      if (c.col >= col) return c.start;
    }
    return this.text.length;
  }

  /** 1-based column at a UTF-16 offset (offset must be a cell start or text end). */
  colAtOffset(offset: number): number {
    for (const c of this.cells) {
      if (c.start >= offset) return c.col;
    }
    return this.totalWidth + 1;
  }
}

/** UTF-16 ranges of the sequence area (1-6) and identification area (73-). */
export function fixedAreaRanges(text: string, mode: ColumnMode): { sequenceEnd: number; identStart: number } {
  const lc = new LineColumns(text, mode);
  return {
    sequenceEnd: lc.offsetAtCol(INDICATOR_COL),
    identStart: lc.offsetAtCol(IDENT_START)
  };
}
