/**
 * Structure of a fixed-format NetCOBOL source: programs, divisions, sections,
 * paragraphs, file descriptions and data items, plus COPY statements and folding
 * regions. Line based and forgiving: it never throws on odd input.
 *
 * Pure TypeScript (no vscode import).
 */
import { AREA_A_END, AREA_A_START, ColumnMode, IDENT_START, INDICATOR_COL, LineColumns } from './columns';
import { FormatInfo, detectFormat } from './format';
import { RESERVED_FOR_NAMES } from './keywords';
import { effectiveLineCount } from './sequence';
import { WORD, WORD_CHAR_RE } from './words';

export type NodeKind = 'program' | 'division' | 'section' | 'paragraph' | 'file' | 'data' | 'copy';

export interface Span {
  line: number;
  start: number; // UTF-16 offsets in the line
  end: number;
}

export interface StructNode {
  kind: NodeKind;
  /** label for the outline, e.g. "PROCEDURE DIVISION", "01 WS-REC" */
  label: string;
  /** user-defined name in upper case (lookup key); undefined for FILLER, divisions, fixed sections */
  key?: string;
  /** program: PROGRAM / CLASS / METHOD;  data: PIC / VALUE summary */
  detail?: string;
  /** data: the whole data description entry as written (all its lines, up to the period) */
  entry?: string;
  level?: number;
  startLine: number;
  endLine: number;
  nameSpan: Span;
  children: StructNode[];
  parent?: StructNode;
}

export interface CopyRef {
  name: string;
  lib?: string;
  quoted: boolean;
  span: Span; // the name (without quotes)
  /** COPY ... REPLACING pairs, operands normalised (pseudo-text delimiters removed, upper case) */
  replacing?: { from: string; to: string }[];
}

export interface FoldRegion {
  start: number;
  end: number;
  kind: 'region' | 'comment';
}

export interface Structure {
  roots: StructNode[];
  copies: CopyRef[];
  folds: FoldRegion[];
  /** upper-case name → definitions (paragraphs, user sections, files, data items, programs) */
  definitions: Map<string, StructNode[]>;
}

const DIVISION_RE = /^(IDENTIFICATION|ID|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION(?![A-Z0-9_-])/;
const SECTION_RE = new RegExp(`^(${WORD})\\s+SECTION(?:\\s+\\d+)?\\s*\\.`, 'i');
const FIXED_SECTIONS = new Set([
  'WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE', 'FILE', 'SCREEN', 'REPORT', 'CONFIGURATION',
  'INPUT-OUTPUT', 'COMMUNICATION', 'CONSTANT'
]);
const PROGRAM_ID_RE = new RegExp(`^(PROGRAM-ID|CLASS-ID|METHOD-ID)\\s*\\.?\\s*(${WORD}|"[^"]+"|'[^']+')?`, 'i');
const END_PROGRAM_RE = /^END\s+(PROGRAM|CLASS|METHOD)(?![A-Z0-9_-])/;
const FD_RE = new RegExp(`^(FD|SD|RD|CD)\\s+(${WORD})`, 'i');
const LEVEL_RE = new RegExp(`^(\\d{1,2})(?=\\s|\\.|$)(?:\\s+(${WORD}))?`, 'i');
const PARAGRAPH_RE = new RegExp(`^(${WORD})\\s*\\.(?:\\s|$)`, 'i');
const COPY_RE = new RegExp(`(^|[^A-Za-z0-9_\\-])COPY\\s+(${WORD}|"[^"]+"|'[^']+')(?:\\s+(?:OF|IN)\\s+(${WORD}))?`, 'gi');
const PIC_RE = /(?:^|\s)(PIC(?:TURE)?)(?:\s+IS)?\s+(\S+?)(?=\.?(?:\s|$))/i;
const VALUE_RE = /(?:^|\s)VALUES?\s+(?:(?:IS|ARE)\s+)?(.+?)\.?\s*$/i;

/** words that can sit alone with a period in area A but are not paragraph names */
const NOT_PARAGRAPH = new Set([
  'EXIT', 'CONTINUE', 'GOBACK', 'ELSE', 'END-IF', 'END-PERFORM', 'END-EVALUATE', 'END-READ',
  'END-WRITE', 'END-CALL', 'END-EXEC', 'END-COMPUTE', 'END-SEARCH', 'END-STRING', 'END-UNSTRING',
  'END-START', 'END-RETURN', 'END-REWRITE', 'END-DELETE', 'END-ADD', 'END-SUBTRACT',
  'END-MULTIPLY', 'END-DIVIDE', 'DECLARATIVES', 'STOP', 'NEXT'
]);
/** words that can follow a level number when there is no data name */
export const CLAUSE_WORDS = new Set([
  'FILLER', 'PIC', 'PICTURE', 'VALUE', 'VALUES', 'REDEFINES', 'OCCURS', 'USAGE', 'COMP', 'COMP-1',
  'COMP-2', 'COMP-3', 'COMP-4', 'COMP-5', 'COMPUTATIONAL', 'BINARY', 'PACKED-DECIMAL', 'DISPLAY',
  'NATIONAL', 'INDEX', 'POINTER', 'SIGN', 'SYNC', 'SYNCHRONIZED', 'JUST', 'JUSTIFIED', 'BLANK',
  'EXTERNAL', 'GLOBAL', 'TYPEDEF', 'BASED', 'RENAMES'
]);

interface Line {
  /** raw line text */
  text: string;
  kind: 'blank' | 'comment' | 'code' | 'continuation';
  /** area A+B text (columns 8-72) with literals and *> comments replaced by spaces */
  masked: string;
  /** area A+B text as written */
  content: string;
  /** UTF-16 offset of `content` in `text` */
  contentStart: number;
  /** 1-based column of the first non-blank character of the content, 0 if none */
  firstCol: number;
}

function readLine(text: string, mode: ColumnMode, fmt: FormatInfo): Line {
  const lc = new LineColumns(text, mode);
  const base = { text, masked: '', content: '', contentStart: 0, firstCol: 0 };
  if (lc.totalWidth < INDICATOR_COL) return { ...base, kind: 'blank' };
  const ind = lc.cellAtCol(INDICATOR_COL)!;
  const ch = ind.col === INDICATOR_COL ? ind.ch : '';
  if (ch === '*' || ch === '/' || (!fmt.debugging && (ch === 'D' || ch === 'd'))) return { ...base, kind: 'comment' };
  const contentStart = lc.offsetAtCol(AREA_A_START);
  const content = text.slice(contentStart, fmt.format === 'variable' ? text.length : lc.offsetAtCol(IDENT_START));
  const masked = mask(content);
  const first = content.search(/\S/);
  if (first < 0) return { ...base, kind: ch === '-' ? 'continuation' : 'blank', content, contentStart, masked };
  return {
    text,
    kind: ch === '-' ? 'continuation' : 'code',
    content,
    contentStart,
    masked,
    firstCol: lc.colAtOffset(contentStart + first)
  };
}

/** Replace literals and floating comments with spaces, keeping offsets. */
function mask(s: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) {
        if (s[i + 1] === quote) {
          out += '  ';
          i++;
          continue;
        }
        quote = null;
      }
      out += ' ';
      continue;
    }
    if (c === '*' && s[i + 1] === '>') {
      out += ' '.repeat(s.length - i);
      break;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += ' ';
      continue;
    }
    out += c;
  }
  return out;
}

const RANK: Record<NodeKind, number> = { program: 0, division: 1, section: 2, file: 3, paragraph: 3, data: 4, copy: 5 };
function rankOf(kind: NodeKind, level?: number): number {
  if (kind !== 'data') return RANK[kind];
  const lv = level === 77 ? 1 : level === 66 ? 2 : level === 88 ? 99 : level ?? 1;
  return 4 + lv / 100;
}

export function parseStructure(allLines: readonly string[], mode: ColumnMode, fmtIn?: FormatInfo): Structure {
  const fmt = fmtIn ?? detectFormat(allLines);
  if (fmt.format === 'free') return { roots: [], copies: [], folds: [], definitions: new Map() };
  const n = effectiveLineCount(allLines);
  const lines = allLines.slice(0, n).map((t) => readLine(t.replace(/\r$/, ''), mode, fmt));
  const roots: StructNode[] = [];
  const copies: CopyRef[] = [];
  const folds: FoldRegion[] = [];
  const definitions = new Map<string, StructNode[]>();
  const stack: { node: StructNode; rank: number }[] = [];

  let division: string | undefined;
  let lastCode = -1; // last code line seen before the current one
  let inSql = false;
  let sqlStart = -1;
  let commentStart = -1;

  const define = (node: StructNode) => {
    if (!node.key) return;
    const list = definitions.get(node.key);
    if (list) list.push(node);
    else definitions.set(node.key, [node]);
  };
  const closeTo = (rank: number, beforeLine: number) => {
    while (stack.length && stack[stack.length - 1].rank >= rank) {
      const { node } = stack.pop()!;
      node.endLine = Math.max(node.startLine, Math.min(lastCode, beforeLine - 1));
    }
  };
  const open = (node: StructNode, rank: number) => {
    closeTo(rank, node.startLine);
    const parent = stack.length ? stack[stack.length - 1].node : undefined;
    node.parent = parent;
    (parent ? parent.children : roots).push(node);
    stack.push({ node, rank });
    define(node);
  };
  const span = (ln: number, line: Line, idx: number, len: number): Span => ({
    line: ln,
    start: line.contentStart + idx,
    end: line.contentStart + idx + len
  });
  const node = (kind: NodeKind, label: string, ln: number, nameSpan: Span, extra: Partial<StructNode> = {}): StructNode => ({
    kind,
    label,
    startLine: ln,
    endLine: ln,
    nameSpan,
    children: [],
    ...extra
  });

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];

    // comment blocks
    if (line.kind === 'comment') {
      if (commentStart < 0) commentStart = ln;
      continue;
    }
    if (commentStart >= 0) {
      if (ln - 1 > commentStart) folds.push({ start: commentStart, end: ln - 1, kind: 'comment' });
      commentStart = -1;
    }
    if (line.kind === 'blank') continue;

    const m = line.masked;
    const upperAll = m.toUpperCase();

    // COPY statements: match on the real text (the name may be a literal), but only where
    // the keyword itself is code, not inside a literal or comment
    const copiesBefore = copies.length;
    COPY_RE.lastIndex = 0;
    for (let r = COPY_RE.exec(line.content); r; r = COPY_RE.exec(line.content)) {
      const kw = r.index + r[1].length;
      if (m.substr(kw, 4).toUpperCase() !== 'COPY') continue;
      const afterKw = r[0].slice(r[1].length + 4);
      const nameStart = kw + 4 + (afterKw.length - afterKw.trimStart().length);
      const quoted = /^["']/.test(r[2]);
      const name = quoted ? r[2].slice(1, -1) : r[2];
      const replacing = parseReplacing(statementText(lines, ln, kw));
      copies.push({
        name,
        lib: r[3],
        quoted,
        span: span(ln, line, nameStart + (quoted ? 1 : 0), name.length),
        ...(replacing.length ? { replacing } : {})
      });
    }

    // EXEC SQL blocks: fold them, skip their contents
    if (inSql) {
      if (/END-EXEC/.test(upperAll)) {
        inSql = false;
        if (ln > sqlStart) folds.push({ start: sqlStart, end: ln, kind: 'region' });
      }
      lastCode = ln;
      continue;
    }
    if (/(^|[^A-Z0-9_-])EXEC\s+SQL(?![A-Z0-9_-])/.test(upperAll) && !/END-EXEC/.test(upperAll)) {
      inSql = true;
      sqlStart = ln;
    }

    if (line.kind === 'continuation') {
      lastCode = ln;
      continue;
    }

    const first = line.content.search(/\S/);
    const rest = m.slice(first); // masked: literals and *> comments are blank
    const restText = line.content.slice(first); // as written
    const upper = rest.toUpperCase();
    const inAreaA = line.firstCol <= AREA_A_END;

    // ---- program boundaries
    const div = DIVISION_RE.exec(upper);
    if (div && (div[1] === 'IDENTIFICATION' || div[1] === 'ID')) {
      open(node('program', '(program)', ln, span(ln, line, first, div[0].length), { detail: 'PROGRAM' }), RANK.program);
    }
    const pid = PROGRAM_ID_RE.exec(restText);
    if (pid) {
      let prog = stack.find((s) => s.node.kind === 'program')?.node;
      if (!prog) {
        prog = node('program', '(program)', ln, span(ln, line, first, pid[1].length), { detail: 'PROGRAM' });
        open(prog, RANK.program);
      }
      prog.detail = pid[1].toUpperCase().replace('-ID', '');
      if (pid[2]) {
        const raw = pid[2].replace(/^["']|["']$/g, '');
        const idx = first + pid[0].length - pid[2].length + (pid[2] !== raw ? 1 : 0);
        prog.label = raw;
        prog.key = raw.toUpperCase();
        prog.nameSpan = span(ln, line, idx, raw.length);
        define(prog);
      }
    }
    if (END_PROGRAM_RE.test(upper)) {
      closeTo(RANK.division, ln);
      lastCode = ln;
      closeTo(RANK.program, ln + 1);
      division = undefined;
      continue;
    }

    // ---- divisions
    if (div) {
      division = div[1] === 'ID' ? 'IDENTIFICATION' : div[1];
      open(node('division', `${division} DIVISION`, ln, span(ln, line, first, div[0].length)), RANK.division);
      lastCode = ln;
      continue;
    }

    // ---- sections
    const sec = SECTION_RE.exec(rest);
    if (sec && (division === 'PROCEDURE' || division === 'DATA' || division === 'ENVIRONMENT' || division === undefined)) {
      const name = sec[1];
      const fixed = FIXED_SECTIONS.has(name.toUpperCase());
      open(
        node('section', `${fixed ? name.toUpperCase() : name} SECTION`, ln, span(ln, line, first, name.length), {
          key: fixed ? undefined : name.toUpperCase()
        }),
        RANK.section
      );
      lastCode = ln;
      continue;
    }

    if (division === 'PROCEDURE') {
      // ---- paragraphs (area A, "NAME.")
      const para = inAreaA ? PARAGRAPH_RE.exec(rest) : null;
      if (para && !NOT_PARAGRAPH.has(para[1].toUpperCase()) && !RESERVED_FOR_NAMES.has(para[1].toUpperCase())) {
        open(node('paragraph', para[1], ln, span(ln, line, first, para[1].length), { key: para[1].toUpperCase() }), RANK.paragraph);
      }
    } else if (division === 'DATA' || division === undefined) {
      // ---- file descriptions
      const fd = FD_RE.exec(rest);
      if (fd) {
        const idx = first + fd[0].length - fd[2].length;
        open(
          node('file', `${fd[1].toUpperCase()} ${fd[2]}`, ln, span(ln, line, idx, fd[2].length), { key: fd[2].toUpperCase() }),
          RANK.file
        );
      } else if (/^COPY\s/i.test(rest) && copies.length > copiesBefore) {
        // ---- COPY at data-entry position: a leaf in the outline. It ends elementary items
        // (those with PIC, 88/66/77) and goes under the nearest open group item or section.
        const ref = copies[copiesBefore];
        while (stack.length) {
          const top = stack[stack.length - 1].node;
          const elementary = top.kind === 'data' && (top.detail?.startsWith('PIC') || top.level === 88 || top.level === 66 || top.level === 77);
          if (!elementary) break;
          stack.pop();
          top.endLine = Math.max(top.startLine, Math.min(lastCode, ln - 1));
        }
        const parent = stack.length ? stack[stack.length - 1].node : undefined;
        const label = `COPY ${ref.name}${ref.lib ? ` OF ${ref.lib}` : ''}`;
        const leaf = node('copy', label, ln, ref.span);
        leaf.parent = parent;
        (parent ? parent.children : roots).push(leaf);
      } else {
        // ---- data description entries
        const lv = LEVEL_RE.exec(rest);
        const level = lv ? Number(lv[1]) : NaN;
        if (lv && ((level >= 1 && level <= 49) || level === 66 || level === 77 || level === 88)) {
          const word = lv[2];
          const isName = !!word && !CLAUSE_WORDS.has(word.toUpperCase());
          const lvText = lv[1].padStart(2, '0');
          const nameIdx = word ? first + lv[0].length - word.length : first;
          const label = `${lvText} ${isName ? word : 'FILLER'}`;
          const detail = describe(restText, level);
          open(
            node('data', label, ln, span(ln, line, isName ? nameIdx : first, isName ? word!.length : lv[1].length), {
              key: isName ? word!.toUpperCase() : undefined,
              level,
              detail,
              entry: statementText(lines, ln, first)
            }),
            rankOf('data', level)
          );
        }
      }
    }
    lastCode = ln;
  }

  if (commentStart >= 0 && lines.length - 1 > commentStart) folds.push({ start: commentStart, end: lines.length - 1, kind: 'comment' });
  lastCode = Math.max(lastCode, 0);
  closeTo(-1, lines.length + 1);

  // folding regions for every node that spans lines
  const walk = (list: StructNode[]) => {
    for (const nd of list) {
      if (nd.endLine > nd.startLine) folds.push({ start: nd.startLine, end: nd.endLine, kind: 'region' });
      walk(nd.children);
    }
  };
  walk(roots);
  folds.sort((a, b) => a.start - b.start || b.end - a.end);

  return { roots, copies, folds, definitions };
}

function describe(rest: string, level: number): string | undefined {
  if (level === 88) {
    const v = VALUE_RE.exec(rest);
    return v ? `VALUE ${v[1].trim()}` : undefined;
  }
  const p = PIC_RE.exec(rest);
  return p ? `PIC ${p[2]}` : undefined;
}

/** True when `offset` on line `ln` falls inside a COPY name. */
export function copyAt(s: Structure, ln: number, offset: number): CopyRef | undefined {
  return s.copies.find((c) => c.span.line === ln && offset >= c.span.start && offset <= c.span.end);
}

/** Text of a statement from `content[from]` on line `ln` up to its separator period (max 30 lines). */
function statementText(lines: Line[], ln: number, from: number): string {
  let out = '';
  for (let i = ln; i < lines.length && i < ln + 30; i++) {
    const l = lines[i];
    if (l.kind === 'comment') continue;
    const piece = (i === ln ? l.content.slice(from) : l.content).replace(/\*>.*$/, '');
    out += ' ' + piece;
    // a period outside pseudo-text and literals ends the statement
    const masked = out.replace(/==[\s\S]*?==/g, (m) => ' '.repeat(m.length)).replace(/"[^"]*"|'[^']*'/g, (m) => ' '.repeat(m.length));
    if (/\.(\s|$)/.test(masked)) break;
  }
  return out;
}

const OPERAND = `(==[\\s\\S]*?==|"[^"]*"|'[^']*'|[^\\s.]+)`;
const PAIR_RE = new RegExp(`(?:(?:LEADING|TRAILING)\\s+)?${OPERAND}\\s+BY\\s+${OPERAND}`, 'gi');

/** REPLACING operand pairs of a COPY statement. */
export function parseReplacing(stmt: string): { from: string; to: string }[] {
  const at = stmt.search(/(^|\s)REPLACING(\s|$)/i);
  if (at < 0) return [];
  const body = stmt.slice(at).replace(/^\s*REPLACING/i, '');
  const norm = (o: string) => o.replace(/^==|==$/g, '').replace(/^["']|["']$/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
  const pairs: { from: string; to: string }[] = [];
  PAIR_RE.lastIndex = 0;
  for (let m = PAIR_RE.exec(body); m; m = PAIR_RE.exec(body)) pairs.push({ from: norm(m[1]), to: norm(m[2]) });
  return pairs;
}

/**
 * Names to look for inside a copybook so that `key` (as written in the including source)
 * is found after REPLACING: for each pair, undo the replacement.
 */
export function namesBeforeReplacing(key: string, replacing: { from: string; to: string }[] | undefined): string[] {
  const out = [key];
  for (const { from, to } of replacing ?? []) {
    if (to && key.includes(to)) out.push(key.replace(to, from));
    else if (!to && from) out.push(from + key); // REPLACING ==X-== BY ==== (prefix removed)
  }
  return [...new Set(out)];
}

/**
 * Keep the definitions that satisfy a qualification "A OF B OF C": each qualifier must be
 * an ancestor, in order. Returns all definitions when none qualifies.
 */
export function qualify(defs: StructNode[], qualifiers: string[]): StructNode[] {
  if (qualifiers.length === 0) return defs;
  const ok = defs.filter((d) => {
    let p = d.parent;
    for (const q of qualifiers) {
      while (p && p.key !== q) p = p.parent;
      if (!p) return false;
      p = p.parent;
    }
    return true;
  });
  return ok.length ? ok : defs;
}

export { WORD_CHAR_RE };
