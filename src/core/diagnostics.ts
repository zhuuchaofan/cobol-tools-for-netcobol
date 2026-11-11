/**
 * Format checks for fixed-format NetCOBOL source. Pure TypeScript, no vscode.
 *
 * Rule codes (messages live in extension.ts / l10n):
 *   NC001 error   invalid character in the indicator area (column 7)
 *   NC002 error   full-width character straddles an area boundary (6|7, 7|8, 72|73;
 *                 72|73 is ignored on comment lines and inside *> comments)
 *   NC003 warning text continues past column 72 (73- is ignored by the compiler)
 *   NC004 warning line longer than maxLineLength columns
 *   NC005 warning division/section/paragraph header, FD, 01/77 not in area A
 *   NC006 warning procedure statement starts in area A
 *   NC007 error   literal not closed by column 72 and not continued
 *   NC008 error   continuation line of a literal must start with a quote
 *   NC009 warning full-width space outside a literal or comment
 *   NC010 warning tab character (shifts column positions)
 *   NC011 warning continuation line has text in area A
 *   NC012-NC014   sequence area checks, see sequence.ts
 */
import {
  AREA_A_END,
  AREA_A_START,
  AREA_B_END,
  Cell,
  ColumnMode,
  IDENT_START,
  INDICATOR_COL,
  LineColumns,
  SEQUENCE_END
} from './columns';
import { analyzeSequence } from './sequence';

export type RuleCode =
  | 'NC001' | 'NC002' | 'NC003' | 'NC004' | 'NC005' | 'NC006'
  | 'NC007' | 'NC008' | 'NC009' | 'NC010' | 'NC011'
  | 'NC012' | 'NC013' | 'NC014';

export type Severity = 'error' | 'warning' | 'info';

export interface RawDiagnostic {
  code: RuleCode;
  severity: Severity;
  line: number; // 0-based
  start: number; // UTF-16 offset in line
  end: number;
  args: string[];
}

export interface AnalyzeOptions {
  mode: ColumnMode;
  maxLineLength: number; // 0 = off
  disabledRules?: Iterable<string>;
}

const SEVERITY: Record<RuleCode, Severity> = {
  NC001: 'error',
  NC002: 'error',
  NC003: 'warning',
  NC004: 'warning',
  NC005: 'warning',
  NC006: 'warning',
  NC007: 'error',
  NC008: 'error',
  NC009: 'warning',
  NC010: 'warning',
  NC011: 'warning',
  NC012: 'info',
  NC013: 'info',
  NC014: 'info'
};

const VALID_INDICATORS = new Set([' ', '*', '/', '-', 'D', 'd']);

const WORD_CHAR = /[A-Za-z0-9_\-぀-ヿ㐀-鿿豈-﫿０-９Ａ-Ｚａ-ｚｦ-ﾟ－]/;
const END = '(?![A-Z0-9_\\-])';

const RE_DIVISION = new RegExp(`^(IDENTIFICATION|ID|ENVIRONMENT|DATA|PROCEDURE)\\s+DIVISION${END}`);
const AREA_A_HEADERS: RegExp[] = [
  RE_DIVISION,
  new RegExp(`^\\S+\\s+SECTION${END}`),
  new RegExp(`^(FD|SD|RD|CD)\\s`),
  new RegExp(`^(END\\s+)?DECLARATIVES${END}`),
  new RegExp(`^END\\s+(PROGRAM|CLASS|METHOD|FACTORY|OBJECT)${END}`),
  /^(PROGRAM-ID|CLASS-ID|METHOD-ID|AUTHOR|INSTALLATION|DATE-WRITTEN|DATE-COMPILED|SECURITY|SOURCE-COMPUTER|OBJECT-COMPUTER|SPECIAL-NAMES|FILE-CONTROL|I-O-CONTROL|REPOSITORY)\s*\./
];
const RE_LEVEL_A = /^(0?1|77)(\s|$)/;

/** Verbs that start a statement; these belong in area B. */
const STATEMENT_VERBS = new Set([
  'ACCEPT', 'ADD', 'CALL', 'CANCEL', 'CLOSE', 'COMPUTE', 'CONTINUE', 'DELETE',
  'DISPLAY', 'DIVIDE', 'ELSE', 'END-EVALUATE', 'END-IF', 'END-PERFORM',
  'EVALUATE', 'EXEC', 'EXIT', 'GO', 'GOBACK', 'IF', 'INITIALIZE', 'INSPECT',
  'INVOKE', 'MERGE', 'MOVE', 'MULTIPLY', 'NEXT', 'OPEN', 'PERFORM', 'READ',
  'RELEASE', 'RETURN', 'REWRITE', 'SEARCH', 'SET', 'SORT', 'START', 'STOP',
  'STRING', 'SUBTRACT', 'UNSTRING', 'WHEN', 'WRITE'
]);

interface PendingLiteral {
  line: number;
  start: number;
  end: number;
  quote: string;
}

export function analyze(lines: readonly string[], opts: AnalyzeOptions): RawDiagnostic[] {
  const out: RawDiagnostic[] = [];
  const disabled = new Set(opts.disabledRules ?? []);
  const push = (code: RuleCode, line: number, start: number, end: number, args: string[] = []) => {
    if (!disabled.has(code)) out.push({ code, severity: SEVERITY[code], line, start, end: Math.max(end, start + 1), args });
  };

  let division: string | undefined;
  let pending: PendingLiteral | undefined;
  let inSql = false;

  for (let ln = 0; ln < lines.length; ln++) {
    const text = lines[ln].replace(/\r$/, '');
    if (text.length === 0) continue;
    const lc = new LineColumns(text, opts.mode);

    // NC010 tabs (anywhere on the line)
    for (let i = text.indexOf('\t'); i >= 0; i = text.indexOf('\t', i + 1)) {
      push('NC010', ln, i, i + 1);
    }

    // NC004 line too long
    if (opts.maxLineLength > 0 && lc.totalWidth > opts.maxLineLength) {
      push('NC004', ln, lc.offsetAtCol(opts.maxLineLength + 1), text.length, [String(opts.maxLineLength), String(lc.totalWidth)]);
    }

    if (lc.totalWidth < INDICATOR_COL) continue; // only sequence area present

    const indCell = lc.cellAtCol(INDICATOR_COL)!;
    const indicatorOk = indCell.col === INDICATOR_COL && indCell.width === 1;
    const ind = indicatorOk ? indCell.ch : '';
    const isComment = ind === '*' || ind === '/';

    // NC002 full-width char across the 6|7 or 7|8 boundary (72|73 is checked after the scan,
    // because it is ignored inside comments)
    for (const b of [SEQUENCE_END, INDICATOR_COL]) {
      const c = lc.cellAtCol(b);
      if (c && c.width > 1 && c.col + c.width - 1 > b) {
        push('NC002', ln, c.start, c.end, [c.ch, String(b), String(b + 1)]);
      }
    }

    // NC001 indicator
    if (indicatorOk && !VALID_INDICATORS.has(ind)) {
      push('NC001', ln, indCell.start, indCell.end, [ind === '\t' ? 'TAB' : ind]);
    }

    if (isComment) continue;

    const contentStart = lc.offsetAtCol(AREA_A_START);
    const contentEnd = lc.offsetAtCol(IDENT_START);
    const content = text.slice(contentStart, contentEnd);
    const isContinuation = ind === '-';
    const isBlank = content.trim() === '';

    /**
     * Column 72|73 checks. `commentStart` is the absolute offset where a `*>` (or `--` in
     * EXEC SQL) comment begins on this line, or -1. Anything inside a comment is ignored.
     */
    const check72 = (commentStart: number) => {
      const c72 = lc.cellAtCol(AREA_B_END);
      if (!c72 || (commentStart >= 0 && c72.start >= commentStart)) return;
      // NC002 full-width char on columns 72-73
      if (c72.width > 1 && c72.col + c72.width - 1 > AREA_B_END) {
        push('NC002', ln, c72.start, c72.end, [c72.ch, String(AREA_B_END), String(IDENT_START)]);
        return;
      }
      // NC003 code running past column 72
      const c73 = lc.cellAtCol(IDENT_START);
      if (c73 && !/\s/.test(c72.ch) && !/\s/.test(c73.ch)) {
        let e = c73.start;
        while (e < text.length && !/\s/.test(text[e])) e++;
        push('NC003', ln, c73.start, e);
      }
    };

    if (isBlank && !isContinuation) continue;

    // NC011 continuation line with something in area A
    if (isContinuation) {
      const areaA = text.slice(contentStart, lc.offsetAtCol(AREA_A_END + 1));
      if (areaA.trim() !== '') {
        const s = contentStart + areaA.search(/\S/);
        push('NC011', ln, s, s + 1);
      }
    }

    // ---- literal continuation / unterminated literal
    let scanFrom = 0; // index into `content`
    let inStr: string | null = null;
    let strStart = 0; // absolute offset
    if (pending) {
      if (isContinuation) {
        const first = content.search(/\S/);
        if (first >= 0 && content[first] === pending.quote) {
          inStr = pending.quote;
          strStart = contentStart + first;
          scanFrom = first + 1;
        } else if (first >= 0) {
          push('NC008', ln, contentStart + first, contentStart + first + 1, [pending.quote]);
          pending = undefined;
          check72(-1);
          continue; // the rest of this line is ambiguous; don't cascade
        }
      } else {
        push('NC007', pending.line, pending.start, pending.end);
      }
      pending = undefined;
    }

    // ---- division tracking and area A / B checks (not on continuation lines)
    const firstIdx = content.search(/\S/);
    const tabBeforeFirst = firstIdx >= 0 && text.slice(0, contentStart + firstIdx).includes('\t');
    if (!isContinuation && !inSql && firstIdx >= 0) {
      const upper = content.slice(firstIdx).toUpperCase();
      const firstCol = lc.colAtOffset(contentStart + firstIdx);
      const wordLen = tokenLength(content, firstIdx);
      const tokStart = contentStart + firstIdx;
      const tokEnd = tokStart + wordLen;

      const div = RE_DIVISION.exec(upper);
      if (div) division = div[1] === 'ID' ? 'IDENTIFICATION' : div[1];

      const isHeader =
        AREA_A_HEADERS.some((r) => r.test(upper)) ||
        ((division === 'DATA' || division === undefined) && RE_LEVEL_A.test(upper));

      // with a tab before the first token the real column is unknown: skip area checks
      if (tabBeforeFirst) {
        // no-op
      } else if (isHeader && firstCol > AREA_A_END) {
        push('NC005', ln, tokStart, tokEnd, [content.substr(firstIdx, wordLen)]);
      } else if (!isHeader && division === 'PROCEDURE' && firstCol <= AREA_A_END) {
        const word = upper.slice(0, wordLen);
        if (STATEMENT_VERBS.has(word)) push('NC006', ln, tokStart, tokEnd, [content.substr(firstIdx, wordLen)]);
      }
    }

    // ---- scan area A/B for literals, full-width spaces, inline comments
    let commentStart = -1;
    for (let i = scanFrom; i < content.length; i++) {
      const ch = content[i];
      if (inStr) {
        if (ch === inStr) {
          if (content[i + 1] === inStr) i++;
          else inStr = null;
        }
        continue;
      }
      if ((ch === '*' && content[i + 1] === '>') || (inSql && ch === '-' && content[i + 1] === '-')) {
        commentStart = contentStart + i;
        break;
      }
      if (ch === '"' || ch === "'") {
        inStr = ch;
        strStart = contentStart + i;
        continue;
      }
      if (ch === '　') {
        push('NC009', ln, contentStart + i, contentStart + i + 1);
        continue;
      }
      if (WORD_CHAR.test(ch) && (i === 0 || !WORD_CHAR.test(content[i - 1]))) {
        const len = tokenLength(content, i);
        const w = content.substr(i, len).toUpperCase();
        if (w === 'EXEC' && /^\s+SQL(?![A-Za-z0-9_-])/i.test(content.slice(i + len))) inSql = true;
        else if (w === 'END-EXEC') inSql = false;
        i += len - 1;
      }
    }
    if (inStr) {
      pending = { line: ln, start: strStart, end: Math.max(contentEnd, strStart + 1), quote: inStr };
    }
    check72(commentStart);
  }

  if (pending) push('NC007', pending.line, pending.start, pending.end);

  for (const s of analyzeSequence(lines, opts.mode)) push(s.code, s.line, s.start, s.end, s.args);
  return out;
}

function tokenLength(s: string, from: number): number {
  let i = from;
  if (!WORD_CHAR.test(s[i] ?? '')) {
    // non-word token: take up to next whitespace
    while (i < s.length && !/\s/.test(s[i])) i++;
    return Math.max(1, i - from);
  }
  while (i < s.length && WORD_CHAR.test(s[i])) i++;
  return i - from;
}

export type { Cell };
