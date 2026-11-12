/**
 * Byte size of data items (group and elementary) of a fixed-format NetCOBOL source.
 *
 * Only what can be computed without guessing is computed. Anything that depends on
 * compiler options or on contents not in the file (COMP/BINARY without a chosen rule,
 * SYNC, OCCURS DEPENDING ON, INDEX/POINTER, COPY that is not expanded) is reported as
 * "unknown" with a reason, and every group containing such an item is unknown as well.
 *
 * Pure TypeScript (no vscode import).
 */
import { CLAUSE_WORDS, StructNode } from './structure';

/**
 * How COMP / BINARY / COMP-4 / COMP-5 integers are sized (by number of digits in the PIC):
 *  - none:    not computed (default)
 *  - 2-4-8:   1-4 digits 2 bytes, 5-9 digits 4 bytes, 10-18 digits 8 bytes
 *  - 1-2-4-8: 1-2 digits 1 byte, 3-4 digits 2 bytes, 5-9 digits 4 bytes, 10-18 digits 8 bytes
 */
export type BinaryRule = 'none' | '2-4-8' | '1-2-4-8';

export interface SizeOptions {
  binary: BinaryRule;
}

export const DEFAULT_SIZE_OPTIONS: SizeOptions = { binary: 'none' };

/** Shift_JIS: one national (N) character is 2 bytes. */
const NATIONAL_BYTES = 2;

export interface SizeRow {
  node: StructNode;
  /** nesting depth below the node the layout was requested for (0 = that node) */
  depth: number;
  /** byte offset from the start of the requested node; undefined when not computable */
  offset?: number;
  /** bytes of one occurrence */
  unit?: number;
  /** OCCURS count (1 when there is none) */
  occurs: number;
  /** bytes including OCCURS; undefined = not computed */
  bytes?: number;
  /** why `bytes` could not be computed */
  reason?: string;
  /** name of the item this entry REDEFINES */
  redefines?: string;
}

interface Measured {
  unit?: number;
  occurs: number;
  total?: number;
  reason?: string;
}

/** Total size of a data item (including OCCURS), or the reason it is not computed. */
export function sizeOf(node: StructNode, opts: SizeOptions = DEFAULT_SIZE_OPTIONS): { bytes?: number; reason?: string } {
  const rows = layout(node, opts);
  return { bytes: rows[0].bytes, reason: rows[0].reason };
}

/** Pre-order rows for `node` and everything below it (88 and 66 entries are skipped). */
export function layout(node: StructNode, opts: SizeOptions = DEFAULT_SIZE_OPTIONS): SizeRow[] {
  const rows: SizeRow[] = [];
  measure(node, undefined, opts, rows, 0, 0);
  return rows;
}

// ---------------------------------------------------------------- clause parsing

interface Clauses {
  pic?: string;
  usage?: string;
  occurs?: { min: number; max?: number; depending: boolean };
  redefines?: string;
  signSeparate: boolean;
  sync: boolean;
}

const USAGE_RE =
  /(?:^|\s)(?:USAGE\s+(?:IS\s+)?)?(COMP-[1-5X]|COMPUTATIONAL(?:-[1-5X])?|COMP|BINARY|PACKED-DECIMAL|DISPLAY|NATIONAL|INDEX|PROCEDURE-POINTER|FUNCTION-POINTER|POINTER|OBJECT\s+REFERENCE)(?=[\s.]|$)/;
const PIC_RE = /(?:^|\s)PIC(?:TURE)?(?:\s+IS)?\s+(\S+?)(?=\.?(?:\s|$))/;
const OCCURS_RE = /(?:^|\s)OCCURS\s+(\d+)(?:\s+TO\s+(\d+))?/;
const REDEFINES_RE = /(?:^|\s)REDEFINES\s+(\S+?)(?=[\s.]|$)/;
const SEPARATE_RE = /(?:^|\s)(?:LEADING|TRAILING)\s+SEPARATE(?:\s+CHARACTER)?(?=[\s.]|$)/;
const SYNC_RE = /(?:^|\s)SYNC(?:HRONIZED)?(?=[\s.]|$)/;

/** literals and pseudo-text become blanks; upper case; no trailing period */
function clean(entry: string): string {
  return entry
    .replace(/==[\s\S]*?==/g, (m) => ' '.repeat(m.length))
    .replace(/"[^"]*"|'[^']*'/g, (m) => ' '.repeat(m.length))
    .toUpperCase();
}

function parseClauses(entry: string): Clauses {
  let t = clean(entry).trim().replace(/^\d+\s*/, '');
  // drop the data name so that it cannot look like a clause
  const name = /^(\S+)/.exec(t);
  if (name && !CLAUSE_WORDS.has(name[1].replace(/\.$/, ''))) t = t.slice(name[1].length);
  t = ' ' + t;
  const out: Clauses = { signSeparate: SEPARATE_RE.test(t), sync: SYNC_RE.test(t) };
  const pic = PIC_RE.exec(t);
  if (pic) out.pic = pic[1];
  // search USAGE outside the PICTURE string (a picture never contains blanks)
  const usage = USAGE_RE.exec(pic ? t.replace(pic[0], ' ') : t);
  if (usage) out.usage = usage[1].replace(/\s+/g, ' ').replace('COMPUTATIONAL', 'COMP');
  const occ = OCCURS_RE.exec(t);
  if (occ) out.occurs = { min: Number(occ[1]), max: occ[2] ? Number(occ[2]) : undefined, depending: /(?:^|\s)DEPENDING(?=[\s.]|$)/.test(t) };
  const red = REDEFINES_RE.exec(t);
  if (red) out.redefines = red[1];
  return out;
}

// ---------------------------------------------------------------- PICTURE

interface Pic {
  chars: string; // expanded, upper case
  digits: number; // number of 9
  numeric: boolean; // only 9 S V P
  national: number; // number of N
}

const PIC_CHARS = /^[AX9SVPNZ*B0/,.+\-$CRD]+$/;

function expandPic(pic: string): Pic | undefined {
  let s = pic.toUpperCase().replace(/\.$/, '');
  s = s.replace(/(.)\((\d+)\)/g, (_m, c: string, n: string) => c.repeat(Math.min(Number(n), 100000)));
  if (!PIC_CHARS.test(s)) return undefined;
  const count = (c: string) => s.split(c).length - 1;
  return { chars: s, digits: count('9'), numeric: /^[9SVP]+$/.test(s), national: count('N') };
}

function binaryBytes(digits: number, rule: BinaryRule): number | undefined {
  if (digits < 1 || digits > 18) return undefined;
  if (rule === '2-4-8') return digits <= 4 ? 2 : digits <= 9 ? 4 : 8;
  if (rule === '1-2-4-8') return digits <= 2 ? 1 : digits <= 4 ? 2 : digits <= 9 ? 4 : 8;
  return undefined;
}

// ---------------------------------------------------------------- measuring

function measure(
  node: StructNode,
  inheritedUsage: string | undefined,
  opts: SizeOptions,
  rows: SizeRow[],
  depth: number,
  offset: number | undefined
): Measured {
  const row: SizeRow = { node, depth, offset, occurs: 1 };
  rows.push(row);
  const done = (m: Measured): Measured => {
    row.occurs = m.occurs;
    row.unit = m.unit;
    row.bytes = m.total;
    row.reason = m.reason;
    return m;
  };
  const unknown = (reason: string, occurs = 1): Measured => done({ occurs, reason });

  if (node.kind === 'copy') return unknown('COPY');
  if (node.kind !== 'data' || node.entry === undefined) return unknown('entry');

  const c = parseClauses(node.entry);
  if (c.redefines) row.redefines = c.redefines;
  let occurs = 1;
  if (c.occurs) {
    if (c.occurs.depending || c.occurs.max !== undefined) return unknown('OCCURS DEPENDING ON');
    occurs = c.occurs.min;
  }
  if (c.sync) return unknown('SYNC', occurs);

  const usage = c.usage ?? inheritedUsage;
  const kids = node.children.filter((k) => k.kind === 'copy' || (k.kind === 'data' && k.level !== 88 && k.level !== 66));

  // ---- group item
  if (kids.length > 0 && !c.pic) {
    let cursor = offset; // undefined once an item of unknown size has been passed
    let sum = 0;
    let firstUnknown: string | undefined;
    const placed = new Map<string, number | undefined>();
    for (const k of kids) {
      const kc = k.kind === 'data' && k.entry !== undefined ? parseClauses(k.entry) : undefined;
      const redef = kc?.redefines;
      if (redef !== undefined && !placed.has(redef)) {
        measure(k, usage, opts, rows, depth + 1, undefined);
        firstUnknown ??= `${k.label} (REDEFINES)`;
        continue;
      }
      const m = measure(k, usage, opts, rows, depth + 1, redef !== undefined ? placed.get(redef) : cursor);
      if (k.key) placed.set(k.key, redef !== undefined ? placed.get(redef) : cursor);
      if (redef !== undefined) continue; // shares the storage of the item it redefines
      if (m.total === undefined) {
        firstUnknown ??= `${k.label}${m.reason ? ` (${m.reason})` : ''}`;
        cursor = undefined;
      } else {
        sum += m.total;
        if (cursor !== undefined) cursor += m.total;
      }
    }
    if (firstUnknown !== undefined) return unknown(firstUnknown, occurs);
    return done({ unit: sum, occurs, total: sum * occurs });
  }

  // ---- elementary item
  if (usage === 'INDEX' || usage === 'POINTER' || usage === 'PROCEDURE-POINTER' || usage === 'FUNCTION-POINTER' || usage === 'OBJECT REFERENCE') {
    return unknown(usage, occurs);
  }
  if (usage === 'COMP-1' || usage === 'COMP-2') {
    const unit = usage === 'COMP-1' ? 4 : 8;
    return done({ unit, occurs, total: unit * occurs });
  }
  if (!c.pic) return unknown('no PIC', occurs);
  const pic = expandPic(c.pic);
  if (!pic) return unknown('PIC', occurs);

  let unit: number | undefined;
  let why: string | undefined;
  if (pic.national > 0) {
    if (pic.national !== pic.chars.length) why = 'PIC';
    else if (usage && usage !== 'DISPLAY' && usage !== 'NATIONAL') why = usage;
    else unit = pic.national * NATIONAL_BYTES;
  } else if (usage === 'COMP-3' || usage === 'PACKED-DECIMAL') {
    if (!pic.numeric || pic.digits < 1) why = 'PIC';
    else unit = Math.floor(pic.digits / 2) + 1;
  } else if (usage && /^(COMP|BINARY|COMP-[45X])$/.test(usage)) {
    if (!pic.numeric) why = 'PIC';
    else {
      unit = binaryBytes(pic.digits, opts.binary);
      if (unit === undefined) why = pic.digits > 18 || pic.digits < 1 ? usage : `${usage}: option`;
    }
  } else if (usage === undefined || usage === 'DISPLAY') {
    const stored = pic.chars.replace(/[VSP]/g, '').length;
    unit = stored + (pic.numeric && pic.chars.includes('S') && c.signSeparate ? 1 : 0);
  } else if (usage === 'NATIONAL') {
    why = 'NATIONAL';
  } else why = usage;

  if (unit === undefined) return unknown(why ?? 'PIC', occurs);
  return done({ unit, occurs, total: unit * occurs });
}
