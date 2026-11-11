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
 *   NC015 error   literal content: X"" hex digits in pairs, NX"" in fours, B"" only 0/1,
 *                 N""/NC"" only full-width characters (Shift_JIS)
 *   NC016 warning division / section header without a separator period
 *   NC017 warning level number other than 01-49, 66, 77, 88
 *   NC018 error   reserved word (付録A) used as a data, paragraph, section or file name
 *   NC019 warning literal length outside the limits of the manual (1.2.3)
 *   NC020 warning user-defined word breaks the formation rules (1.2.2.1)
 *
 * Debugging lines ('D' in column 7) are treated as comments unless the source has
 * WITH DEBUGGING MODE. @OPTIONS SRF(VAR) removes the column-72 margin; SRF(FREE)
 * turns the column-based checks off.
 */
import {
  AREA_A_END,
  AREA_A_START,
  AREA_B_END,
  Cell,
  ColumnMode,
  charWidth,
  IDENT_START,
  INDICATOR_COL,
  LineColumns,
  SEQUENCE_END
} from './columns';
import { FormatSetting, detectFormat } from './format';
import { CLAUSES, LISTING_DIRECTIVES, RESERVED_FOR_NAMES, USAGES } from './keywords';
import { analyzeSequence } from './sequence';

export type RuleCode =
  | 'NC001' | 'NC002' | 'NC003' | 'NC004' | 'NC005' | 'NC006'
  | 'NC007' | 'NC008' | 'NC009' | 'NC010' | 'NC011'
  | 'NC012' | 'NC013' | 'NC014'
  | 'NC015' | 'NC016' | 'NC017' | 'NC018' | 'NC019' | 'NC020';

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
  /** 'auto' reads @OPTIONS SRF(...) */
  format?: FormatSetting;
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
  NC014: 'info',
  NC015: 'error',
  NC016: 'warning',
  NC017: 'warning',
  NC018: 'error',
  NC019: 'warning',
  NC020: 'warning'
};

const LEVELS_OK = (n: number) => (n >= 1 && n <= 49) || n === 66 || n === 77 || n === 88;
/** words that may directly follow a level number in an entry without a name */
const ANONYMOUS_START = new Set([
  'FILLER', 'PIC', 'PICTURE', 'VALUE', 'VALUES', 'REDEFINES', 'RENAMES', 'OCCURS', 'USAGE',
  'SIGN', 'SYNC', 'SYNCHRONIZED', 'JUST', 'JUSTIFIED', 'BLANK', 'EXTERNAL', 'GLOBAL', 'INDEX',
  'DISPLAY', 'BINARY', 'COMP', 'COMPUTATIONAL', 'PACKED-DECIMAL', 'POINTER', 'NATIONAL',
  ...CLAUSES, ...USAGES
]);
/** lines that read like "WORD." in area A but are not paragraph names */
const NOT_PARAGRAPH_NAMES = new Set([...LISTING_DIRECTIVES, 'DECLARATIVES']);

/** limits of 1.2.3 (character / hex / national / national hex / boolean literal) */
const LITERAL_LIMITS: Record<string, { min: number; max: number; unit: 'bytes' | 'digits' | 'chars' }> = {
  '': { min: 1, max: 160, unit: 'bytes' },
  X: { min: 2, max: 320, unit: 'digits' },
  NX: { min: 4, max: 320, unit: 'digits' },
  N: { min: 1, max: 80, unit: 'chars' },
  B: { min: 1, max: 160, unit: 'digits' }
};
/** longest line of variable (and free) format, 付録B.1 */
const VARIABLE_MAX_BYTES = 251;
const USER_WORD_MAX = 30;

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
  start: number; // offset of the prefix / opening quote on `line`
  end: number; // end of the code on `line`
  quote: string;
  prefix: string; // '' | X | NX | N | B   (NC is folded into N)
  body: string; // text between the quotes so far, with doubled quotes folded
  /** where the part on the most recent line begins (NC007 points here) */
  segLine: number;
  segStart: number;
  segEnd: number;
}

/** Why a user-defined word is malformed, or '' when it is fine (1.2.2.1). */
export function userWordProblem(word: string, needsLetter: boolean): string {
  const ascii = /^[A-Za-z0-9_-]+$/.test(word);
  const chars = [...word];
  if (ascii) {
    if (chars.length > USER_WORD_MAX) return 'length';
    if (/^[-_]|[-_]$/.test(word)) return 'edge';
    if (/__/.test(word)) return 'underscores';
    if (needsLetter && !/[A-Za-z]/.test(word)) return 'noletter';
    return '';
  }
  // Japanese user word: Japanese characters only
  if (/[A-Za-z0-9_-]|[｡-ﾟ]/.test(word)) return 'mixed';
  if (chars.length > USER_WORD_MAX) return 'length';
  if (/^[－‐−]|[－‐−]$/.test(word)) return 'edge'; // JIS hyphen / minus sign (ー is fine)
  if (!/[぀-ヿ㐀-鿿豈-﫿ー]/.test(word)) return 'nokana';
  return '';
}

export function analyze(lines: readonly string[], opts: AnalyzeOptions): RawDiagnostic[] {
  const out: RawDiagnostic[] = [];
  const disabled = new Set(opts.disabledRules ?? []);
  const push = (code: RuleCode, line: number, start: number, end: number, args: string[] = [], severity?: Severity) => {
    if (!disabled.has(code)) out.push({ code, severity: severity ?? SEVERITY[code], line, start, end: Math.max(end, start + 1), args });
  };

  const fmt = detectFormat(lines, opts.format ?? 'auto');
  if (fmt.format === 'free') return out;
  const variable = fmt.format === 'variable';

  let division: string | undefined;
  let pending: PendingLiteral | undefined;
  let inSql = false;
  let prevEndsEntry = true; // previous code line ended with a period

  for (let ln = 0; ln < lines.length; ln++) {
    const text = lines[ln].replace(/\r$/, '');
    if (text.length === 0) continue;
    const lc = new LineColumns(text, opts.mode);

    // NC010 tabs (anywhere on the line)
    for (let i = text.indexOf('\t'); i >= 0; i = text.indexOf('\t', i + 1)) {
      push('NC010', ln, i, i + 1);
    }

    // NC004 line too long: the setting for fixed format, 251 bytes for variable format (付録B.1)
    const maxLine = variable ? VARIABLE_MAX_BYTES : opts.maxLineLength;
    if (maxLine > 0 && lc.totalWidth > maxLine) {
      push('NC004', ln, lc.offsetAtCol(maxLine + 1), text.length, [String(maxLine), String(lc.totalWidth)]);
    }

    if (lc.totalWidth < INDICATOR_COL) continue; // only sequence area present

    const indCell = lc.cellAtCol(INDICATOR_COL)!;
    const indicatorOk = indCell.col === INDICATOR_COL && indCell.width === 1;
    const ind = indicatorOk ? indCell.ch : '';
    const isComment = ind === '*' || ind === '/' || (!fmt.debugging && (ind === 'D' || ind === 'd'));

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
    const contentEnd = variable ? text.length : lc.offsetAtCol(IDENT_START);
    const content = text.slice(contentStart, contentEnd);
    const isContinuation = ind === '-';
    const isBlank = content.trim() === '';

    /**
     * Column 72|73 checks. `commentStart` is the absolute offset where a `*>` (or `--` in
     * EXEC SQL) comment begins on this line, or -1. Anything inside a comment is ignored.
     */
    const check72 = (commentStart: number) => {
      if (variable) return;
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
    let lit: PendingLiteral | undefined; // the literal being read (may start on an earlier line)
    if (pending) {
      if (isContinuation) {
        const first = content.search(/\S/);
        if (first >= 0 && content[first] === pending.quote) {
          inStr = pending.quote;
          strStart = contentStart + first;
          scanFrom = first + 1;
          lit = pending;
        } else if (first >= 0) {
          push('NC008', ln, contentStart + first, contentStart + first + 1, [pending.quote]);
          pending = undefined;
          check72(-1);
          continue; // the rest of this line is ambiguous; don't cascade
        }
      } else {
        push('NC007', pending.segLine, pending.segStart, pending.segEnd);
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

      const codeText = upper.replace(/\*>.*$/, '').trimEnd();

      // NC016 division / section header must be followed by a period
      const hdr = /^(?:(?:IDENTIFICATION|ID|ENVIRONMENT|DATA)\s+DIVISION|[^\s.]+\s+SECTION(?:\s+\d+)?)(?![A-Z0-9_-])/.exec(codeText);
      if (hdr && !/^\s*\./.test(codeText.slice(hdr[0].length))) {
        push('NC016', ln, tokStart, tokStart + hdr[0].length, [content.substr(firstIdx, hdr[0].length).replace(/\s+/g, ' ')]);
      }

      /** a user-defined name: NC018 when reserved, otherwise NC020 when malformed */
      const checkName = (word: string, at: number, needsLetter: boolean) => {
        if (![...word].every((c) => WORD_CHAR.test(c))) return; // not a plain name token
        const shown = content.substr(at, word.length);
        if (RESERVED_FOR_NAMES.has(word)) {
          push('NC018', ln, contentStart + at, contentStart + at + word.length, [shown]);
          return;
        }
        const problem = userWordProblem(shown, needsLetter);
        // mixing Japanese and ASCII follows the manual's wording only; keep it low-key (information)
        if (problem) {
          push('NC020', ln, contentStart + at, contentStart + at + word.length, [shown, problem, String([...shown].length)],
            problem === 'mixed' ? 'info' : undefined);
        }
      };
      if ((division === 'DATA' || division === undefined) && prevEndsEntry) {
        // NC017 level number / NC018 reserved data name
        const lv = /^(\d{1,2})(?=\s|\.|$)\s*([^\s.]*)/.exec(codeText);
        if (lv) {
          if (!LEVELS_OK(Number(lv[1]))) push('NC017', ln, tokStart, tokEnd, [lv[1]]);
          else if (lv[2] && !ANONYMOUS_START.has(lv[2])) checkName(lv[2], firstIdx + lv[0].length - lv[2].length, true);
        }
        const fd = /^(?:FD|SD|RD|CD)\s+([^\s.]+)/.exec(codeText);
        if (fd) checkName(fd[1], firstIdx + fd[0].length - fd[1].length, true);
      } else if (division === 'PROCEDURE' && !tabBeforeFirst && firstCol <= AREA_A_END) {
        // NC018 / NC020 section and paragraph names ("EXIT." etc. are already NC006)
        const sec = /^([^\s.]+)\s+SECTION(?![A-Z0-9_-])/.exec(codeText);
        if (sec) checkName(sec[1], firstIdx, false);
        else {
          const para = /^([^\s.]+)\s*\.(?:\s|$)/.exec(codeText);
          if (para && !STATEMENT_VERBS.has(para[1]) && !NOT_PARAGRAPH_NAMES.has(para[1])) checkName(para[1], firstIdx, false);
        }
      }
    }

    // ---- scan area A/B for literals, full-width spaces, inline comments
    let commentStart = -1;
    /** content of a finished literal: NC015 (characters allowed) and NC019 (length) */
    const checkLiteral = (l: PendingLiteral, closeAbs: number) => {
      const body = l.body;
      const p = l.prefix;
      let bad = false;
      if (p === 'X' || p === 'NX') bad = !/^[0-9A-Fa-f]*$/.test(body) || body.length % (p === 'X' ? 2 : 4) !== 0;
      else if (p === 'B') bad = !/^[01]*$/.test(body);
      else if (p === 'N' && opts.mode === 'shiftjis') {
        bad = [...body].some((c) => charWidth(c.codePointAt(0)!, 'shiftjis') !== 2);
      }
      const to = l.line === ln ? closeAbs : l.end;
      if (bad) push('NC015', l.line, l.start, to, [p]);

      const lim = LITERAL_LIMITS[p];
      const size =
        lim.unit === 'bytes'
          ? [...body].reduce((n, c) => n + charWidth(c.codePointAt(0)!, opts.mode), 0)
          : lim.unit === 'chars'
            ? [...body].length
            : body.length;
      if (size < lim.min || size > lim.max) {
        push('NC019', l.line, l.start, to, [p === '' ? 'literal' : p, String(size), `${lim.min}-${lim.max}`, lim.unit]);
      }
    };
    for (let i = scanFrom; i < content.length; i++) {
      const ch = content[i];
      if (inStr) {
        if (ch === inStr) {
          if (content[i + 1] === inStr) {
            lit!.body += ch;
            i++;
          } else {
            inStr = null;
            checkLiteral(lit!, contentStart + i + 1);
            lit = undefined;
          }
        } else {
          lit!.body += ch;
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
        const pm = /(?:^|[^A-Za-z0-9_\-])(NX|NC|N|X|B)$/i.exec(content.slice(0, i));
        const prefix = pm ? pm[1].toUpperCase().replace(/^NC$/, 'N') : '';
        lit = {
          line: ln,
          start: contentStart + (pm ? i - pm[1].length : i),
          end: contentEnd,
          quote: ch,
          prefix,
          body: '',
          segLine: ln,
          segStart: contentStart + i,
          segEnd: contentEnd
        };
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
    if (inStr && lit) {
      // blanks up to the end of the line belong to a literal that is continued (1.5.5)
      const pad = variable ? 0 : Math.max(0, AREA_B_END - lc.totalWidth);
      pending = { ...lit, segLine: ln, segStart: strStart, segEnd: Math.max(contentEnd, strStart + 1), body: lit.body + ' '.repeat(pad) };
    }
    check72(commentStart);
    const code = (commentStart >= 0 ? text.slice(contentStart, commentStart) : content).trimEnd();
    if (code) prevEndsEntry = code.endsWith('.') && !inStr;
  }

  if (pending) push('NC007', pending.segLine, pending.segStart, pending.segEnd);

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
